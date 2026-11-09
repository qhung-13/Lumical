import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { TransactionContext } from '../../../platform/database/application/transactions';
import { ActiveAccounts, Clock } from '../../identity/application/ports';
import {
  IdentityError,
  type ActiveAccountPrincipal,
} from '../../identity/domain/identity';
import {
  assessReadiness,
  type MediaBinding,
  type MediaCategory,
  type MediaReadiness,
  type VerifiedMediaFacts,
} from '../domain/media';
import type { MediaStorage } from './media-storage';

export abstract class MediaInspection {
  abstract inspect(binding: MediaBinding): ReturnType<MediaStorage['inspect']>;
}
export interface FinalizationAsset {
  binding: MediaBinding;
  category: MediaCategory;
  status: MediaReadiness;
  storageKey: string | null;
  contentVersion: number;
  verifiedBytes: number | null;
  durationMs: number | null;
  rejection?: 'INVALID_CONTENT' | 'CONFLICT';
}
export interface FinalizationIntent {
  ownerId: string;
  key: string;
  digest: string;
}
export abstract class MediaFinalizations {
  /** Locks an owned asset, binds the intent atomically, and rejects changed requests. */
  abstract begin(
    id: string,
    intent: FinalizationIntent,
    context: TransactionContext,
  ): Promise<FinalizationAsset>;
  abstract ready(
    asset: FinalizationAsset,
    facts: VerifiedMediaFacts,
    now: Date,
    context: TransactionContext,
  ): Promise<FinalizationAsset>;
  abstract reject(
    asset: FinalizationAsset,
    intent: FinalizationIntent,
    reason: 'INVALID_CONTENT' | 'CONFLICT',
    context: TransactionContext,
  ): Promise<void>;
  abstract complete(
    intent: FinalizationIntent,
    result: MediaView,
    context: TransactionContext,
  ): Promise<void>;
  abstract isRetryable(error: unknown): boolean;
}
export interface MediaView {
  id: string;
  category: MediaCategory;
  status: MediaReadiness;
  verifiedBytes: number | null;
  durationSeconds?: number;
}
export type FinalizationResult =
  | { status: 200; data: MediaView }
  | { status: 202; data: { assetId: string; status: 'PENDING' } };
type Outcome =
  | FinalizationResult
  | { error: 'INVALID_CONTENT' | 'UNAVAILABLE' | 'CONFLICT' };

function view(asset: FinalizationAsset): MediaView {
  return {
    id: asset.binding.assetId,
    category: asset.category,
    status: asset.status,
    verifiedBytes: asset.verifiedBytes,
    ...(asset.durationMs === null
      ? {}
      : { durationSeconds: asset.durationMs / 1000 }),
  };
}
const invalid = () =>
  new IdentityError('VALIDATION_FAILED', 422, 'errors.validation');
const notFound = () => new IdentityError('NOT_FOUND', 404, 'errors.notFound');

@Injectable()
export class FinalizeMedia {
  constructor(
    @Inject(ActiveAccounts) private readonly accounts: ActiveAccounts,
    @Inject(MediaFinalizations) private readonly repository: MediaFinalizations,
    @Inject(MediaInspection) private readonly storage: MediaInspection,
    @Inject(Clock) private readonly clock: Clock,
  ) {}

  private async authorized<T>(
    auth: Parameters<ActiveAccounts['withActiveAccount']>[0],
    work: (
      actor: ActiveAccountPrincipal,
      context: TransactionContext,
    ) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.accounts.withActiveAccount(auth, true, work);
      } catch (error) {
        if (attempt >= 2 || !this.repository.isRetryable(error)) throw error;
      }
    }
  }

  async execute(
    auth: Parameters<ActiveAccounts['withActiveAccount']>[0],
    id: string,
    input: unknown,
    key?: string,
  ): Promise<FinalizationResult> {
    let intent!: FinalizationIntent;
    const original = await this.authorized<FinalizationAsset>(
      auth,
      async (actor, context) => {
        if (
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
            id,
          )
        )
          throw notFound();
        if (
          !key ||
          !/^[A-Za-z0-9_-]{16,128}$/.test(key) ||
          !input ||
          typeof input !== 'object' ||
          Array.isArray(input) ||
          Object.keys(input).length !== 1 ||
          !('uploadCompleted' in input) ||
          input.uploadCompleted !== true
        )
          throw invalid();
        id = id.toLowerCase();
        intent = {
          ownerId: actor.id,
          key,
          digest: createHash('sha256')
            .update(JSON.stringify({ id, uploadCompleted: true }))
            .digest('hex'),
        };
        return this.repository.begin(id, intent, context);
      },
    );
    // Provider I/O is outside all DB transactions. The browser hint is never evidence.
    const inspection =
      original.status === 'PENDING'
        ? await this.storage.inspect(original.binding)
        : undefined;
    const outcome = await this.authorized<Outcome>(
      auth,
      async (actor, context) => {
        if (actor.id !== intent.ownerId) throw notFound();
        const current = await this.repository.begin(id, intent, context);
        if (current.status === 'READY') {
          if (
            inspection?.kind === 'VERIFIED' &&
            (inspection.facts.object.storageKey !== current.storageKey ||
              inspection.facts.object.contentVersion !==
                String(current.contentVersion))
          )
            return { error: 'CONFLICT' };
          const data = view(current);
          await this.repository.complete(intent, data, context);
          return { status: 200, data };
        }
        if (current.status === 'UNAVAILABLE')
          return { error: current.rejection ?? 'INVALID_CONTENT' };
        if (!inspection) return { error: 'UNAVAILABLE' };
        if (inspection.kind === 'REJECTED') {
          const error =
            inspection.reason === 'CONFLICT' ? 'CONFLICT' : 'INVALID_CONTENT';
          await this.repository.reject(current, intent, error, context);
          return { error };
        }
        if (inspection.kind === 'UNAVAILABLE') return { error: 'UNAVAILABLE' };
        const decision = assessReadiness(
          current.binding,
          current.category,
          inspection,
        );
        if (decision.status === 'PENDING')
          return { status: 202, data: { assetId: id, status: 'PENDING' } };
        if (decision.status === 'UNAVAILABLE') {
          await this.repository.reject(
            current,
            intent,
            'INVALID_CONTENT',
            context,
          );
          return { error: 'INVALID_CONTENT' };
        }
        // The persistence schema pins provider versions as positive 32-bit integers.
        const version = Number(decision.facts.object.contentVersion);
        if (
          !/^\d+$/.test(decision.facts.object.contentVersion) ||
          !Number.isSafeInteger(version) ||
          version <= 0 ||
          version > 2_147_483_647
        ) {
          await this.repository.reject(
            current,
            intent,
            'INVALID_CONTENT',
            context,
          );
          return { error: 'INVALID_CONTENT' };
        }
        const saved = await this.repository.ready(
          current,
          decision.facts,
          this.clock.now(),
          context,
        );
        const data = view(saved);
        await this.repository.complete(intent, data, context);
        return { status: 200, data };
      },
    );
    if ('error' in outcome) {
      if (outcome.error === 'UNAVAILABLE')
        throw new IdentityError(
          'PROVIDER_UNAVAILABLE',
          503,
          'errors.providerUnavailable',
        );
      if (outcome.error === 'CONFLICT')
        throw new IdentityError(
          'MEDIA_UNAVAILABLE',
          409,
          'errors.mediaUnavailable',
        );
      throw invalid();
    }
    return outcome;
  }
}
