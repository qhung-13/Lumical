import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Transactions,
  type TransactionContext,
} from '../../../platform/database/application/transactions';
import { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import type { Prisma } from '../../../platform/database/infrastructure/generated/client';
import { IdentityError } from '../../identity/domain/identity';
import {
  MediaCleanupRepository,
  type CleanupClaim,
  type CleanupOutcome,
} from '../application/media-cleanup';
import { retryableMediaTransaction } from './prisma-upload-intents';

const kind = 'MEDIA_DELETE';
const active = { notIn: ['COMPLETED', 'FAILED', 'CANCELLED'] };
@Injectable()
export class PrismaMediaCleanup extends MediaCleanupRepository {
  constructor(
    @Inject(Transactions) private readonly transactions: PrismaTransactions,
  ) {
    super();
  }
  private async atomic<T>(
    work: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.transactions.run((context) =>
          work(this.transactions.clientFor(context)),
        );
      } catch (error) {
        if (attempt >= 2 || !this.isRetryable(error)) throw error;
      }
    }
  }
  private async lock(client: Prisma.TransactionClient, id: string) {
    await client.$queryRaw`SELECT id FROM lumical.media_assets WHERE id=${id}::uuid FOR UPDATE`;
    return client.mediaAsset.findUnique({ where: { id } });
  }
  private async refs(client: Prisma.TransactionClient, id: string) {
    const [months, ar, history, jobs] = await Promise.all([
      client.projectMonthMedia.count({ where: { assetId: id } }),
      client.projectARExperience.count({ where: { revealAssetId: id } }),
      client.orderMediaReference.count({ where: { assetId: id } }),
      client.jobRecord.count({
        where: { objectId: id, kind: { not: kind }, condition: active },
      }),
    ]);
    return { current: months + ar, history, jobs };
  }
  private async enqueue(
    client: Prisma.TransactionClient,
    asset: { id: string; createdAt: Date },
    now: Date,
  ) {
    await client.mediaAsset.update({
      where: { id: asset.id },
      data: { status: 'UNAVAILABLE', deletedAt: now },
    });
    // No provider purge while a previously issued direct-upload signature can
    // still create bytes. The extra minute absorbs timestamp boundary skew.
    await client.jobRecord.create({
      data: {
        kind,
        objectId: asset.id,
        operationIdentity: `${kind}:${asset.id}`,
        condition: 'PENDING',
        dueAt: new Date(
          Math.max(now.getTime(), asset.createdAt.getTime() + 3_660_000),
        ),
      },
    });
  }
  async request(
    id: string,
    ownerId: string,
    now: Date,
    context: TransactionContext,
  ) {
    const client = this.transactions.clientFor(context);
    const asset = await this.lock(client, id);
    if (!asset || asset.ownerId !== ownerId)
      throw new IdentityError('NOT_FOUND', 404, 'errors.notFound');
    if (
      await client.jobRecord.findUnique({
        where: { operationIdentity: `${kind}:${id}` },
      })
    )
      return 'DELETED' as const;
    if (asset.deletedAt) return 'RETAINED' as const;
    const refs = await this.refs(client, id);
    if (refs.current || refs.jobs)
      throw new IdentityError('CONFLICT', 409, 'errors.mediaInUse');
    if (refs.history) {
      if (!asset.deletedAt)
        await client.mediaAsset.update({
          where: { id },
          data: { deletedAt: now },
        });
      return 'RETAINED' as const;
    }
    await this.enqueue(client, asset, now);
    return 'DELETED' as const;
  }
  async scan(now: Date, limit: number) {
    // Conservative failed/incomplete intake retention; Ready personal assets are
    // removed only by the owner's DELETE command, not an implicit library TTL.
    const cutoff = new Date(now.getTime() - 86_400_000);
    const ids = await this.atomic(
      async (client) => client.$queryRaw<Array<{ id: string }>>`
      SELECT m.id FROM lumical.media_assets m WHERE m.status IN ('PENDING','UNAVAILABLE') AND m.created_at<=${cutoff}
      AND NOT EXISTS (SELECT 1 FROM lumical.project_month_media r WHERE r.asset_id=m.id)
      AND NOT EXISTS (SELECT 1 FROM lumical.project_ar_experiences r WHERE r.reveal_asset_id=m.id)
      AND NOT EXISTS (SELECT 1 FROM lumical.order_media_references r WHERE r.asset_id=m.id)
      AND NOT EXISTS (SELECT 1 FROM lumical.job_records j WHERE j.object_id=m.id AND
        (j.kind='MEDIA_DELETE' OR j.condition NOT IN ('COMPLETED','FAILED','CANCELLED')))
      ORDER BY m.created_at,m.id LIMIT ${limit}`,
    );
    for (const { id } of ids)
      await this.atomic(async (client) => {
        const asset = await this.lock(client, id);
        if (
          !asset ||
          asset.status === 'READY' ||
          (await client.jobRecord.findUnique({
            where: { operationIdentity: `${kind}:${id}` },
          }))
        )
          return;
        const refs = await this.refs(client, id);
        if (!refs.current && !refs.history && !refs.jobs)
          await this.enqueue(client, asset, now);
      });
  }
  async claim(now: Date): Promise<CleanupClaim | null> {
    return this.atomic(async (client) => {
      const jobs = await client.jobRecord.findMany({
        where: {
          kind,
          dueAt: { lte: now },
          OR: [
            { condition: 'PENDING' },
            { condition: 'RUNNING', leaseUntil: { lte: now } },
          ],
        },
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take: 20,
      });
      for (const job of jobs) {
        const asset = await this.lock(client, job.objectId);
        if (!asset) continue;
        const fresh = await client.jobRecord.findUniqueOrThrow({
          where: { id: job.id },
        });
        if (fresh.dueAt > now) continue;
        if (
          fresh.condition !== 'PENDING' &&
          !(
            fresh.condition === 'RUNNING' &&
            fresh.leaseUntil &&
            fresh.leaseUntil <= now
          )
        )
          continue;
        if (fresh.attempts >= 5) {
          await client.jobRecord.update({
            where: { id: job.id },
            data: {
              condition: 'FAILED',
              claimedBy: null,
              leaseUntil: null,
              safeErrorCode: 'RETRY_EXHAUSTED',
            },
          });
          continue;
        }
        const refs = await this.refs(client, asset.id);
        if (refs.current || refs.history || refs.jobs) continue;
        const token = randomUUID();
        await client.jobRecord.update({
          where: { id: job.id },
          data: {
            condition: 'RUNNING',
            attempts: { increment: 1 },
            claimedBy: token,
            leaseUntil: new Date(now.getTime() + 120_000),
          },
        });
        const binding = {
          assetId: asset.id,
          ownerId: asset.ownerId,
          uploadIntentId: asset.uploadIntentId,
        };
        return {
          id: job.id,
          token,
          target: {
            // Signature expiry governs when a purge may start, but gives no
            // evidence that every direct upload accepted earlier has settled.
            binding,
            pinned: asset.storageReference !== null
              ? {
                  binding,
                  storageKey: asset.storageReference,
                  contentVersion: String(asset.contentVersion),
                }
              : null,
          },
        };
      }
      return null;
    });
  }
  async finish(
    claim: CleanupClaim,
    result: CleanupOutcome,
    now: Date,
  ) {
    await this.atomic(async (client) => {
      await this.lock(client, claim.target.binding.assetId);
      const job = await client.jobRecord.findUnique({
        where: { id: claim.id },
      });
      if (!job || job.claimedBy !== claim.token || job.condition !== 'RUNNING')
        return;
      const retry = result === 'RETRY' && job.attempts < 5;
      const condition = result === 'DELETED' ? 'COMPLETED' : retry ? 'PENDING' : 'FAILED';
      await client.jobRecord.update({
        where: { id: job.id },
        data: {
          condition,
          claimedBy: null,
          leaseUntil: null,
          ...(retry && {
            dueAt: new Date(
              now.getTime() + Math.min(3_600_000, 30_000 * 2 ** Math.min(job.attempts, 7)),
            ),
          }),
          safeErrorCode:
            result === 'DELETED'
              ? null
              : result === 'REJECTED'
                ? 'MEDIA_IDENTITY_MISMATCH'
                : result === 'DEFER_MISSING'
                  ? 'MEDIA_MISSING_UNCONFIRMED'
                  : result === 'DEFER_UNCONFIRMED'
                    ? 'MEDIA_DELETE_UNCONFIRMED'
                    : 'PROVIDER_UNAVAILABLE',
        },
      });
    });
  }
  isRetryable(error: unknown) {
    return retryableMediaTransaction(error);
  }
}
