import { Inject, Injectable } from '@nestjs/common';
import type { TransactionContext } from '../../../platform/database/application/transactions';
import { Transactions } from '../../../platform/database/application/transactions';
import { Prisma } from '../../../platform/database/infrastructure/generated/client';
import { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import type { ProjectOrderHistory, ProjectStatus } from '../domain/project';
import type {
  ProjectIdentityValues,
  ProjectListInput,
  ProjectMonthRecord,
  ProjectRecord,
} from '../application/project-repository';
import { ProjectRepository } from '../application/project-repository';

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

interface MonthRow {
  monthNumber: number;
  caption: string | null;
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

  async months(
    ownerId: string,
    id: string,
    context: TransactionContext,
  ): Promise<ProjectMonthRecord[]> {
    return this.client(context).$queryRaw<MonthRow[]>`
      SELECT m.month_number AS "monthNumber", m.caption
      FROM lumical.calendar_months m
      WHERE m.project_id = ${id}::uuid
        AND EXISTS (
          SELECT 1 FROM lumical.calendar_projects p
          WHERE p.id = m.project_id AND p.owner_id = ${ownerId}::uuid
        )
      ORDER BY m.month_number`;
  }
}
