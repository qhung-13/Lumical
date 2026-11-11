import { Inject, Injectable } from '@nestjs/common';
import {
  Transactions,
  type TransactionContext,
} from '../../../platform/database/application/transactions';
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
  isRetryable(error: unknown) {
    return retryableMediaTransaction(error);
  }
}
