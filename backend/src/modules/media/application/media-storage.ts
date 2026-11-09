import type { ImmutableMedia, Inspection, MediaBinding, MediaCategory } from '../domain/media';

/** Application must establish current active-account/reference access before every call.
 * These contexts describe scope; possession of a context is not authorization.
 * Future ordered grants are contracts only and grant no current endpoint access.
 */
export type MediaAccessContext =
  | { readonly kind: 'OWNER'; readonly actorId: string; readonly ownerId: string }
  | { readonly kind: 'ORDER_OWNER'; readonly actorId: string; readonly ownerId: string;
      readonly versionId: string; readonly referenceId: string }
  | { readonly kind: 'RECIPIENT'; readonly ownerId: string; readonly versionId: string;
      readonly referenceId: string; readonly grantId: string; readonly generation: number }
  | { readonly kind: 'ADMIN_INSPECTION'; readonly actorId: string; readonly ownerId: string;
      readonly versionId: string; readonly referenceId: string; readonly inspectionId: string };

export type StorageFailure =
  | { readonly kind: 'UNAVAILABLE'; readonly retryable: boolean }
  | { readonly kind: 'REJECTED'; readonly reason: 'INVALID_CONTENT' | 'BINDING_MISMATCH' | 'CONFLICT' };

export interface PrivateUploadRequest {
  readonly binding: MediaBinding;
  readonly category: MediaCategory;
  readonly expiresAt: Date;
}

/** Bounded upload signature is allowed; account secrets/delivery signatures are forbidden. */
export interface PrivateUploadIntent {
  readonly binding: MediaBinding;
  readonly expiresAt: Date;
  readonly uploadEndpoint: string;
  readonly fields: Readonly<Record<string, string>>;
}

export type ByteRange =
  | { readonly kind: 'CLOSED'; readonly start: number; readonly end: number }
  | { readonly kind: 'OPEN'; readonly start: number }
  | { readonly kind: 'SUFFIX'; readonly length: number };

export interface PrivateFetchRequest {
  readonly object: ImmutableMedia;
  readonly access: MediaAccessContext;
  readonly method: 'GET' | 'HEAD';
  readonly range?: ByteRange;
  // A named prepared derivative, never an arbitrary transformation or remote URL.
  readonly rendition: 'ORIGINAL' | 'PREVIEW';
}

export interface PrivateContent {
  readonly kind: 'CONTENT';
  readonly status: 200 | 206;
  readonly contentType: string;
  readonly contentLength: number;
  readonly totalBytes: number;
  readonly contentRange?: { readonly start: number; readonly end: number };
  /** Absent for HEAD; adapter must cancel upstream work when signal aborts. */
  readonly body?: AsyncIterable<Uint8Array>;
}

/** No provider SDK, arbitrary URL input, redirect or signed delivery URL output.
 * Calls run outside DB transactions. Application owns readiness, authorization and retention.
 */
export abstract class MediaStorage {
  abstract authorizeUpload(request: PrivateUploadRequest): Promise<
    { readonly kind: 'AUTHORIZED'; readonly intent: PrivateUploadIntent } | StorageFailure>;
  /** Provider-authenticated inspection; finalize never trusts client upload response facts. */
  abstract inspect(binding: MediaBinding): Promise<Inspection | StorageFailure>;
  abstract fetch(request: PrivateFetchRequest, signal: AbortSignal): Promise<
    PrivateContent | StorageFailure | { readonly kind: 'NOT_FOUND' } |
    { readonly kind: 'RANGE_NOT_SATISFIABLE'; readonly totalBytes: number }>;
  /** Caller coordinates all current/history/job references before permitting deletion.
   * Exact immutable version only; missing object is idempotent success.
   */
  abstract delete(object: ImmutableMedia): Promise<{ readonly kind: 'DELETED' } | StorageFailure>;
}