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
  constructor(
    @Inject(Transactions) private readonly transactions: PrismaTransactions,
  ) {
    super();
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
