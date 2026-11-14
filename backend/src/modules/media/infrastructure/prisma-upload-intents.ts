import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Transactions,
  type TransactionContext,
} from '../../../platform/database/application/transactions';
import { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import { IdentityError } from '../../identity/domain/identity';
import { UploadIntents } from '../application/upload-intake';
import type { MediaCategory } from '../domain/media';

const operation = 'INITIATE_MEDIA_UPLOAD';
const windowMs = 10 * 60_000;

export function retryableMediaTransaction(error: unknown): boolean {
  const e = error as {
    code?: string;
    meta?: {
      code?: string;
      driverAdapterError?: { cause?: { originalCode?: string } };
    };
  } | null;
  const sql = e?.meta?.code ?? e?.meta?.driverAdapterError?.cause?.originalCode;
  return (
    e?.code === 'P2002' ||
    e?.code === 'P2034' ||
    (e?.code === 'P2010' && (sql === '40001' || sql === '40P01'))
  );
}

@Injectable()
export class PrismaUploadIntents extends UploadIntents {
  private readonly limit: number;

  constructor(
    @Inject(Transactions) private readonly transactions: PrismaTransactions,
  ) {
    super();
    const configured = process.env.MEDIA_UPLOAD_INTENTS_PER_10_MINUTES ?? '5';
    const limit = Number(configured);
    if (!/^\d+$/.test(configured) || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
      throw new Error(
        'MEDIA_UPLOAD_INTENTS_PER_10_MINUTES must be an integer from 1 to 1000',
      );
    this.limit = limit;
  }
  async reserve(
    ownerId: string,
    key: string,
    digest: string,
    category: MediaCategory,
    now: Date,
    context: TransactionContext,
  ) {
    const client = this.transactions.clientFor(context);
    const replay = await client.idempotencyRecord.findUnique({
      where: { actorId_operation_key: { actorId: ownerId, operation, key } },
    });
    if (replay && replay.requestDigest !== digest)
      throw new IdentityError(
        'IDEMPOTENCY_CONFLICT',
        409,
        'errors.idempotencyConflict',
      );
    if (!replay) {
      // Use the durable intent itself as the debit. The predicate read and the
      // insert share the caller's Serializable transaction and retry boundary.
      const recent = await client.idempotencyRecord.findMany({
        where: {
          actorId: ownerId,
          operation,
          createdAt: { gt: new Date(now.getTime() - windowMs) },
        },
        orderBy: { createdAt: 'desc' },
        take: this.limit,
        select: { createdAt: true },
      });
      if (recent.length === this.limit) {
        const expiresAt = recent[this.limit - 1].createdAt.getTime() + windowMs;
        throw new IdentityError(
          'RATE_LIMITED', 429, 'errors.rateLimited', undefined, undefined,
          Math.ceil((expiresAt - now.getTime()) / 1000),
        );
      }
    }
    const asset = replay
      ? await client.mediaAsset.findFirst({
          where: { id: replay.resourceId ?? '', ownerId },
        })
      : await client.mediaAsset.create({
          data: {
            ownerId,
            category,
            uploadIntentId: randomUUID(),
            createdAt: now,
          },
        });
    if (!asset || asset.status !== 'PENDING')
      throw new IdentityError('CONFLICT', 409, 'errors.uploadIntentClosed');
    if (!replay)
      await client.idempotencyRecord.create({
        data: {
          actorId: ownerId,
          operation,
          key,
          requestDigest: digest,
          condition: 'COMPLETED',
          resourceType: 'MEDIA_ASSET',
          resourceId: asset.id,
          safeResult: { id: asset.id },
          createdAt: now,
        },
      });
    return {
      binding: {
        assetId: asset.id,
        ownerId,
        uploadIntentId: asset.uploadIntentId,
      },
      category: asset.category,
      createdAt: asset.createdAt,
    };
  }
  isRetryable(error: unknown): boolean {
    return retryableMediaTransaction(error);
  }
}
