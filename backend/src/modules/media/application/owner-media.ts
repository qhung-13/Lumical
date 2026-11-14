import { Inject, Injectable } from '@nestjs/common';
import type { TransactionContext } from '../../../platform/database/application/transactions';
import { ActiveAccounts } from '../../identity/application/ports';
import { IdentityError } from '../../identity/domain/identity';
import type { FinalizationAsset } from './finalize-media';
import type { MediaStorage, PrivateContent } from './media-storage';
import { parseMediaRange, resolveMediaRange } from './media-range';

export interface OwnedMedia extends FinalizationAsset {
  contentType: string | null;
}
export abstract class OwnerMediaRepository {
  abstract find(
    id: string,
    ownerId: string,
    context: TransactionContext,
  ): Promise<OwnedMedia | null>;
  abstract isRetryable(error: unknown): boolean;
}
/** Scope describes already-established access; implementations cannot grant access. */
export abstract class MediaContent {
  abstract fetch(
    request: Parameters<MediaStorage['fetch']>[0],
    signal: AbortSignal,
  ): ReturnType<MediaStorage['fetch']>;
}
export const mediaUnavailable = (transient = false) =>
  new IdentityError(
    'MEDIA_UNAVAILABLE',
    transient ? 503 : 409,
    'errors.mediaUnavailable',
  );

@Injectable()
export class OwnerMedia {
  constructor(
    @Inject(ActiveAccounts) private readonly accounts: ActiveAccounts,
    @Inject(OwnerMediaRepository)
    private readonly repository: OwnerMediaRepository,
    @Inject(MediaContent) private readonly storage: MediaContent,
  ) {}

  private async owned(
    auth: Parameters<ActiveAccounts['withActiveAccount']>[0],
    id: string,
    signal?: AbortSignal,
  ): Promise<OwnedMedia> {
    for (let attempt = 0; ; attempt++) {
      try {
        signal?.throwIfAborted();
        return await this.accounts.withActiveAccount(
          auth,
          false,
          async (actor, context) => {
            signal?.throwIfAborted();
            if (
              !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
                id,
              )
            )
              throw new IdentityError('NOT_FOUND', 404, 'errors.notFound');
            const asset = await this.repository.find(
              id.toLowerCase(),
              actor.id,
              context,
            );
            if (!asset)
              throw new IdentityError('NOT_FOUND', 404, 'errors.notFound');
            return asset;
          },
        );
      } catch (error) {
        if (attempt >= 2 || !this.repository.isRetryable(error)) throw error;
      }
    }
  }
  async status(
    auth: Parameters<ActiveAccounts['withActiveAccount']>[0],
    id: string,
  ) {
    const asset = await this.owned(auth, id);
    return {
      id: asset.binding.assetId,
      category: asset.category,
      status: asset.status,
      verifiedBytes: asset.verifiedBytes,
      ...(asset.durationMs === null
        ? {}
        : { durationSeconds: asset.durationMs / 1000 }),
      ...(asset.status === 'READY'
        ? { contentPath: `/api/v1/media/${asset.binding.assetId}/content` }
        : {}),
    };
  }
  async content(
    auth: Parameters<ActiveAccounts['withActiveAccount']>[0],
    id: string,
    method: 'GET' | 'HEAD',
    header: string | undefined,
    signal: AbortSignal,
  ): Promise<
    PrivateContent | { kind: 'RANGE_NOT_SATISFIABLE'; totalBytes: number }
  > {
    const asset = await this.owned(auth, id, signal);
    signal.throwIfAborted();
    if (
      asset.status !== 'READY' ||
      !asset.storageKey ||
      !asset.contentType ||
      !asset.verifiedBytes
    )
      throw mediaUnavailable();
    let range;
    let resolved;
    try {
      range = method === 'GET' ? parseMediaRange(header) : undefined;
      resolved = range
        ? resolveMediaRange(range, asset.verifiedBytes)
        : undefined;
    } catch {
      return { kind: 'RANGE_NOT_SATISFIABLE', totalBytes: asset.verifiedBytes };
    }
    const result = await this.storage.fetch(
      {
        object: {
          binding: asset.binding,
          storageKey: asset.storageKey,
          contentVersion: String(asset.contentVersion),
        },
        access: {
          kind: 'OWNER',
          actorId: asset.binding.ownerId,
          ownerId: asset.binding.ownerId,
        },
        method,
        range,
        rendition: 'ORIGINAL',
      },
      signal,
    );
    if (result.kind !== 'CONTENT')
      throw mediaUnavailable(result.kind === 'UNAVAILABLE');
    if (
      result.contentType !== asset.contentType ||
      result.totalBytes !== asset.verifiedBytes ||
      result.status !== (resolved ? 206 : 200) ||
      result.contentLength !==
        (resolved ? resolved.end - resolved.start + 1 : asset.verifiedBytes) ||
      (resolved
        ? result.contentRange?.start !== resolved.start ||
          result.contentRange?.end !== resolved.end
        : result.contentRange !== undefined) ||
      (method === 'GET' && !result.body)
    )
      throw mediaUnavailable(true);
    // No account lock spans provider I/O. Recheck before releasing bytes after a slow upstream.
    const current = await this.owned(auth, id, signal);
    signal.throwIfAborted();
    if (
      current.status !== 'READY' ||
      current.storageKey !== asset.storageKey ||
      current.contentVersion !== asset.contentVersion
    )
      throw mediaUnavailable();
    return result;
  }
}
