import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { TransactionContext } from '../../../platform/database/application/transactions';
import { ActiveAccounts, Clock } from '../../identity/application/ports';
import { IdentityError } from '../../identity/domain/identity';
import {
  MEDIA_LIMITS,
  type MediaBinding,
  type MediaCategory,
} from '../domain/media';
import type { MediaStorage } from './media-storage';

export abstract class UploadAuthorization implements Pick<
  MediaStorage,
  'authorizeUpload'
> {
  abstract authorizeUpload(
    request: Parameters<MediaStorage['authorizeUpload']>[0],
  ): ReturnType<MediaStorage['authorizeUpload']>;
}
export interface PendingUpload {
  binding: MediaBinding;
  category: MediaCategory;
  createdAt: Date;
}
export abstract class UploadIntents {
  abstract reserve(
    ownerId: string,
    key: string,
    digest: string,
    category: MediaCategory,
    now: Date,
    context: TransactionContext,
  ): Promise<PendingUpload>;
  abstract isRetryable(error: unknown): boolean;
}

export function uploadRequest(input: unknown) {
  const invalid = (): never => {
    throw new IdentityError('VALIDATION_FAILED', 422, 'errors.validation');
  };
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return invalid();
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) =>
        ![
          'category',
          'fileName',
          'declaredBytes',
          'declaredDurationSeconds',
        ].includes(key),
    )
  )
    return invalid();
  const { category, fileName, declaredBytes, declaredDurationSeconds } = value;
  if (category !== 'IMAGE' && category !== 'VIDEO' && category !== 'AUDIO')
    return invalid();
  if (
    typeof fileName !== 'string' ||
    !fileName.trim() ||
    fileName.length > 255 ||
    /[\p{Cc}]/u.test(fileName)
  )
    return invalid();
  if (
    typeof declaredBytes !== 'number' ||
    !Number.isSafeInteger(declaredBytes) ||
    declaredBytes <= 0 ||
    declaredBytes > MEDIA_LIMITS[category].maxBytes
  )
    return invalid();
  if (
    declaredDurationSeconds !== undefined &&
    (typeof declaredDurationSeconds !== 'number' ||
      !Number.isFinite(declaredDurationSeconds) ||
      declaredDurationSeconds <= 0 ||
      declaredDurationSeconds > 60 ||
      category === 'IMAGE')
  )
    return invalid();
  return {
    category: category as MediaCategory,
    fileName,
    declaredBytes,
    ...(declaredDurationSeconds === undefined
      ? {}
      : { declaredDurationSeconds }),
  };
}

@Injectable()
export class UploadIntake {
  constructor(
    @Inject(ActiveAccounts) private readonly accounts: ActiveAccounts,
    @Inject(UploadIntents) private readonly intents: UploadIntents,
    @Inject(UploadAuthorization) private readonly storage: UploadAuthorization,
    @Inject(Clock) private readonly clock: Clock,
  ) {}

  async execute(
    auth: Parameters<ActiveAccounts['withActiveAccount']>[0],
    input: unknown,
    key?: string,
  ) {
    let pending: PendingUpload;
    for (let attempt = 0; ; attempt++) {
      try {
        pending = await this.accounts.withActiveAccount(
          auth,
          true,
          async (actor, context) => {
            if (!key || !/^[A-Za-z0-9_-]{16,128}$/.test(key))
              throw new IdentityError(
                'VALIDATION_FAILED',
                422,
                'errors.validation',
              );
            const request = uploadRequest(input);
            const digest = createHash('sha256')
              .update(JSON.stringify(request))
              .digest('hex');
            return this.intents.reserve(
              actor.id,
              key,
              digest,
              request.category,
              this.clock.now(),
              context,
            );
          },
        );
        break;
      } catch (error) {
        if (attempt >= 2 || !this.intents.isRetryable(error)) throw error;
      }
    }
    // Provider work never holds an account/DB lock. Replays retain the original expiry.
    const expiresAt = new Date(
      Math.floor(pending.createdAt.getTime() / 1000) * 1000 + 3_600_000,
    );
    if (expiresAt <= this.clock.now())
      throw new IdentityError('CONFLICT', 409, 'errors.uploadIntentExpired');
    const authorized = await this.storage.authorizeUpload({
      binding: pending.binding,
      category: pending.category,
      expiresAt,
    });
    if (authorized.kind !== 'AUTHORIZED')
      throw new IdentityError(
        'PROVIDER_UNAVAILABLE',
        503,
        'errors.providerUnavailable',
      );
    return {
      assetId: pending.binding.assetId,
      upload: {
        url: authorized.intent.uploadEndpoint,
        fields: authorized.intent.fields,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }
}
