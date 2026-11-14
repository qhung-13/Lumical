import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { TransactionContext } from '../../../platform/database/application/transactions';
import { createHash } from 'node:crypto';
import { OwnerMediaRepository } from '../../media/application/owner-media';
import { arWrite, assertAttachable, assertEventYear, eventWrite, monthNumber, monthPatch } from '../domain/personalization';
import { ActiveAccounts, Clock } from '../../identity/application/ports';
import {
  type ActiveAccountPrincipal,
} from '../../identity/domain/identity';
import { CreateProject } from './create-project';
import {
  ProjectError,
  applyProjectPatch,
  assertProjectAction,
  assertProjectDeletionEligible,
  assertProjectOwner,
  encodeProjectCursor,
  projectListInput,
  projectStatusAfter,
  projectView,
  type ProjectListQuery,
  type ProjectView,
} from '../domain/project';
import {
  assertProjectVersion,
  projectDeletionConfirmation,
  projectPatch,
} from './project-contracts';
import {
  ConcurrentProjectIntent,
  ProjectRepository,
  type ProjectIntent,
  type ProjectIntentResult,
  type ProjectMonthRecord,
  type ProjectRecord,
} from './project-repository';

// The authentication boundary's request shape. Identity owns cookies, CSRF and
// Origin; this module only forwards them.
export interface ProjectBrowserContext {
  readonly secret?: string;
  readonly csrf?: string;
  readonly origin?: string;
}

export interface ProjectPage {
  readonly data: ProjectView[];
  readonly meta: { readonly nextCursor: string | null; readonly hasMore: boolean };
}

export interface ProjectMonthsView {
  readonly projectVersion: number;
  readonly months: ProjectMonthRecord[];
}

export interface ProjectDetailView extends ProjectView {
  readonly deletionEligible: boolean;
}

// A race is worth restarting; a refusal from Identity, the domain or the
// contract is a truthful answer that must reach the client unchanged.
function restartable(error: unknown): boolean {
  if (error instanceof ProjectError || error instanceof HttpException)
    return false;
  if (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  )
    return false;
  if (error instanceof ConcurrentProjectIntent) return true;
  const code =
    error && typeof error === 'object' && 'code' in error
      ? error.code
      : undefined;
  const metadata =
    error && typeof error === 'object' && 'meta' in error ? error.meta : undefined;
  const raw =
    metadata && typeof metadata === 'object'
      ? (metadata as {
          code?: unknown;
          driverAdapterError?: { cause?: { originalCode?: unknown } };
        })
      : undefined;
  const sqlCode = raw?.code ?? raw?.driverAdapterError?.cause?.originalCode;
  if (code === 'P2034') return true;
  return (
    code === 'P2010' && (sqlCode === '40001' || sqlCode === '40P01')
  );
}

// §12: a mutation carries the ETag of the state it was decided on. An absent
// precondition is a domain decision (428); a malformed one is a bad request.
function expectedVersion(etag: string | undefined): number | undefined {
  if (etag === undefined) return undefined;
  const match = /^"([1-9][0-9]*)"$/.exec(etag);
  if (!match || !Number.isSafeInteger(Number(match[1])))
    throw new ProjectError('VALIDATION_FAILED');
  return Number(match[1]);
}

@Injectable()
export class ProjectOwnerService {
  constructor(
    @Inject(ActiveAccounts) private readonly accounts: ActiveAccounts,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(ProjectRepository) private readonly repository: ProjectRepository,
    @Inject(CreateProject) private readonly creation: CreateProject,
    @Inject(OwnerMediaRepository) private readonly media: OwnerMediaRepository,
  ) {}

