/**
 * I03-P04 — AR provider port SKETCH (revision 3, closeout clarification).
 *
 * Purpose: show that a provider-neutral boundary can preserve (a) the source version, (b) immutable artifact semantics,
 * (c) "recognition is not authorization", and (d) a camera-free path that does not depend on AR. It is a review aid for
 * LEAD (I03-P05) and the input for the real port in I08/I12. It is NOT a contract: any API change follows
 * DEV_WORKFLOW section 11. Not compiled by the workspace; type-check locally with:
 *     npx -p typescript tsc --noEmit --strict --target es2022 --moduleResolution bundler --module esnext port/ar-provider-port.ts
 *
 * Rules mirrored here: BR-AR-001 (one designated target, image + message is enough), BR-AR-002 (artifact bound to the
 * order's source version), BR-AR-003 / INV-08 (recognition is not authorization, no global target-to-media lookup),
 * BR-AR-004 (camera-free path with the same content), ADR-005 (provider metadata stays in the adapter).
 *
 * Changes from revision 1: artifact byte identity is separate from the source-revision binding; no provider target or
 * anchor index crosses this boundary; `prepare()` and the store verify hashes; `content()` cannot fail because the AR
 * artifact is unavailable.
 */

// ---------------------------------------------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------------------------------------------

type Brand<T, B extends string> = T & { readonly __brand: B };

/** Identity of the Project/Order source version an artifact is prepared for. */
export type SourceRevisionId = Brand<string, 'SourceRevisionId'>;
/**
 * Canonical artifact identity, derived from the FULL SHA-256 of the artifact bytes (e.g. `ar-<64 hex>`). One id can only
 * mean one byte sequence. Short forms exist for display only and are never used as keys.
 */
export type ArtifactId = Brand<string, 'ArtifactId'>;
export type Sha256Hex = Brand<string, 'Sha256Hex'>;

// ---------------------------------------------------------------------------------------------------------------
// 1. Artifact BYTE identity. Knows nothing about orders, projects or revisions.
// ---------------------------------------------------------------------------------------------------------------

/** IMMUTABLE in ordinary operations. Only separately authorized retention cleanup may purge it (BR-PRV-004/005). */
export interface PreparedARArtifact {
  readonly artifactId: ArtifactId; // must equal 'ar-' + artifactSha256
  readonly artifactSha256: Sha256Hex;
  readonly sizeBytes: number;
  readonly providerId: string; // e.g. 'mindar'
  readonly providerVersion: string; // e.g. 'mind-ar@1.2.5, @tensorflow/tfjs@4.22.0 (cpu)'
  readonly createdAt: string; // informational; never part of the id
  /** Adapter-bound data (tool name, toolchain, reproducibility records). Never exposed in a DTO, never read outside the adapter. */
  readonly providerMetadata: unknown;
}

export class ArtifactIntegrityError extends Error {
  constructor(readonly reason: 'hash-mismatch' | 'id-mismatch' | 'id-collision' | 'size-mismatch' | 'not-single-target') {
    super(reason);
  }
}

/**
 * Append-only content-addressed store.
 *  - `put` MUST recompute the SHA-256 of `bytes` and fail with `hash-mismatch` / `id-mismatch` if it disagrees with the
 *    record; it MUST fail with `id-collision` if the id already exists with different bytes; identical bytes are a no-op.
 *  - `get` MUST re-verify the bytes against `artifactSha256` and report `unavailable` on any disagreement or absence.
 */
