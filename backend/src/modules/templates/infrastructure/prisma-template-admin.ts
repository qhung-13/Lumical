import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../platform/database/infrastructure/generated/client';
import { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import { Transactions, type TransactionContext } from '../../../platform/database/application/transactions';
import type { PublicTemplateRecord, TemplateCategory } from '../domain/template-catalog';
import { storedPresets } from '../domain/template-admin';
import type { TemplateAdminState, TemplateAvailability, TemplateRevisionInput } from '../domain/template-admin';
import { TemplateAdminRepository } from '../application/ports';
import type { CreateTemplateInput, IdempotencyInput, PublishResult, ReplayEvidence, TemplateAuditInput } from '../application/ports';

interface TemplateRow {
  id: string; category: TemplateCategory; availability: TemplateAvailability; version: number;
  currentPublishedRevisionId: string | null; createdAt: Date;
  revisionId: string | null; revisionTemplateId: string | null; revision: number | null;
  nameVi: string | null; nameEn: string | null; descriptionVi: string | null; descriptionEn: string | null;
  layoutDefinition: unknown; stylePresets: unknown; unitPriceMinor: bigint | null; currency: string | null; publishedAt: Date | null;
}

// `FOR UPDATE OF t` locks the template row only: revisions are immutable, so locking their rows
// would add contention without protecting anything.
const LOCKED = Prisma.sql`FOR UPDATE OF t`;
const COLUMNS = Prisma.sql`t.id, t.category, t.availability, t.version, t.created_at AS "createdAt",
  t.current_published_revision_id AS "currentPublishedRevisionId",
  r.id AS "revisionId", r.template_id AS "revisionTemplateId", r.revision,
  r.name_vi AS "nameVi", r.name_en AS "nameEn", r.description_vi AS "descriptionVi", r.description_en AS "descriptionEn",
  r.layout_definition AS "layoutDefinition", r.style_presets AS "stylePresets",
  r.unit_price_minor AS "unitPriceMinor", r.currency, r.published_at AS "publishedAt"`;
const FROM = Prisma.sql`FROM lumical.templates t
  LEFT JOIN lumical.template_revisions r ON r.id = t.current_published_revision_id AND r.template_id = t.id`;

function toState(row: TemplateRow): TemplateAdminState {
  return { id: row.id, category: row.category, availability: row.availability, version: row.version,
    currentPublishedRevisionId: row.currentPublishedRevisionId, published: publishedRecord(row), createdAt: row.createdAt };
}

@Injectable()
export class PrismaTemplateAdminRepository extends TemplateAdminRepository {
  constructor(@Inject(Transactions) private readonly transactions: PrismaTransactions) { super(); }
  private client(context: TransactionContext) { return this.transactions.clientFor(context); }

  private async state(client: Prisma.TransactionClient, id: string, locking: boolean): Promise<TemplateAdminState | null> {
    const rows = await client.$queryRaw<TemplateRow[]>`SELECT ${COLUMNS} ${FROM}
      WHERE t.id = ${id}::uuid ${locking ? LOCKED : Prisma.empty}`;
    const row = rows[0];
    return row ? toState(row) : null;
  }

  async lock(id: string, context: TransactionContext) { return this.state(this.client(context), id, true); }

  async list(input: { state?: TemplateAvailability; after?: { createdAt: Date; id: string }; take: number },
    context: TransactionContext): Promise<TemplateAdminState[]> {
    const filters = [Prisma.sql`TRUE`];
    if (input.state) filters.push(Prisma.sql`t.availability = ${input.state}::lumical.template_availability`);
    // API contract §7: timestamp ordering with an id tie-break, so the cursor pair always decides.
    if (input.after) filters.push(Prisma.sql`(t.created_at, t.id) < (${input.after.createdAt}::timestamptz, ${input.after.id}::uuid)`);
    const rows = await this.client(context).$queryRaw<TemplateRow[]>`SELECT ${COLUMNS} ${FROM}
      WHERE ${Prisma.join(filters, ' AND ')}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${input.take}`;
    return rows.map(toState);
  }

  private async revision(client: Prisma.TransactionClient, templateId: string, number: number, value: TemplateRevisionInput, publishedAt: Date) {
    return client.templateRevision.create({ data: {
      templateId, revision: number,
      nameVi: value.name.vi, nameEn: value.name.en, descriptionVi: value.description.vi, descriptionEn: value.description.en,
      layoutDefinition: value.layout as unknown as Prisma.InputJsonValue, stylePresets: storedPresets(value.presets) as unknown as Prisma.InputJsonValue,
      unitPriceMinor: value.price.unitPriceMinor, currency: value.price.currency, publishedAt,
    } });
  }

  async create(input: CreateTemplateInput, context: TransactionContext): Promise<{ id: string; revision: PublishResult }> {
    const client = this.client(context);
    // `id` is also a scalar of the composite published-revision foreign key, so Prisma sends it
    // as null instead of applying @default(uuid()); this write has to supply the identity itself.
    const template = await client.template.create({ data: { id: randomUUID(), category: input.category, availability: 'INACTIVE' } });
    // A Template with no revision cannot be named, priced or served, so creation carries revision 1.
    const created = await this.revision(client, template.id, 1, input.revision, input.now);
    await client.template.update({ where: { id: template.id }, data: { currentPublishedRevisionId: created.id } });
    return { id: template.id, revision: { revisionId: created.id, revision: created.revision } };
  }

  async publish(id: string, input: Omit<CreateTemplateInput, 'category'>, context: TransactionContext): Promise<PublishResult> {
    const client = this.client(context);
    // `@@unique([templateId, revision])` backstops this read inside the same serializable transaction.
    const highest = await client.templateRevision.aggregate({ where: { templateId: id }, _max: { revision: true } });
    const number = (highest._max.revision ?? 0) + 1;
    const created = await this.revision(client, id, number, input.revision, input.now);
    // The pointer moves; the previously published row is untouched and stays servable as history.
    await client.template.update({ where: { id }, data: { currentPublishedRevisionId: created.id, version: { increment: 1 } } });
    return { revisionId: created.id, revision: created.revision };
  }

  async setAvailability(id: string, availability: TemplateAvailability, now: Date, context: TransactionContext) {
    await this.client(context).template.update({ where: { id }, data: { availability, version: { increment: 1 }, updatedAt: now } });
  }

  async audit(input: TemplateAuditInput, context: TransactionContext) {
    await this.client(context).adminAuditEvent.create({ data: { actorId: input.actorId, action: input.action,
      targetType: 'TEMPLATE', targetId: input.targetId, outcome: input.outcome, purpose: input.purpose,
      correlationId: input.correlationId, createdAt: input.now } });
  }

  async replay(actorId: string, operation: string, key: string, context: TransactionContext): Promise<ReplayEvidence | null> {
    const value = await this.client(context).idempotencyRecord.findUnique({
      where: { actorId_operation_key: { actorId, operation, key } } });
    return value ? { requestDigest: value.requestDigest, safeResult: value.safeResult } : null;
  }

  async saveReplay(input: IdempotencyInput, context: TransactionContext) {
    // Availability actions are rare and the safe body carries no secret, so the record is kept
    // permanently: expiring it would either re-execute a duplicate publication or reject an
    // otherwise valid retry.
    await this.client(context).idempotencyRecord.create({ data: { actorId: input.actorId, operation: input.operation,
      key: input.key, requestDigest: input.requestDigest, condition: 'COMPLETED', resourceType: 'TEMPLATE',
      resourceId: input.targetId, safeResult: input.safeResult as Prisma.InputJsonValue, createdAt: input.now } });
  }
}

function publishedRecord(row: TemplateRow): PublicTemplateRecord | null {
  if (!row.revisionId || !row.revisionTemplateId || row.revision === null || !row.nameVi || !row.nameEn ||
      !row.descriptionVi || !row.descriptionEn || row.unitPriceMinor === null || !row.currency || !row.publishedAt) return null;
  return { id: row.id, category: row.category, revision: {
    id: row.revisionId, templateId: row.revisionTemplateId, revision: row.revision,
    nameVi: row.nameVi, nameEn: row.nameEn, descriptionVi: row.descriptionVi, descriptionEn: row.descriptionEn,
    layoutDefinition: row.layoutDefinition, stylePresets: row.stylePresets,
    unitPriceMinor: row.unitPriceMinor, currency: row.currency, publishedAt: row.publishedAt,
  } };
}
