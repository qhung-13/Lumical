import { HttpException, Inject, Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Transactions, type TransactionContext } from '../../../platform/database/application/transactions';
import { ActiveAccounts } from '../../identity/application/ports';
import { TEMPLATE_CATEGORIES } from '../domain/template-catalog';
import type { PublicTemplateRecord, TemplateCategory } from '../domain/template-catalog';
import {
  TEMPLATE_AVAILABILITIES, type AdminListQuery, type AdminRequestContext, TemplateAdminError, type TemplateAdminState, type TemplateAdminView,
  type TemplateAvailability, adminListInput, assertComplete, availabilityChange, canTransition, conflict, createInput, draftRecord,
  encodeAdminCursor, forbidden, idempotencyConflict, incompletePublication, invalid, invalidTransition, notFound, preconditionRequired,
  projectView, publishInput, record, unavailable, versionConflict,
} from '../domain/template-admin';
import { TemplateAdminRepository } from './ports';

export interface AdminTemplateListResult { data: TemplateAdminView[]; meta: { nextCursor: string | null; hasMore: boolean } }

// ActiveAccounts reports authentication, CSRF and Origin failures in IdentityModule's vocabulary;
// keeping their status is what stops a 401 or 403 from degrading into a 503.
function fromAnotherModule(error: unknown): error is { status: number; code: string } {
  return error !== null && typeof error === 'object' && 'status' in error && typeof (error as { status: unknown }).status === 'number' &&
    'code' in error && typeof (error as { code: unknown }).code === 'string';
}

@Injectable()
export class TemplateAdminService {
  constructor(@Inject(TemplateAdminRepository) private readonly repository: TemplateAdminRepository,
    @Inject(Transactions) private readonly transactions: Transactions,
    @Inject(ActiveAccounts) private readonly accounts: ActiveAccounts) {}