export interface ARArtifactStore {
  put(artifact: PreparedARArtifact, bytes: Uint8Array): Promise<void>;
  get(id: ArtifactId): Promise<{ status: 'ok'; artifact: PreparedARArtifact; bytes: Uint8Array } | { status: 'unavailable' }>;
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Source-revision BINDING. A separate, append-only fact: "this artifact was prepared for this source revision".
// ---------------------------------------------------------------------------------------------------------------

export type ProvenanceStatus =
  | 'built-from-verified-source' // produced by the preparation port from a source whose hash was verified
  | 'verified-recompile' // external bytes equal a fresh recompile of the verified source (same toolchain only)
  | 'manual-unverified'; // structure fits but the content is NOT proven to come from this source

export interface ARArtifactBinding {
  readonly sourceRevisionId: SourceRevisionId;
  readonly sourceImageSha256: Sha256Hex; // the exact image bytes the artifact was prepared from
  readonly artifactId: ArtifactId;
  readonly provenance: { readonly status: ProvenanceStatus; readonly detail: string; readonly checkedAt: string };
  readonly boundAt: string;
}

/**
 * Append-only. The same artifact bytes MAY be bound to several revisions (identical source image); one revision MAY be
 * bound to another artifact after a toolchain change for the SAME source image. Changing image bytes advances the
 * Project revision; it never redefines an existing source revision. Existing bindings are never changed, so an Order version that
 * referenced a binding keeps resolving to the same artifact bytes (BR-AR-002).
 */
export interface ARBindingStore {
  bind(binding: ARArtifactBinding): Promise<void>;
  findBySourceRevision(id: SourceRevisionId): Promise<readonly ARArtifactBinding[]>;
}

// ---------------------------------------------------------------------------------------------------------------
// Preparation (server side / build time)
// ---------------------------------------------------------------------------------------------------------------

export interface ARTargetSource {
  readonly sourceRevisionId: SourceRevisionId;
  /** Declared hash of the image bytes. `prepare` MUST hash `imageBytes` and refuse on mismatch. */
  readonly sourceImageSha256: Sha256Hex;
}

export interface ARPreparationPort {
  /**
   * Preconditions: sha256(imageBytes) === source.sourceImageSha256, otherwise fail before doing any work.
   * Postconditions the caller may rely on (and the adapter MUST guarantee):
   *   - exactly ONE designated target (BR-AR-001); multi-target output fails with `not-single-target`
   *   - artifact.artifactSha256 === sha256(bytes) and artifact.artifactId === 'ar-' + artifact.artifactSha256
   *   - idempotent for the same (image bytes, provider, provider version) in the recorded toolchain
   * It never mutates a stored artifact and never silently substitutes another target. Binding the result to a source
   * revision is a separate call on `ARBindingStore`, made only after these checks pass.
   */
  prepare(source: ARTargetSource, imageBytes: Uint8Array): Promise<{ artifact: PreparedARArtifact; bytes: Uint8Array; provenance: ProvenanceStatus }>;
}

// ---------------------------------------------------------------------------------------------------------------
// Recognition (client side). Provider details, including anchor/target indexes, STOP at the adapter.
// ---------------------------------------------------------------------------------------------------------------

/**
 * Production artifacts have exactly one target, so "recognized" has a single meaning: the artifact's designated target
 * is in view. There is deliberately no `targetIndex` here. A provider that needs one (MindAR's anchor index) keeps it
 * inside its adapter; multi-target artifacts exist only as a test-only adapter extension (see harness `combined`).
 */
export interface RecognitionEvent {
  readonly artifactId: ArtifactId;
}

export interface ARRecognizerPort {
  /** `artifactBytes` come from the authorized artifact endpoint and are verified against `artifactSha256` first. */
  start(input: { artifactId: ArtifactId; artifactBytes: Uint8Array }, handlers: {
    onFound(event: RecognitionEvent): void;
    onLost(event: RecognitionEvent): void;
    onUnavailable(reason: 'denied' | 'unsupported' | 'failed'): void;
  }): Promise<void>;
  /** Must release every camera track; the caller can assert `liveTracks === 0` afterwards. */
  stop(): Promise<{ liveTracks: number }>;
}

// ---------------------------------------------------------------------------------------------------------------
// Reveal and camera-free content (server side). Authorization lives HERE, never in the recognizer.
// ---------------------------------------------------------------------------------------------------------------

/** Same payload for the AR reveal and the camera-free path (BR-AR-004). Text must be real text, not baked into the image. */
export interface RevealContent {
  readonly title: string;
  readonly message: string;
  readonly image: { readonly url: string; readonly alt: string };
}

/** Caller identity as already resolved by the sharing subsystem (I11/I12). The port does not parse tokens or links. */
export interface AuthorizedShareScope {
  /** The ordered version whose content is shown. This alone decides the content, for both reveal and camera-free. */
  readonly orderVersionId: string;
  /** The artifact bound to this order version for AR. Absent while preparation failed or is unverified. */
  readonly boundArtifactId: ArtifactId | undefined;
}

/**
 * Deliberately one `not_found` shape for: no scope, other scope, other artifact and "recognized but not ours". No oracle
 * that distinguishes these (BR-AR-003, INV-08).
 */
export type RevealResult =
  | { status: 'revealed'; content: RevealContent }
  | { status: 'not_found' }
  /** Only for an AUTHORIZED scope; missing media must not be replaced with unrelated content. */
  | { status: 'unavailable'; reason: 'artifact-unavailable' | 'media-unavailable' };

/** No AR failure mode: never reads an artifact. Media can still be unavailable (BR-AR-004). */
export type ContentResult = { status: 'revealed'; content: RevealContent } | { status: 'not_found' } | { status: 'unavailable'; reason: 'media-unavailable' };

export interface ARRevealService {
  /**
   * `event.artifactId` is a hint that must equal `scope.boundArtifactId`. It is never a key into any media store, and
   * no function in this port accepts a bare recognition result and returns media.
   */
  reveal(scope: AuthorizedShareScope | undefined, event: RecognitionEvent): Promise<RevealResult>;
  /** Same content and same authorization as `reveal`, independent of AR: works when the artifact is missing, corrupt or unverified. */
  content(scope: AuthorizedShareScope | undefined): Promise<ContentResult>;
}

// ---------------------------------------------------------------------------------------------------------------
// MindAR 1.2.5 adapter mapping (documentation only, see the I03-P04 review)
// ---------------------------------------------------------------------------------------------------------------
//   prepare                    -> CompilerBase.compileImageTargets([image]) + exportData() in Node (no native canvas)
//   PreparedARArtifact         -> artifactSha256 = sha256(.mind bytes); artifactId = 'ar-' + full sha256
//   ARArtifactBinding          -> manifest record: sourceRevisionId, sourceImageSha256, provenance (src/provenance.mjs)
//   providerMetadata           -> { tool, toolVersion, environment, reproducibility checks }
//   ARRecognizerPort.start     -> new MindARThree({ imageTargetSrc: blobUrl, maxTrack: 1 }); the adapter calls addAnchor(0)
//   RecognitionEvent           -> { artifactId } only; the anchor index never leaves the adapter
//   ARRecognizerPort.stop      -> mindar.stop() + our own getUserMedia track bookkeeping (the library does not report it)
// Harness-only: the combined multi-target artifact and the `targetIndex` field of /api/spike/reveal are a test extension
// used to make the tracker recognize B inside session A; they are not part of this port.
