import { Inject, Injectable } from '@nestjs/common';
import {
  Transactions,
  type TransactionContext,
} from '../../../platform/database/application/transactions';
import { Prisma } from '../../../platform/database/infrastructure/generated/client';
import { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import { projectView, storedProjectView } from '../domain/project';
import {
  ProjectCreationRepository,
  type CreationIntent,
  type ProjectCreation,
} from '../application/project-creation-repository';

const operation = 'PROJECT_CREATE';
class ConcurrentCreationIntent extends Error {}

@Injectable()
export class PrismaProjectCreation extends ProjectCreationRepository {
  constructor(
    @Inject(Transactions) private readonly transactions: PrismaTransactions,
  ) {
    super();
  }

  async replay(intent: CreationIntent, context: TransactionContext) {
    const client = this.transactions.clientFor(context);
    const record = await client.idempotencyRecord.findUnique({
      where: { actorId_operation_key: { ...intent, operation } },
      select: {
        requestDigest: true,
        condition: true,
        resourceId: true,
        resourceType: true,
        safeResult: true,
      },
    });
    if (!record) return null;
    if (
      record.condition !== 'COMPLETED' ||
      record.resourceType !== 'CALENDAR_PROJECT' ||
      !record.resourceId
    )
      throw new Error('Invalid Project creation replay record.');
    // §11: the bound outcome is the stored body, re-validated before it can be
    // served; a Project that was edited, archived or deleted since does not
    // change the answer this intent gave the first time.
    const view = storedProjectView(record.safeResult);
    if (view.id !== record.resourceId)
      throw new Error('Invalid Project creation replay record.');
    return { digest: record.requestDigest, project: { id: record.resourceId, view } };
  }

  async create(
    input: ProjectCreation,
    intent: CreationIntent,
    digest: string,
    context: TransactionContext,
  ) {
    const client = this.transactions.clientFor(context);
    const { revision, ...root } = input;
    const project = await client.calendarProject.create({
      data: {
        ...root,
        templateRevisionId: revision.id,
        baselineNameVi: revision.name.vi,
        baselineNameEn: revision.name.en,
        baselineStyle: revision.layout,
        unitPriceMinor: BigInt(revision.price.unitPriceMinor),
        currency: revision.price.currency,
        calendarMonth_project: {
          createMany: {
            data: Array.from({ length: 12 }, (_, index) => ({
              monthNumber: index + 1,
            })),
          },
        },
      },
      select: {
        id: true,
        title: true,
        year: true,
        recipientName: true,
        status: true,
        version: true,
        stylePresetId: true,
        baselineNameVi: true,
        baselineNameEn: true,
        baselineStyle: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    // §11: the safe creation outcome is bound to the intent inside the same
    // transaction, so a replay answers with this body even after the Project was
    // edited, archived or deleted.
    const view = projectView(project);
    try {
      await client.idempotencyRecord.create({
        data: {
          ...intent,
          operation,
          requestDigest: digest,
          condition: 'COMPLETED',
          resourceType: 'CALENDAR_PROJECT',
          resourceId: project.id,
          safeResult: view as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConcurrentCreationIntent();
      throw error;
    }
    return { id: project.id, view };
  }

  isRetryable(error: unknown): boolean {
    if (error instanceof ConcurrentCreationIntent) return true;
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code === 'P2034') return true;
    // Prisma raw-query failures can carry the PostgreSQL code in adapter metadata.
    const adapter = error.meta?.driverAdapterError as
      { cause?: { originalCode?: string } } | undefined;
    const code = error.meta?.code ?? adapter?.cause?.originalCode;
    return error.code === 'P2010' && (code === '40001' || code === '40P01');
  }
}
