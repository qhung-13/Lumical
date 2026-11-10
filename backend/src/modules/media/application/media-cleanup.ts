import { Inject, Injectable } from '@nestjs/common';
import type { TransactionContext } from '../../../platform/database/application/transactions';
import { ActiveAccounts, Clock } from '../../identity/application/ports';
import { IdentityError } from '../../identity/domain/identity';
import type { ImmutableMedia, MediaBinding } from '../domain/media';
import type { StorageFailure } from './media-storage';

export interface CleanupTarget {
  binding: MediaBinding;
  pinned: ImmutableMedia | null;
}
export interface CleanupClaim {
  id: string;
  token: string;
  target: CleanupTarget;
}
export abstract class MediaPurge {
  abstract purge(
    target: CleanupTarget,
    signal: AbortSignal,
  ): Promise<{ kind: 'DELETED' } | StorageFailure>;
}
export abstract class MediaCleanupRepository {
  abstract request(
    id: string,
    ownerId: string,
    now: Date,
    context: TransactionContext,
  ): Promise<'DELETED' | 'RETAINED'>;
  abstract scan(now: Date, limit: number): Promise<void>;
  abstract claim(now: Date): Promise<CleanupClaim | null>;
  abstract finish(
    claim: CleanupClaim,
    result: 'DELETED' | 'RETRY' | 'REJECTED',
    now: Date,
  ): Promise<void>;
  abstract isRetryable(error: unknown): boolean;
}

@Injectable()
export class MediaCleanup {
  constructor(
    @Inject(ActiveAccounts) private readonly accounts: ActiveAccounts,
    @Inject(MediaCleanupRepository)
    private readonly repository: MediaCleanupRepository,
    @Inject(MediaPurge) private readonly storage: MediaPurge,
    @Inject(Clock) private readonly clock: Clock,
  ) {}

  async remove(
    auth: Parameters<ActiveAccounts['withActiveAccount']>[0],
    id: string,
  ) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.accounts.withActiveAccount(
          auth,
          true,
          async (actor, context) => {
            if (
              !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
                id,
              )
            )
              throw new IdentityError('NOT_FOUND', 404, 'errors.notFound');
            return this.repository.request(
              id.toLowerCase(),
              actor.id,
              this.clock.now(),
              context,
            );
          },
        );
      } catch (error) {
        if (attempt >= 2 || !this.repository.isRetryable(error)) throw error;
      }
    }
  }
  async runBatch(limit: number, signal: AbortSignal): Promise<number> {
    if (signal.aborted) return 0;
    await this.repository.scan(this.clock.now(), limit);
    let processed = 0;
    while (processed < limit && !signal.aborted) {
      const claim = await this.repository.claim(this.clock.now());
      if (!claim) break;
      let result: Awaited<ReturnType<MediaPurge['purge']>>;
      try {
        result = await this.storage.purge(claim.target, signal);
      } catch {
        result = { kind: 'UNAVAILABLE', retryable: true };
      }
      // Crash/abort leaves a bounded lease that another worker can recover.
      if (signal.aborted) break;
      await this.repository.finish(
        claim,
        result.kind === 'DELETED'
          ? 'DELETED'
          : result.kind === 'UNAVAILABLE' && result.retryable
            ? 'RETRY'
            : 'REJECTED',
        this.clock.now(),
      );
      processed++;
    }
    return processed;
  }
}
