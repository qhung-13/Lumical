import { Inject, Injectable } from '@nestjs/common';
import {
  Transactions,
  type TransactionContext,
} from '../../../platform/database/application/transactions';
import { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import { ReadinessRepository } from '../application/readiness-repository';
import type { ProjectRecord } from '../application/project-repository';
import type { ReadinessMedia, ReadinessSnapshot } from '../domain/readiness';

@Injectable()
export class PrismaReadinessRepository extends ReadinessRepository {
  constructor(
    @Inject(Transactions) private readonly transactions: PrismaTransactions,
  ) {
    super();
  }

  async read(
    project: ProjectRecord,
    context: TransactionContext,
  ): Promise<ReadinessSnapshot> {
    const client = this.transactions.clientFor(context);
    const { id: projectId, ownerId } = project;
    // SERIALIZABLE snapshot is established by ActiveAccounts before the root
    // read. Every following statement uses that same Prisma transaction client.
    const months = await client.calendarMonth.findMany({
      where: { projectId, project: { ownerId } },
      orderBy: { monthNumber: 'asc' },
      select: {
        monthNumber: true,
        projectMonthMedia_month: {
          where: { ownerId, projectId },
          orderBy: { position: 'asc' },
          select: { assetId: true },
        },
      },
    });
    const ar = await client.projectARExperience.findUnique({
      where: { projectId_ownerId: { projectId, ownerId } },
      select: {
        monthNumber: true,
        revealAssetId: true,
        readableText: true,
        sourceRevision: true,
        preparationStatus: true,
        artifact: {
          select: {
            projectId: true,
            ownerId: true,
            sourceRevision: true,
            targetId: true,
            status: true,
          },
        },
      },
    });
    const ids = [
      ...new Set([
        ...months.flatMap((m) =>
          m.projectMonthMedia_month.map((i) => i.assetId),
        ),
        ...(ar ? [ar.revealAssetId] : []),
      ]),
    ];
    const assets = ids.length
      ? await client.mediaAsset.findMany({
          where: { id: { in: ids }, ownerId, deletedAt: null },
          select: {
            id: true,
            ownerId: true,
            category: true,
            status: true,
            contentVersion: true,
            verifiedBytes: true,
            durationMs: true,
            contentType: true,
            verifiedAt: true,
            storageReference: true,
          },
        })
      : [];
    // Match the existing owner-media boundary: any deletion intent makes the
    // media unusable, including a claimed/pending purge still labelled READY.
    const deleting = ids.length
      ? await client.jobRecord.findMany({
          where: { kind: 'MEDIA_DELETE', objectId: { in: ids } },
          select: { objectId: true },
        })
      : [];
    const deletedIds = new Set(deleting.map((job) => job.objectId));
    const media = new Map<string, ReadinessMedia>(
      assets.map(({ verifiedAt, storageReference, ...asset }) => [
        asset.id,
        {
          ...asset,
          verified: verifiedAt !== null,
          hasStorage: !!storageReference?.trim(),
          deleted: deletedIds.has(asset.id),
        },
      ]),
    );
    return {
      project: {
        id: project.id,
        ownerId,
        version: project.version,
        status: project.status,
        year: project.year,
        title: project.title,
        recipientName: project.recipientName,
      },
      months: months.map((month) => ({
        monthNumber: month.monthNumber,
        images: month.projectMonthMedia_month.flatMap(({ assetId }) => {
          const image = media.get(assetId);
          return image ? [image] : [];
        }),
      })),
      ar: ar
        ? {
            monthNumber: ar.monthNumber,
            revealAssetId: ar.revealAssetId,
            readableText: ar.readableText,
            sourceRevision: ar.sourceRevision,
            status: ar.preparationStatus,
            reveal: media.get(ar.revealAssetId) ?? null,
            // No reviewed metadata/provenance verifier exists. A READY row, even
            // with reference/timestamp/adapterMetadata, must never become proof.
            target: ar.artifact
              ? { ...ar.artifact, monthNumber: null, proof: null }
              : null,
            mappingReview: null,
          }
        : null,
      review: null,
    };
  }
}