  // Authentication, CSRF and Origin are re-checked on every attempt because a
  // restarted transaction restarts the whole workflow with it.
  private async run<T>(
    browser: ProjectBrowserContext,
    mutation: boolean,
    work: (
      actor: ActiveAccountPrincipal,
      context: TransactionContext,
    ) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.accounts.withActiveAccount(browser, mutation, work);
      } catch (error) {
        if (attempt >= 3 || !restartable(error)) throw error;
      }
    }
  }

  async list(
    input: unknown,
    browser: ProjectBrowserContext,
  ): Promise<ProjectPage> {
    const query: ProjectListQuery = projectListInput(input);
    return this.run(browser, false, async (actor, context) => {
      const rows = await this.repository.list(
        actor.id,
        { state: query.state, after: query.after, take: query.limit + 1 },
        context,
      );
      const hasMore = rows.length > query.limit;
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return {
        data: page.map(projectView),
        meta: {
          nextCursor:
            hasMore && last
              ? encodeProjectCursor({ createdAt: last.createdAt, id: last.id })
              : null,
          hasMore,
        },
      };
    });
  }

  async get(
    id: string,
    browser: ProjectBrowserContext,
  ): Promise<ProjectDetailView> {
    return this.run(browser, false, async (actor, context) => {
      const record = await this.repository.find(actor.id, id, context);
      if (!record) throw new ProjectError('NOT_FOUND');
      assertProjectOwner(actor, record);
      const history = await this.repository.orderHistory(actor.id, id, context);
      return { ...projectView(record), deletionEligible: history === 'NEVER_ORDERED' };
    });
  }

  async months(
    id: string,
    browser: ProjectBrowserContext,
  ): Promise<ProjectMonthsView> {
    return this.run(browser, false, async (actor, context) => {
      const record = await this.repository.find(actor.id, id, context);
      if (!record) throw new ProjectError('NOT_FOUND');
      assertProjectOwner(actor, record);
      const months = await this.repository.months(actor.id, id, context);
      return { projectVersion: record.version, months };
    });
  }

  // POST /projects: P02 owns the atomic baseline write, this read renders the
  // created Project as the contract's 201 body.
  async create(
    input: unknown,
    key: string | undefined,
    browser: ProjectBrowserContext,
  ): Promise<ProjectView> {
    // §11: the same Idempotency-Key vocabulary identity and Admin templates use.
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key))
      throw new ProjectError('VALIDATION_FAILED');
    const created = await this.creation.execute(browser, input, key);
    // §11: the replay returns the outcome this intent bound, not the row as it
    // happens to be now, so the answer comes from the creation transaction.
    return created.view;
  }

  private locked<T>(
    id: string,
    browser: ProjectBrowserContext,
    work: (actor: ActiveAccountPrincipal, project: ProjectRecord, context: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.run(browser, true, async (actor, context) => {
      const project = await this.repository.lock(actor.id, id, context);
      if (!project) throw new ProjectError('NOT_FOUND');
      assertProjectOwner(actor, project);
      return work(actor, project, context);
    });
  }

  private edit<T>(
    id: string,
    etag: string | undefined,
    browser: ProjectBrowserContext,
    work: (project: ProjectRecord, context: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.locked(id, browser, (actor, project, context) => {
      assertProjectVersion(project, expectedVersion(etag));
      assertProjectAction(actor, project, 'EDIT');
      return work(project, context);
    });
  }

  private editWithIntent<Input, View>(
    id: string,
    etag: string | undefined,
    browser: ProjectBrowserContext,
    operation: ProjectIntent['operation'],
    key: string | undefined,
    parse: () => Input,
    save: (project: ProjectRecord, input: Input, context: TransactionContext) => Promise<ProjectIntentResult>,
    view: (input: Input, result: ProjectIntentResult) => View,
  ): Promise<View> {
    return this.locked(id, browser, async (actor, project, context) => {
      const expected = expectedVersion(etag);
      if (expected === undefined) throw new ProjectError('PRECONDITION_REQUIRED');
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key))
        throw new ProjectError('VALIDATION_FAILED');

      const input = parse();
      const intent = { actorId: actor.id, operation, key };
      const digest = createHash('sha256')
        .update(JSON.stringify([project.id, expected, input]))
        .digest('hex');
      const replay = await this.repository.replayIntent(intent, context);
      if (replay) {
        if (replay.digest !== digest) throw new ProjectError('IDEMPOTENCY_CONFLICT');
        return view(input, replay);
      }
      assertProjectVersion(project, expected);
      assertProjectAction(actor, project, 'EDIT');
      const result = await save(project, input, context);
      await this.repository.completeIntent(intent, digest, result, context);
      return view(input, result);
    });
  }

  async replaceMonth(
    id: string, number: number, input: unknown, etag: string | undefined, browser: ProjectBrowserContext,
  ) {
    return this.edit(id, etag, browser, async (project, context) => {
      const selected = monthNumber(number);
      const patch = monthPatch(input);
      const assets = await this.media.lockForAttachment(
        project.ownerId, patch.images.map(({ assetId }) => assetId), context,
      );
      const byId = new Map(assets.map(asset => [asset.id, asset]));
      for (const { assetId } of patch.images) assertAttachable(byId.get(assetId), ['IMAGE']);

      const month = await this.repository.replaceMonth(project, selected, patch, context);
      const projectVersion = await this.repository.advanceVersion(project, this.clock.now(), context);
      return { ...month, projectVersion };
    });
  }

  async specialDates(id: string, browser: ProjectBrowserContext) {
    return this.run(browser, false, async (actor, context) => {
      const project = await this.repository.find(actor.id, id, context);
      if (!project) throw new ProjectError('NOT_FOUND');
      assertProjectOwner(actor, project);
      return { events: await this.repository.specialDates(project, context), projectVersion: project.version };
    });
  }

  async createSpecialDate(
    id: string, input: unknown, etag: string | undefined, key: string | undefined, browser: ProjectBrowserContext,
  ) {
    return this.editWithIntent(id, etag, browser, 'SPECIAL_DATE_CREATE', key,
      () => eventWrite(input),
      async (project, event, context) => {
        assertEventYear(event, project.year);
        const resourceId = await this.repository.saveSpecialDate(project, event, undefined, context);
        const projectVersion = await this.repository.advanceVersion(project, this.clock.now(), context);
        return { resourceId, projectVersion };
      },
      (event, { resourceId, projectVersion }) => ({ id: resourceId, ...event, projectVersion }),
    );
  }

  async updateSpecialDate(
    id: string, eventId: string, input: unknown, etag: string | undefined, browser: ProjectBrowserContext,
  ) {
    return this.edit(id, etag, browser, async (project, context) => {
      const event = eventWrite(input);
      assertEventYear(event, project.year);
      const savedId = await this.repository.saveSpecialDate(project, event, eventId, context);
      const projectVersion = await this.repository.advanceVersion(project, this.clock.now(), context);
      return { id: savedId, ...event, projectVersion };
    });
  }

  async deleteSpecialDate(id: string, eventId: string, etag: string | undefined, browser: ProjectBrowserContext) {
    return this.edit(id, etag, browser, async (project, context) => {
      await this.repository.deleteSpecialDate(project, eventId, context);
      return this.repository.advanceVersion(project, this.clock.now(), context);
    });
  }

  async saveAR(
    id: string, input: unknown, etag: string | undefined, key: string | undefined, browser: ProjectBrowserContext,
  ) {
    return this.editWithIntent(id, etag, browser, 'PROJECT_AR_WRITE', key,
      () => arWrite(input),
      async (project, reveal, context) => {
        const [asset] = await this.media.lockForAttachment(project.ownerId, [reveal.revealAssetId], context);
        assertAttachable(asset, ['IMAGE', 'VIDEO', 'AUDIO']);
        return this.repository.saveAR(project, reveal, this.clock.now(), context);
      },
      (reveal, { projectVersion }) => ({ ...reveal, status: 'PREPARING' as const, projectVersion }),
    );
  }

  async deleteAR(id: string, etag: string | undefined, browser: ProjectBrowserContext) {
    return this.edit(id, etag, browser, async (project, context) => {
      const now = this.clock.now();
      const removed = await this.repository.deleteAR(project, now, context);
      return removed
        ? this.repository.advanceVersion(project, now, context)
        : project.version;
    });
  }

  async patch(
    id: string,
    input: unknown,
    etag: string | undefined,
    browser: ProjectBrowserContext,
  ): Promise<ProjectView> {
    const patch = projectPatch(input);
    if (Object.keys(patch).length === 0)
      throw new ProjectError('VALIDATION_FAILED');
    return this.edit(id, etag, browser, async (target, context) => {
      const values = applyProjectPatch(target, target.stylePresets, patch);
      const updated = await this.repository.patch(
        target.ownerId,
        target.id,
        values,
        this.clock.now(),
        context,
      );
      return projectView(updated);
    });
  }

  async archive(
    id: string,
    etag: string | undefined,
    browser: ProjectBrowserContext,
  ): Promise<ProjectView> {
    return this.transition(id, etag, 'ARCHIVE', browser);
  }

  async restore(
    id: string,
    etag: string | undefined,
    browser: ProjectBrowserContext,
  ): Promise<ProjectView> {
    return this.transition(id, etag, 'RESTORE', browser);
  }

  private async transition(
    id: string,
    etag: string | undefined,
    action: 'ARCHIVE' | 'RESTORE',
    browser: ProjectBrowserContext,
  ): Promise<ProjectView> {
    const expected = expectedVersion(etag);
    return this.run(browser, true, async (actor, context) => {
      const target = await this.repository.lock(actor.id, id, context);
      if (!target) throw new ProjectError('NOT_FOUND');
      assertProjectVersion(target, expected);
      const status = projectStatusAfter(actor, target, action);
      // §17: repeated desired state is safe — it answers 200 and writes nothing.
      if (target.status === status) return projectView(target);
      const updated = await this.repository.setStatus(
        actor.id,
        id,
        status,
        this.clock.now(),
        context,
      );
      return projectView(updated);
    });
  }

  async remove(
    id: string,
    input: unknown,
    etag: string | undefined,
    browser: ProjectBrowserContext,
  ): Promise<void> {
    projectDeletionConfirmation(input);
    const expected = expectedVersion(etag);
    await this.run(browser, true, async (actor, context) => {
      const target = await this.repository.lock(actor.id, id, context);
      if (!target) throw new ProjectError('NOT_FOUND');
      assertProjectVersion(target, expected);
      const history = await this.repository.orderHistory(
        actor.id,
        id,
        context,
      );
      assertProjectDeletionEligible(actor, target, history);
      await this.repository.remove(actor.id, id, context);
    });
  }
}