  // Same retry vocabulary as the account-status command: serialization races retry, unique
  // publication races report the safe conflict, everything else is a truthful 503.
  private async atomic<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await this.transactions.run(work); }
      catch (error) {
        if (error instanceof TemplateAdminError || error instanceof HttpException || fromAnotherModule(error)) throw error;
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
        const metadata = error && typeof error === 'object' && 'meta' in error ? error.meta : undefined;
        const raw = metadata && typeof metadata === 'object' ? metadata as { code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown } } } : undefined;
        const sqlCode = raw?.code ?? raw?.driverAdapterError?.cause?.originalCode;
        if ((code === 'P2034' || code === 'P2010' && (sqlCode === '40001' || sqlCode === '40P01')) && attempt < 2) continue;
        // A unique violation here is usually an equivalent request that committed concurrently,
        // most often on the idempotency record. Every command re-checks its replay record before
        // doing any work, so retrying lets that check serve the winner's stored outcome instead of
        // a bare conflict the caller would answer by re-sending a mutation that already happened.
        // Once the retries are spent it is a genuine conflict.
        if (code === 'P2002' && attempt < 2) continue;
        if (code === 'P2002') throw conflict();
        throw unavailable();
      }
    }
    throw unavailable();
  }

  private key(value: string | undefined): string {
    if (!value || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) invalid();
    return value;
  }

  private expected(etag: string | undefined): number {
    if (!etag) throw preconditionRequired();
    const match = /^"([1-9][0-9]*)"$/.exec(etag);
    if (!match || !Number.isSafeInteger(Number(match[1]))) invalid();
    return Number(match[1]);
  }

  // The safe replay carries no secret, so the digest only has to detect a reused key paired with
  // a different request body.
  private digest(operation: string, body: unknown): string {
    return createHash('sha256').update(`${operation}\0${JSON.stringify(body, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value)}`).digest('hex');
  }

  private matches(replayDigest: string, digest: string): void {
    const left = Buffer.from(replayDigest); const right = Buffer.from(digest);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw idempotencyConflict();
  }

  // Nested run joins this command's transaction, so authentication never opens a second one.
  private async actor(browser: AdminRequestContext, mutation: boolean): Promise<string> {
    let actorId = '';
    await this.accounts.withActiveAccount(browser, mutation, async (principal) => {
      if (principal.role !== 'ADMIN') throw forbidden();
      actorId = principal.id;
    });
    return actorId;
  }

  // A stored replay is untrusted input: re-check its full shape, plus every field the command
  // already knows, before it can shape a response.
  private replayed(safeResult: unknown, expected: Partial<Pick<TemplateAdminView, 'id' | 'availability' | 'version'>>): TemplateAdminView {
    if (!safeResult || typeof safeResult !== 'object' || Array.isArray(safeResult)) throw unavailable();
    const stored = safeResult as Record<string, unknown>;
    if (typeof stored.id !== 'string' || !TEMPLATE_CATEGORIES.includes(stored.category as TemplateCategory) ||
        !TEMPLATE_AVAILABILITIES.includes(stored.availability as TemplateAvailability) ||
        typeof stored.version !== 'number' || !Number.isSafeInteger(stored.version) || stored.version < 1 ||
        (stored.currentPublishedRevisionId !== null && typeof stored.currentPublishedRevisionId !== 'string') ||
        (stored.publishedRevision !== null && typeof stored.publishedRevision !== 'number')) throw unavailable();
    const view: TemplateAdminView = {
      id: stored.id, category: stored.category as TemplateCategory,
      availability: stored.availability as TemplateAvailability, version: stored.version,
      currentPublishedRevisionId: typeof stored.currentPublishedRevisionId === 'string' ? stored.currentPublishedRevisionId : null,
      publishedRevision: typeof stored.publishedRevision === 'number' ? stored.publishedRevision : null,
    };
    // Only compare the fields this command already knows; an absent expectation is not a claim.
    if ((expected.id !== undefined && view.id !== expected.id) ||
        (expected.availability !== undefined && view.availability !== expected.availability) ||
        (expected.version !== undefined && view.version !== expected.version)) throw unavailable();
    return view;
  }

  // BR-ADM-001/BR-TPL-001: the Admin catalog view is operational, not a publication action, so it
  // reads without a row lock and writes no audit row — every mutation below still records itself.
  async list(input: unknown, browser: AdminRequestContext): Promise<AdminTemplateListResult> {
    const query: AdminListQuery = adminListInput(input);
    return this.atomic(async (context) => {
      await this.actor(browser, false);
      const rows = await this.repository.list({ state: query.state, after: query.after, take: query.limit + 1 }, context);
      const hasMore = rows.length > query.limit;
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return { data: page.map(projectView), meta: {
        nextCursor: hasMore && last ? encodeAdminCursor({ createdAt: last.createdAt, id: last.id }) : null, hasMore } };
    });
  }

  async create(input: unknown, key: string | undefined, browser: AdminRequestContext): Promise<TemplateAdminView> {
    const value = createInput(input);
    const intent = this.key(key);
    const operation = 'TEMPLATE_CREATE';
    const digest = this.digest(operation, value);
    return this.atomic(async (context) => {
      const actorId = await this.actor(browser, true);
      const replay = await this.repository.replay(actorId, operation, intent, context);
      if (replay) {
        this.matches(replay.requestDigest, digest);
        return this.replayed(replay.safeResult, { availability: 'INACTIVE' });
      }
      // BR-TPL-001: an incomplete definition may exist as INACTIVE but must never be servable.
      assertComplete(draftRecord(value.category, value.revision));
      const created = await this.repository.create({ category: value.category, revision: value.revision, now: new Date() }, context);
      await this.repository.audit({ actorId, action: 'TEMPLATE_CREATED', targetId: created.id, outcome: 'SUCCEEDED',
        purpose: value.reason, correlationId: browser.requestId, now: new Date() }, context);
      const result: TemplateAdminView = { id: created.id, category: value.category, availability: 'INACTIVE', version: 1,
        currentPublishedRevisionId: created.revision.revisionId, publishedRevision: created.revision.revision };
      await this.repository.saveReplay({ actorId, operation, key: intent, requestDigest: digest, safeResult: { ...result }, targetId: created.id, now: new Date() }, context);
      return result;
    });
  }

  async publish(id: string, input: unknown, key: string | undefined, etag: string | undefined, browser: AdminRequestContext): Promise<TemplateAdminView> {
    const value = publishInput(input);
    const intent = this.key(key);
    const expected = this.expected(etag);
    const operation = `TEMPLATE_PUBLISH:${id}`;
    const digest = this.digest(operation, { ...value, expected });
    return this.atomic(async (context) => {
      const actorId = await this.actor(browser, true);
      const replay = await this.repository.replay(actorId, operation, intent, context);
      if (replay) {
        this.matches(replay.requestDigest, digest);
        return this.replayed(replay.safeResult, { id, version: expected + 1 });
      }
      const target = await this.repository.lock(id, context);
      if (!target) throw notFound();
      if (target.version !== expected) throw versionConflict(target.version);
      // A published revision is immutable: a new numbered row moves the pointer, never rewrites a row.
      const next = (target.published?.revision.revision ?? 0) + 1;
      const candidate: PublicTemplateRecord = record(id, target.category, next, value.revision);
      assertComplete(candidate);
      const published = await this.repository.publish(id, { revision: value.revision, now: new Date() }, context);
      await this.repository.audit({ actorId, action: 'TEMPLATE_PUBLISHED', targetId: id, outcome: 'SUCCEEDED',
        purpose: value.reason, correlationId: browser.requestId, now: new Date() }, context);
      const result: TemplateAdminView = { id, category: target.category, availability: target.availability, version: expected + 1,
        currentPublishedRevisionId: published.revisionId, publishedRevision: published.revision };
      await this.repository.saveReplay({ actorId, operation, key: intent, requestDigest: digest, safeResult: { ...result }, targetId: id, now: new Date() }, context);
      return result;
    });
  }

  async availability(id: string, input: unknown, key: string | undefined, etag: string | undefined, browser: AdminRequestContext): Promise<TemplateAdminView> {
    const change = availabilityChange(input);
    const intent = this.key(key);
    const expected = this.expected(etag);
    const operation = `TEMPLATE_AVAILABILITY:${id}`;
    const digest = this.digest(operation, { ...change, expected });
    return this.atomic(async (context) => {
      const actorId = await this.actor(browser, true);
      const replay = await this.repository.replay(actorId, operation, intent, context);
      if (replay) {
        this.matches(replay.requestDigest, digest);
        return this.replayed(replay.safeResult, { id, availability: change.availability, version: expected + 1 });
      }
      const target = await this.repository.lock(id, context);
      if (!target) throw notFound();
      if (target.version !== expected) throw versionConflict(target.version);
      if (!canTransition(target.availability, change.availability)) throw invalidTransition();
      // BR-TPL-001: only an active, complete, published definition may enter the catalog.
      if (change.availability === 'ACTIVE') assertPublishedComplete(target);
      await this.repository.setAvailability(id, change.availability, new Date(), context);
      await this.repository.audit({ actorId, action: `TEMPLATE_${change.availability}`, targetId: id, outcome: 'SUCCEEDED',
        purpose: change.reason, correlationId: browser.requestId, now: new Date() }, context);
      const result: TemplateAdminView = { id, category: target.category, availability: change.availability, version: expected + 1,
        currentPublishedRevisionId: target.currentPublishedRevisionId, publishedRevision: target.published?.revision.revision ?? null };
      await this.repository.saveReplay({ actorId, operation, key: intent, requestDigest: digest, safeResult: { ...result }, targetId: id, now: new Date() }, context);
      return result;
    });
  }
}

// BR-TPL-001: an inactive or archived template has nothing complete to serve, and activation
// without a servable published revision is refused rather than leaving a hole in the catalog.
// The contract reports this as a conflict with existing state, not as a body the Admin can fix.
function assertPublishedComplete(target: TemplateAdminState): void {
  if (!target.currentPublishedRevisionId || !target.published) throw incompletePublication();
  try { assertComplete(target.published); }
  catch (error) {
    if (error instanceof TemplateAdminError && error.code === 'INCOMPLETE_DEFINITION') throw incompletePublication();
    throw error;
  }
}
