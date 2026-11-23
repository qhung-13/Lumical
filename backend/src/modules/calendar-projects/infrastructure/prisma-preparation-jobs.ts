import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  Transactions,
  type TransactionContext,
} from '../../../platform/database/application/transactions';
import type { Prisma } from '../../../platform/database/infrastructure/generated/client';
import { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import { OwnerMediaRepository } from '../../media/application/owner-media';
import { MEDIA_LIMITS } from '../../media/domain/media';
import {
  AR_PREPARE,
  MAX_PREPARATION_ATTEMPTS,
  PREPARATION_LEASE_MS,
  PreparationJobs,
  sha256,
  type PreparationClaim,
  type PreparationOutcome,
  type PreparationSource,
} from '../application/prepare-target';
import { MINDAR_COMPILER, SOURCE_TRANSFORM } from './mindar-compiler';

@Injectable()
export class PrismaPreparationJobs extends PreparationJobs {
  constructor(
    @Inject(Transactions) private readonly transactions: PrismaTransactions,
    @Inject(OwnerMediaRepository) private readonly media: OwnerMediaRepository,
  ) {
    super();
  }

  private async atomic<T>(
    work: (
      db: Prisma.TransactionClient,
      context: TransactionContext,
    ) => Promise<T>,
  ) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.transactions.run((context) =>
          work(this.transactions.clientFor(context), context),
        );
      } catch (error) {
        if (attempt >= 2 || !this.media.isRetryable(error)) throw error;
      }
    }
  }

  claim() {
    return this.atomic(async (db) => {
      const now = new Date();
      const [job] = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM lumical.job_records
        WHERE kind = ${AR_PREPARE} AND condition = 'PENDING' AND due_at <= ${now}
          AND (lease_until IS NULL OR lease_until <= ${now})
        ORDER BY due_at, id LIMIT 1 FOR UPDATE SKIP LOCKED
      `;
      if (!job) return null;
      const claimedBy = randomUUID();
      const claim = await db.jobRecord.update({
        where: { id: job.id },
        data: {
          claimedBy,
          leaseUntil: new Date(now.getTime() + PREPARATION_LEASE_MS),
          attempts: { increment: 1 },
        },
        select: {
          id: true,
          objectId: true,
          operationIdentity: true,
          attempts: true,
        },
      });
      return { ...claim, claimedBy };
    });
  }

  source(claim: PreparationClaim) {
    return this.atomic((db, context) => this.current(db, context, claim));
  }

  private async current(
    db: Prisma.TransactionClient,
    context: TransactionContext,
    claim: PreparationClaim,
  ) {
    const project = await db.calendarProject.findUnique({
      where: { id: claim.objectId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        version: true,
        owner: { select: { status: true } },
        projectARExperience_project: true,
      },
    });
    const ar = project?.projectARExperience_project;
    if (
      !project ||
      !ar ||
      project.status !== 'WORKING' ||
      project.owner.status !== 'ACTIVE' ||
      ar.preparationStatus !== 'PREPARING' ||
      ar.targetArtifactId ||
      ar.sourceRevision !== project.version ||
      claim.operationIdentity !==
        `${AR_PREPARE}:${project.id}:${project.version}`
    )
      return null;

    const image = await db.projectMonthMedia.findFirst({
      where: {
        projectId: project.id,
        ownerId: project.ownerId,
        month: { monthNumber: ar.monthNumber },
        position: 0,
      },
      select: { assetId: true, crop: true },
    });
    if (!image || image.crop !== null) return 'INVALID' as const;
    const [source, reveal] = await Promise.all([
      this.media.find(image.assetId, project.ownerId, context),
      this.media.find(ar.revealAssetId, project.ownerId, context),
    ]);
    if (
      !source ||
      source.status !== 'READY' ||
      source.category !== 'IMAGE' ||
      !source.storageKey ||
      !source.verifiedBytes ||
      source.verifiedBytes > MEDIA_LIMITS.IMAGE.maxBytes ||
      !source.contentType ||
      !reveal ||
      reveal.status !== 'READY' ||
      !reveal.storageKey ||
      !reveal.verifiedBytes ||
      !reveal.contentType
    )
      return 'INVALID' as const;
    return {
      projectId: project.id,
      ownerId: project.ownerId,
      revision: project.version,
      monthNumber: ar.monthNumber,
      source: {
        ...source,
        storageKey: source.storageKey,
        verifiedBytes: source.verifiedBytes,
      },
      revealAssetId: ar.revealAssetId,
      revealContentVersion: reveal.contentVersion,
    } satisfies PreparationSource;
  }

  async finish(claim: PreparationClaim, outcome: PreparationOutcome) {
    await this.atomic(async (db, context) => {
      // Owner edits and publication take the same root lock before touching AR or jobs.
      await db.$queryRaw`SELECT id FROM lumical.calendar_projects WHERE id = ${claim.objectId}::uuid FOR UPDATE`;
      const now = new Date();
      const lease = await db.jobRecord.updateMany({
        where: {
          id: claim.id,
          condition: 'PENDING',
          claimedBy: claim.claimedBy,
          leaseUntil: { gt: now },
        },
        data: { claimedBy: null, leaseUntil: null },
      });
      if (!lease.count) return;
      const source = await this.current(db, context, claim);
      const stale =
        source === null ||
        outcome.kind === 'STALE' ||
        (outcome.kind === 'READY' &&
          !isDeepStrictEqual(source, outcome.target.source));
      let condition = 'CANCELLED';
      let safeErrorCode: string | null = 'AR_SOURCE_STALE';
      let dueAt = now;
      if (!stale) {
        if (outcome.kind === 'READY') {
          const artifact = await this.publish(db, outcome.target, now);
          await db.projectARExperience.update({
            where: { projectId: claim.objectId },
            data: { preparationStatus: 'READY', targetArtifactId: artifact.id },
          });
          condition = 'COMPLETED';
          safeErrorCode = null;
        } else if (
          outcome.kind === 'RETRY' &&
          source !== 'INVALID' &&
          claim.attempts < MAX_PREPARATION_ATTEMPTS
        ) {
          condition = 'PENDING';
          safeErrorCode = 'AR_PREPARATION_RETRY';
          dueAt = new Date(now.getTime() + 15_000 * 2 ** (claim.attempts - 1));
        } else {
          condition = 'FAILED';
          safeErrorCode = 'AR_PREPARATION_UNAVAILABLE';
          await db.projectARExperience.update({
            where: { projectId: claim.objectId },
            data: { preparationStatus: 'UNAVAILABLE' },
          });
        }
      }
      await db.jobRecord.update({
        where: { id: claim.id },
        data: { condition, safeErrorCode, dueAt },
      });
    });
  }

  private publish(
    db: Prisma.TransactionClient,
    target: Extract<PreparationOutcome, { kind: 'READY' }>['target'],
    now: Date,
  ) {
    const { source, bytes, sourceDigest, pixelDigest } = target;
    const id = randomUUID();
    return db.aRTargetArtifact.create({
      data: {
        id,
        projectId: source.projectId,
        ownerId: source.ownerId,
        sourceRevision: source.revision,
        status: 'READY',
        preparedAt: now,
        artifactBytes: Uint8Array.from(bytes),
        artifactReference: `db:ar:${id}:${sha256(bytes)}`,
        adapterMetadata: {
          compiler: MINDAR_COMPILER,
          transform: SOURCE_TRANSFORM,
          monthNumber: source.monthNumber,
          sourceDigest,
          pixelDigest,
          sourceAssetId: source.source.binding.assetId,
          sourceContentVersion: source.source.contentVersion,
          revealAssetId: source.revealAssetId,
          revealContentVersion: source.revealContentVersion,
        },
      },
      select: { id: true },
    });
  }
}
