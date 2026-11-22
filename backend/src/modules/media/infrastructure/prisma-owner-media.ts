import { Inject, Injectable } from '@nestjs/common';
import {
  Transactions,
  type TransactionContext,
} from '../../../platform/database/application/transactions';
import { Prisma } from '../../../platform/database/infrastructure/generated/client';
import { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import { OwnerMediaRepository } from '../application/owner-media';
import { retryableMediaTransaction } from './prisma-upload-intents';

@Injectable()
export class PrismaOwnerMedia extends OwnerMediaRepository {
  constructor(
    @Inject(Transactions) private readonly transactions: PrismaTransactions,
  ) {
    super();
  }
  async find(id: string, ownerId: string, context: TransactionContext) {
    if (
      await this.transactions
        .clientFor(context)
        .jobRecord.findUnique({
          where: { operationIdentity: `MEDIA_DELETE:${id}` },
        })
    )
      return null;
    const asset = await this.transactions
      .clientFor(context)
      .mediaAsset.findFirst({ where: { id, ownerId, deletedAt: null } });
    return asset
      ? {
          binding: {
            assetId: asset.id,
            ownerId: asset.ownerId,
            uploadIntentId: asset.uploadIntentId,
          },
          category: asset.category,
          status: asset.status,
          storageKey: asset.storageReference,
          contentVersion: asset.contentVersion,
          verifiedBytes: asset.verifiedBytes,
          durationMs: asset.durationMs,
          contentType: asset.contentType,
        }
      : null;
  }
  async lockForAttachment(
    ownerId: string,
    ids: readonly string[],
    context: TransactionContext,
  ) {
    if (ids.length === 0) return [];
    return this.transactions.clientFor(context).$queryRaw<
      Awaited<ReturnType<OwnerMediaRepository['lockForAttachment']>>
    >`
      SELECT m.id, m.category::text AS category, m.status::text AS status
      FROM lumical.media_assets m
      WHERE m.owner_id = ${ownerId}::uuid
        AND m.id IN (${Prisma.join([...new Set(ids)].map(id => Prisma.sql`${id}::uuid`))})
        AND m.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM lumical.job_records j
          WHERE j.object_id = m.id AND j.kind = 'MEDIA_DELETE'
        )
      ORDER BY m.id
      FOR UPDATE OF m`;
  }

  isRetryable(error: unknown) {
    return retryableMediaTransaction(error);
  }
}
