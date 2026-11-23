import { Inject, Injectable } from '@nestjs/common';
import {
  Transactions,
  type TransactionContext,
} from '../../../platform/database/application/transactions';
import { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import { ReadinessRepository } from '../application/readiness-repository';
import type { ProjectRecord } from '../application/project-repository';
import type { ReadinessMedia, ReadinessSnapshot } from '../domain/readiness';
import { sha256 } from '../application/prepare-target';
import { MINDAR_COMPILER, SOURCE_TRANSFORM } from './mindar-compiler';

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
            id: true,
            preparedAt: true,
            artifactBytes: true,
            artifactReference: true,
            adapterMetadata: true,
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
    const artifact = ar?.artifact;
    const metadata = artifact?.adapterMetadata;
    const source =
      ar &&
      media.get(
        months.find((month) => month.monthNumber === ar.monthNumber)
          ?.projectMonthMedia_month[0]?.assetId ?? '',
      );
    const reveal = ar && media.get(ar.revealAssetId);
    let proof = null;
    if (
      ar &&
      artifact?.status === 'READY' &&
      artifact.preparedAt &&
      artifact.sourceRevision === project.version &&
      artifact.artifactBytes?.length &&
      metadata &&
      typeof metadata === 'object' &&
      !Array.isArray(metadata) &&
      metadata.compiler === MINDAR_COMPILER &&
      metadata.transform === SOURCE_TRANSFORM &&
      source?.status === 'READY' &&
      source.verified &&
      source.hasStorage &&
      !source.deleted &&
      reveal?.status === 'READY' &&
      reveal.verified &&
      reveal.hasStorage &&
      !reveal.deleted &&
      metadata.monthNumber === ar.monthNumber &&
      metadata.sourceAssetId === source.id &&
      metadata.sourceContentVersion === source.contentVersion &&
      metadata.revealAssetId === reveal.id &&
      metadata.revealContentVersion === reveal.contentVersion &&
      typeof metadata.sourceDigest === 'string' &&
      /^[a-f0-9]{64}$/.test(metadata.sourceDigest) &&
      typeof metadata.pixelDigest === 'string' &&
      /^[a-f0-9]{64}$/.test(metadata.pixelDigest)
    ) {
      const artifactDigest = sha256(artifact.artifactBytes);
      if (
        artifact.artifactReference === `db:ar:${artifact.id}:${artifactDigest}`
      ) {
        proof = {
          artifactDigest,
          sourceDigest: metadata.sourceDigest,
          revealAssetId: reveal.id,
          revealContentVersion: reveal.contentVersion,
          fallback: null,
        };
      }
    }
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
            target: artifact
              ? {
                  projectId: artifact.projectId,
                  ownerId: artifact.ownerId,
                  sourceRevision: artifact.sourceRevision,
                  targetId: artifact.targetId,
                  status: artifact.status,
                  monthNumber: proof ? ar.monthNumber : null,
                  proof,
                }
              : null,
            mappingReview: null,
          }
        : null,
      review: null,
    };
  }
}
