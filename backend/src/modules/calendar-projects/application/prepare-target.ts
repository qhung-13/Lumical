import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  MediaContent,
  type OwnedMedia,
} from '../../media/application/owner-media';
import type { DurableJobHandler } from '../../../platform/jobs/job-runner';
import {
  InvalidTarget,
  MAX_TARGET_BYTES,
  TargetCompiler,
} from './target-compiler';

export const AR_PREPARE = 'AR_PREPARE';
export const MAX_PREPARATION_ATTEMPTS = 3;
export const PREPARATION_LEASE_MS = 120_000;
export const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

export type PreparationClaim = {
  id: string;
  objectId: string;
  operationIdentity: string;
  claimedBy: string;
  attempts: number;
};

export type PreparationSource = {
  projectId: string;
  ownerId: string;
  revision: number;
  monthNumber: number;
  source: OwnedMedia & { storageKey: string; verifiedBytes: number };
  revealAssetId: string;
  revealContentVersion: number;
};

export type PreparedTarget = {
  source: PreparationSource;
  sourceDigest: string;
  pixelDigest: string;
  bytes: Uint8Array;
};

export type PreparationOutcome =
  | { kind: 'READY'; target: PreparedTarget }
  | { kind: 'STALE' | 'INVALID' | 'RETRY' };

export abstract class PreparationJobs {
  abstract claim(): Promise<PreparationClaim | null>;
  abstract source(
    claim: PreparationClaim,
  ): Promise<PreparationSource | 'INVALID' | null>;
  abstract finish(
    claim: PreparationClaim,
    outcome: PreparationOutcome,
  ): Promise<void>;
}

@Injectable()
export class PrepareTarget implements DurableJobHandler {
  constructor(
    @Inject(PreparationJobs) private readonly jobs: PreparationJobs,
    @Inject(MediaContent) private readonly storage: MediaContent,
    @Inject(TargetCompiler) private readonly compiler: TargetCompiler,
  ) {}

  async runBatch(limit: number, signal: AbortSignal): Promise<number> {
    // Compile at most one target per pass so other job kinds remain responsive.
    if (limit < 1 || signal.aborted) return 0;
    const claim = await this.jobs.claim();
    if (!claim) return 0;
    const source = await this.jobs.source(claim);
    const outcome =
      source === null
        ? ({ kind: 'STALE' } as const)
        : source === 'INVALID' || claim.attempts > MAX_PREPARATION_ATTEMPTS
          ? ({ kind: 'INVALID' } as const)
          : await this.prepare(
              source,
              AbortSignal.any([signal, AbortSignal.timeout(90_000)]),
            );
    await this.jobs.finish(claim, outcome);
    return 1;
  }

  private async prepare(
    source: PreparationSource,
    signal: AbortSignal,
  ): Promise<PreparationOutcome> {
    try {
      const input = source.source;
      const result = await this.storage.fetch(
        {
          object: {
            binding: input.binding,
            storageKey: input.storageKey,
            contentVersion: String(input.contentVersion),
          },
          access: {
            kind: 'OWNER',
            actorId: source.ownerId,
            ownerId: source.ownerId,
          },
          method: 'GET',
          rendition: 'ORIGINAL',
        },
        signal,
      );
      if (result.kind === 'UNAVAILABLE')
        return { kind: result.retryable ? 'RETRY' : 'INVALID' };
      if (result.kind !== 'CONTENT') return { kind: 'INVALID' };
      if (
        result.status !== 200 ||
        result.contentType !== input.contentType ||
        result.totalBytes !== input.verifiedBytes ||
        result.contentLength !== input.verifiedBytes ||
        !result.body
      )
        return { kind: 'INVALID' };

      const bytes = Buffer.alloc(input.verifiedBytes);
      let offset = 0;
      for await (const chunk of result.body) {
        signal.throwIfAborted();
        if (chunk.length > bytes.length - offset) return { kind: 'INVALID' };
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      if (offset !== bytes.length) return { kind: 'RETRY' };
      const sourceDigest = sha256(bytes);
      const artifact = await this.compiler.compile(bytes, signal);
      signal.throwIfAborted();
      if (
        !artifact.bytes.length ||
        artifact.bytes.length > MAX_TARGET_BYTES ||
        !/^[a-f0-9]{64}$/.test(artifact.pixelDigest)
      )
        return { kind: 'INVALID' };
      return {
        kind: 'READY',
        target: { source, sourceDigest, ...artifact },
      };
    } catch (error) {
      return { kind: error instanceof InvalidTarget ? 'INVALID' : 'RETRY' };
    }
  }
}
