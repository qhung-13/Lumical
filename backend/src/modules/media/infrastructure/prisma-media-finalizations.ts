import { Inject, Injectable } from '@nestjs/common';
import {
  Transactions,
  type TransactionContext,
} from '../../../platform/database/application/transactions';
import { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import { IdentityError } from '../../identity/domain/identity';
import {
  MediaFinalizations,
  type FinalizationAsset,
  type FinalizationIntent,
  type MediaView,
} from '../application/finalize-media';
import type { VerifiedMediaFacts } from '../domain/media';
import { retryableMediaTransaction } from './prisma-upload-intents';

const operation = 'FINALIZE_MEDIA_UPLOAD';
@Injectable()
export class PrismaMediaFinalizations extends MediaFinalizations {
  constructor(
    @Inject(Transactions) private readonly transactions: PrismaTransactions,
  ) {
    super();
  }
  async begin(
    id: string,
    intent: FinalizationIntent,
    context: TransactionContext,
  ): Promise<FinalizationAsset> {
    const client = this.transactions.clientFor(context);
    if (
      await client.jobRecord.findUnique({
        where: { operationIdentity: `MEDIA_DELETE:${id}` },
      })
    )
      throw new IdentityError('NOT_FOUND', 404, 'errors.notFound');
    const rows = await client.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM lumical.media_assets WHERE id=${id}::uuid AND owner_id=${intent.ownerId}::uuid FOR UPDATE`;
    if (!rows.length)
      throw new IdentityError('NOT_FOUND', 404, 'errors.notFound');
    const asset = await client.mediaAsset.findUniqueOrThrow({ where: { id } });
    if (asset.deletedAt) throw new IdentityError('NOT_FOUND', 404, 'errors.notFound');
    const replay = await client.idempotencyRecord.findUnique({
      where: {
        actorId_operation_key: {
          actorId: intent.ownerId,
          operation,
          key: intent.key,
        },
      },
    });
    if (
      replay &&
      (replay.requestDigest !== intent.digest || replay.resourceId !== id)
    )
      throw new IdentityError(
        'IDEMPOTENCY_CONFLICT',
        409,
        'errors.idempotencyConflict',
      );
    if (!replay)
      await client.idempotencyRecord.create({
        data: {
          actorId: intent.ownerId,
          operation,
          key: intent.key,
          requestDigest: intent.digest,
          condition: 'PENDING',
          resourceType: 'MEDIA_ASSET',
          resourceId: id,
        },
      });
    return {
      binding: {
        assetId: id,
        ownerId: asset.ownerId,
        uploadIntentId: asset.uploadIntentId,
      },
      category: asset.category,
      status: asset.status,
      storageKey: asset.storageReference,
      contentVersion: asset.contentVersion,
      verifiedBytes: asset.verifiedBytes,
      durationMs: asset.durationMs,
      ...(replay?.safeResult &&
      typeof replay.safeResult === 'object' &&
      !Array.isArray(replay.safeResult) &&
      (replay.safeResult.error === 'CONFLICT' ||
        replay.safeResult.error === 'INVALID_CONTENT')
        ? { rejection: replay.safeResult.error }
        : {}),
    };
  }
  async ready(
    asset: FinalizationAsset,
    facts: VerifiedMediaFacts,
    now: Date,
    context: TransactionContext,
  ) {
    const durationMs =
      facts.durationSeconds === null
        ? null
        : Math.ceil(facts.durationSeconds * 1000);
    const contentVersion = Number(facts.object.contentVersion);
    await this.transactions.clientFor(context).mediaAsset.update({
      where: { id: asset.binding.assetId },
      data: {
        status: 'READY',
        storageReference: facts.object.storageKey,
        contentVersion,
        verifiedBytes: facts.bytes,
        durationMs,
        contentType: facts.contentType,
        verifiedAt: now,
      },
    });
    return {
      ...asset,
      status: 'READY' as const,
      storageKey: facts.object.storageKey,
      contentVersion,
      verifiedBytes: facts.bytes,
      durationMs,
    };
  }
  async reject(
    asset: FinalizationAsset,
    intent: FinalizationIntent,
    reason: 'INVALID_CONTENT' | 'CONFLICT',
    context: TransactionContext,
  ) {
    await this.transactions.clientFor(context).mediaAsset.update({
      where: { id: asset.binding.assetId },
      data: { status: 'UNAVAILABLE' },
    });
    await this.transactions.clientFor(context).idempotencyRecord.update({
      where: {
        actorId_operation_key: {
          actorId: intent.ownerId,
          operation,
          key: intent.key,
        },
      },
      data: { condition: 'COMPLETED', safeResult: { error: reason } },
    });
  }
  async complete(
    intent: FinalizationIntent,
    result: MediaView,
    context: TransactionContext,
  ) {
    const where = {
      actorId_operation_key: {
        actorId: intent.ownerId,
        operation,
        key: intent.key,
      },
    };
    const record = await this.transactions
      .clientFor(context)
      .idempotencyRecord.findUniqueOrThrow({ where });
    // Successful replay is read-only: identical writes would cause needless
    // Serializable conflicts among concurrent finalizers.
    if (record.condition === 'COMPLETED') return;
    await this.transactions.clientFor(context).idempotencyRecord.update({
      where,
      data: { condition: 'COMPLETED', safeResult: { ...result } },
    });
  }
  isRetryable(error: unknown) {
    return retryableMediaTransaction(error);
  }
}
