import { Inject, Injectable } from '@nestjs/common';
import type { TransactionContext } from '../../../platform/database/application/transactions';
import { Transactions } from '../../../platform/database/application/transactions';
import { Prisma } from '../../../platform/database/infrastructure/generated/client';
import { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import type { ARWrite, EventWrite, MonthPatch } from '../domain/personalization';
import { ProjectError } from '../domain/project';
import type { ProjectOrderHistory, ProjectStatus } from '../domain/project';
import type {
  ProjectIdentityValues,
  ProjectIntent,
  ProjectIntentResult,
  ProjectListInput,
  ProjectMonthRecord,
  ProjectRecord,
} from '../application/project-repository';
import { ConcurrentProjectIntent, ProjectRepository } from '../application/project-repository';

interface ProjectRow {
  id: string;
  ownerId: string;
  status: ProjectStatus;
  version: number;
  title: string;
  year: number;
  recipientName: string;
  baselineNameVi: string;
  baselineNameEn: string;
  baselineStyle: unknown;
  stylePresetId: string;
  stylePresets: unknown;
  createdAt: Date;
  updatedAt: Date;
}

// The approved presets live on the captured revision, so one join reads both the
// Project and the baseline its edits must stay inside.
const COLUMNS = Prisma.sql`p.id, p.owner_id AS "ownerId", p.status::text AS "status", p.version,
  p.title, p.year, p.recipient_name AS "recipientName",
  p.baseline_name_vi AS "baselineNameVi", p.baseline_name_en AS "baselineNameEn",
  p.baseline_style AS "baselineStyle", p.style_preset_id AS "stylePresetId",
  r.style_presets AS "stylePresets", p.created_at AS "createdAt", p.updated_at AS "updatedAt"`;
const FROM = Prisma.sql`FROM lumical.calendar_projects p
  JOIN lumical.template_revisions r ON r.id = p.template_revision_id`;

function toRecord(row: ProjectRow): ProjectRecord {
  return { ...row };
}

@Injectable()
export class PrismaProjectRepository extends ProjectRepository {
  constructor(
    @Inject(Transactions) private readonly transactions: PrismaTransactions,
  ) {
    super();
  }

  private client(context: TransactionContext) {
    return this.transactions.clientFor(context);
  }

  // Owner scope is part of the WHERE clause, never a check applied afterwards,
  // so a foreign id produces no row instead of a 403 that confirms it exists.
  private async read(
    ownerId: string,
    id: string,
    context: TransactionContext,
    locking: boolean,
  ): Promise<ProjectRecord | null> {
    const rows = await this.client(context).$queryRaw<ProjectRow[]>`
      SELECT ${COLUMNS} ${FROM}
      WHERE p.id = ${id}::uuid AND p.owner_id = ${ownerId}::uuid
      ${locking ? Prisma.sql`FOR UPDATE OF p` : Prisma.empty}`;
    return rows[0] ? toRecord(rows[0]) : null;
  }

  find(ownerId: string, id: string, context: TransactionContext) {
    return this.read(ownerId, id, context, false);
  }

  lock(ownerId: string, id: string, context: TransactionContext) {
    return this.read(ownerId, id, context, true);
  }

  async list(
    ownerId: string,
    input: ProjectListInput,
    context: TransactionContext,
  ): Promise<ProjectRecord[]> {
    const filters = [Prisma.sql`p.owner_id = ${ownerId}::uuid`];
    if (input.state)
      filters.push(
        Prisma.sql`p.status = ${input.state}::lumical.project_status`,
      );
    // API contract §7: timestamp ordering with an id tie-break, so the cursor
    // pair always decides which rows fall on the next page.
    if (input.after)
      filters.push(
        Prisma.sql`(p.created_at, p.id) < (${input.after.createdAt}::timestamptz, ${input.after.id}::uuid)`,
      );
    const rows = await this.client(context).$queryRaw<ProjectRow[]>`
      SELECT ${COLUMNS} ${FROM}
      WHERE ${Prisma.join(filters, ' AND ')}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${input.take}`;
    return rows.map(toRecord);
  }

  async patch(
    ownerId: string,
    id: string,
    values: ProjectIdentityValues,
    now: Date,
    context: TransactionContext,
  ): Promise<ProjectRecord> {
    await this.client(context).calendarProject.update({
      where: { id_ownerId: { id, ownerId } },
      data: {
        ...(values.title !== undefined ? { title: values.title } : {}),
        ...(values.recipientName !== undefined
          ? { recipientName: values.recipientName }
          : {}),
        ...(values.stylePresetId !== undefined
          ? { stylePresetId: values.stylePresetId }
          : {}),
        // §12: every Project change advances the one version child edits compare against.
        version: { increment: 1 },
        updatedAt: now,
      },
    });
    return this.require(ownerId, id, context);
  }

  async setStatus(
    ownerId: string,
    id: string,
    status: ProjectStatus,
    now: Date,
    context: TransactionContext,
  ): Promise<ProjectRecord> {
    await this.client(context).calendarProject.update({
      where: { id_ownerId: { id, ownerId } },
      data: { status, version: { increment: 1 }, updatedAt: now },
    });
    return this.require(ownerId, id, context);
  }

  private async require(
    ownerId: string,
    id: string,
    context: TransactionContext,
  ): Promise<ProjectRecord> {
    const record = await this.find(ownerId, id, context);
    // Unreachable: the row was locked and updated in this same transaction.
    if (!record) throw new Error('Updated Project is no longer readable.');
    return record;
  }

  async remove(
    ownerId: string,
    id: string,
    context: TransactionContext,
  ): Promise<void> {
    const client = this.client(context);
    // Every foreign key into these rows is Restrict, so project-scoped children
    // go first, deepest relation first. Media assets stay with the account.
    await this.cancelARPreparation(client, id);
    await client.projectARExperience.deleteMany({
      where: { projectId: id, ownerId },
    });
    await client.aRTargetArtifact.deleteMany({ where: { projectId: id, ownerId } });
    await client.projectMonthMedia.deleteMany({ where: { projectId: id, ownerId } });
    await client.specialDate.deleteMany({ where: { projectId: id } });
    await client.calendarMonth.deleteMany({ where: { projectId: id } });
    // checkout_intents is deliberately absent: it is financial history the
    // runtime role may only UPDATE (released_at) and §11 keeps through the
    // semester. An intent is written together with its Order (BR-ORD-003), and
    // any Order already refuses this command with 409 above, so no intent row is
    // reachable here. Its Restrict foreign key aborts the statement instead of
    // ever orphaning the record.
    await client.calendarProject.deleteMany({ where: { id, ownerId } });
  }

  async orderHistory(
    ownerId: string,
    id: string,
    context: TransactionContext,
  ): Promise<ProjectOrderHistory> {
    const rows = await this.client(context).$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM lumical.orders o
        WHERE o.project_id = ${id}::uuid AND o.owner_id = ${ownerId}::uuid
      ) AS "exists"`;
    // Trusted history covers every Order ever placed, cancelled or closed.
    return rows[0]?.exists ? 'HAS_ORDERS' : 'NEVER_ORDERED';
  }

  async advanceVersion(project: ProjectRecord, now: Date, context: TransactionContext) {
    const { version } = await this.client(context).calendarProject.update({
      where: { id_ownerId: { id: project.id, ownerId: project.ownerId } },
      data: { version: { increment: 1 }, updatedAt: now },
      select: { version: true },
    });
    return version;
  }

  async replaceMonth(
    project: ProjectRecord, number: number, patch: MonthPatch, context: TransactionContext,
  ) {
    const client = this.client(context);
    const { id: projectId, ownerId } = project;
    const month = await client.calendarMonth.findUnique({
      where: { projectId_monthNumber: { projectId, monthNumber: number } },
      select: { id: true },
    });
    if (!month) throw new ProjectError('NOT_FOUND');

    await client.calendarMonth.update({ where: { id: month.id }, data: { caption: patch.caption } });
    await client.projectMonthMedia.deleteMany({ where: { projectId, ownerId, monthId: month.id } });
    if (patch.images.length > 0) {
      await client.projectMonthMedia.createMany({
        data: patch.images.map(({ assetId, altText }, position) => ({
          projectId, ownerId, monthId: month.id, assetId, altText, position,
        })),
      });
    }
    return { monthNumber: number, ...patch };
  }

  async specialDates(project: ProjectRecord, context: TransactionContext) {
    const rows = await this.client(context).specialDate.findMany({
      where: { projectId: project.id },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
      select: { id: true, eventDate: true, title: true, note: true },
    });
    return rows.map(({ eventDate, ...row }) => ({ ...row, date: eventDate.toISOString().slice(0, 10) }));
  }

  async saveSpecialDate(project: ProjectRecord, input: EventWrite, id: string | undefined, context: TransactionContext) {
    const { date, ...text } = input;
    // Prisma represents a PostgreSQL DATE as DateTime. UTC midnight here is
    // only a transport encoding for the civil date validated by the domain.
    const data = { ...text, eventDate: new Date(date + 'T00:00:00.000Z') };
    const client = this.client(context);
    if (id === undefined) {
      const event = await client.specialDate.create({
        data: { ...data, projectId: project.id }, select: { id: true },
      });
      return event.id;
    }
    const updated = await client.specialDate.updateMany({ where: { id, projectId: project.id }, data });
    if (updated.count === 0) throw new ProjectError('NOT_FOUND');
    return id.toLowerCase();
  }

  async deleteSpecialDate(project: ProjectRecord, id: string, context: TransactionContext) {
    const removed = await this.client(context).specialDate.deleteMany({ where: { id, projectId: project.id } });
    if (removed.count === 0) throw new ProjectError('NOT_FOUND');
  }

  async saveAR(project: ProjectRecord, input: ARWrite, now: Date, context: TransactionContext) {
    const client = this.client(context);
    const { id: projectId, ownerId } = project;
    const month = await client.calendarMonth.findUnique({
      where: { projectId_monthNumber: { projectId, monthNumber: input.monthNumber } },
      select: { id: true },
    });
    if (!month) throw new ProjectError('NOT_FOUND');

    const projectVersion = await this.advanceVersion(project, now, context);
    const data = { ...input, sourceRevision: projectVersion, preparationStatus: 'PREPARING' as const, targetArtifactId: null };
    const config = await client.projectARExperience.upsert({
      where: { projectId_ownerId: { projectId, ownerId } },
      create: { ...data, projectId, ownerId }, update: data, select: { id: true },
    });
    await this.cancelARPreparation(client, projectId, now);
    // Transactional handoff: the poller can see the intent only after commit.
    await client.jobRecord.create({ data: {
      kind: 'AR_PREPARE',
      objectId: projectId,
      operationIdentity: `AR_PREPARE:${projectId}:${projectVersion}`,
      condition: 'PENDING',
      dueAt: now,
    }});
    return { resourceId: config.id, projectVersion };
  }

  private async cancelARPreparation(client: Prisma.TransactionClient, projectId: string, now?: Date) {
    await client.jobRecord.updateMany({
      where: { kind: 'AR_PREPARE', objectId: projectId, condition: 'PENDING' },
      data: { condition: 'CANCELLED', ...(now && { updatedAt: now }) },
    });
  }

  async deleteAR(project: ProjectRecord, now: Date, context: TransactionContext) {
    const client = this.client(context);
    const removed = await client.projectARExperience.deleteMany({
      where: { projectId: project.id, ownerId: project.ownerId },
    });
    if (removed.count > 0) await this.cancelARPreparation(client, project.id, now);
    return removed.count > 0;
  }

  async replayIntent(intent: ProjectIntent, context: TransactionContext) {
    const record = await this.client(context).idempotencyRecord.findUnique({
      where: { actorId_operation_key: intent },
      select: { requestDigest: true, condition: true, resourceId: true, safeResult: true },
    });
    if (!record) return null;
    const result = record.safeResult;
    if (record.condition !== 'COMPLETED' || !record.resourceId ||
        !result || typeof result !== 'object' || Array.isArray(result) ||
        typeof result.projectVersion !== 'number' || !Number.isSafeInteger(result.projectVersion) ||
        result.projectVersion < 1) {
      throw new Error('Invalid Project mutation replay record.');
    }
    // The request digest authenticates the normalized input. Persist only the
    // resource ID and original version to reconstruct the successful response.
    return { digest: record.requestDigest, resourceId: record.resourceId, projectVersion: result.projectVersion };
  }

  async completeIntent(intent: ProjectIntent, digest: string, result: ProjectIntentResult, context: TransactionContext) {
    try {
      await this.client(context).idempotencyRecord.create({ data: {
        ...intent,
        requestDigest: digest,
        condition: 'COMPLETED',
        resourceType: intent.operation === 'SPECIAL_DATE_CREATE' ? 'SPECIAL_DATE' : 'PROJECT_AR_EXPERIENCE',
        resourceId: result.resourceId,
        safeResult: { projectVersion: result.projectVersion },
      }});
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConcurrentProjectIntent();
      throw error;
    }
  }

  async months(
    ownerId: string,
    id: string,
    context: TransactionContext,
  ): Promise<ProjectMonthRecord[]> {
    const months = await this.client(context).calendarMonth.findMany({
      where: { projectId: id, project: { ownerId } },
      orderBy: { monthNumber: 'asc' },
      select: {
        monthNumber: true,
        caption: true,
        projectMonthMedia_month: {
          orderBy: { position: 'asc' },
          select: { assetId: true, altText: true },
        },
      },
    });
    return months.map(({ projectMonthMedia_month, ...month }) => ({
      ...month,
      images: projectMonthMedia_month.map(image => ({ ...image, crop: null })),
    }));
  }
}
