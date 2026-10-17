/**
 * I03-P04 — AR provider port SKETCH.
 *
 * Purpose: show that a provider-neutral boundary can preserve (a) source version, (b) immutable artifact semantics,
 * (c) "recognition is not authorization", and (d) a same-content camera-free path. It is a review aid for LEAD (I03-P05)
 * and the input for the real port in I08/I12. It is NOT a contract: any API change follows DEV_WORKFLOW section 11.
 * Not compiled by the workspace; type-check locally with:
 *     npx -p typescript tsc --noEmit --strict --target es2022 --moduleResolution bundler port/ar-provider-port.ts
 *
 * Rules mirrored here: BR-AR-001 (image + message is enough), BR-AR-002 (artifact bound to the order's source version),
 * BR-AR-003 / INV-08 (recognition is not authorization, no global target-to-media lookup), BR-AR-004 (camera-free
 * fallback with the same content), ADR-005 (provider metadata stays in the adapter).
 */

// ---------------------------------------------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------------------------------------------

type Brand<T, B extends string> = T & { readonly __brand: B };

/** Immutable identity of the Project/Order source version the artifact was prepared from. */
export type SourceRevisionId = Brand<string, 'SourceRevisionId'>;
/** Content-addressed: derived from the artifact bytes, so one id can only ever mean one byte sequence. */
export type ArtifactId = Brand<string, 'ArtifactId'>;
/** Opaque to everything except the adapter that produced it (for MindAR: the anchor index in the compiled file). */
export type TargetIndex = Brand<number, 'TargetIndex'>;

// ---------------------------------------------------------------------------------------------------------------
// Preparation (server side / build time). Provider-neutral view of "what was prepared from what".
// ---------------------------------------------------------------------------------------------------------------

export interface ARTargetSource {
  readonly sourceRevisionId: SourceRevisionId;
  /** Hash of the exact image bytes the target is prepared from. A different image is a different source. */
  readonly sourceImageSha256: string;
  readonly width: number;
  readonly height: number;
}

/**
 * IMMUTABLE record. Never updated in place. A changed source image or a changed provider/tool version produces a NEW
 * ArtifactId; an Order that referenced the old one keeps resolving to the old bytes (BR-AR-002).
 */
export interface PreparedARArtifact {
  readonly artifactId: ArtifactId;
  readonly sourceRevisionId: SourceRevisionId;
  readonly sourceImageSha256: string;
  readonly artifactSha256: string;
  readonly sizeBytes: number;
  /** Number of targets in the file. Production artifacts have exactly 1 (one designated target, BR-AR-001). */
  readonly targetCount: 1;
  readonly providerId: string; // e.g. 'mindar'
  readonly providerVersion: string; // e.g. 'mind-ar@1.2.5'
  readonly preparedAt: string; // ISO timestamp, informational only; never part of the id
  /**
   * Adapter-bound data (tool name, tooling versions, reproducibility checks). Never exposed in an API DTO and never
   * interpreted outside the adapter (ADR-005).
   */
  readonly providerMetadata: unknown;
}

export interface ARPreparationPort {
  /**
   * Idempotent: the same (source image, provider, provider version) yields the same artifact bytes and therefore the
   * same ArtifactId. Must never mutate an existing artifact. Failure is an explicit error, never a silent fallback to
   * a different target.
   */
  prepare(source: ARTargetSource, imageBytes: Uint8Array): Promise<{ artifact: PreparedARArtifact; bytes: Uint8Array }>;
}

/** Append-only store. `put` of an existing id with different bytes MUST fail. There is no update and no delete in P0. */
export interface ARArtifactStore {
  put(artifact: PreparedARArtifact, bytes: Uint8Array): Promise<void>;
  /** Integrity-checked: returns `unavailable` when bytes are missing or no longer match `artifactSha256`. */
  get(id: ArtifactId): Promise<{ status: 'ok'; artifact: PreparedARArtifact; bytes: Uint8Array } | { status: 'unavailable' }>;
}

// ---------------------------------------------------------------------------------------------------------------
// Recognition (client side). The recognizer only ever reports "which target of the loaded artifact is in view".
// ---------------------------------------------------------------------------------------------------------------

export interface RecognitionEvent {
  readonly artifactId: ArtifactId; // which artifact the device loaded
  readonly targetIndex: TargetIndex; // which target inside it; no provider data, no pose, no frame
}

export interface ARRecognizerPort {
  /** `artifactBytes` were fetched through the authorized artifact endpoint and verified against `artifactSha256`. */
  start(input: { artifactId: ArtifactId; artifactBytes: Uint8Array }, handlers: {
    onFound(event: RecognitionEvent): void;
    onLost(event: RecognitionEvent): void;
    onUnavailable(reason: 'denied' | 'unsupported' | 'failed'): void;
  }): Promise<void>;
  /** Must release every camera track; the caller can assert `liveTracks === 0` afterwards. */
  stop(): Promise<{ liveTracks: number }>;
}

// ---------------------------------------------------------------------------------------------------------------
// Reveal (server side). Authorization lives HERE, never in the recognizer.
// ---------------------------------------------------------------------------------------------------------------

/** Same payload for the AR reveal and the camera-free path (BR-AR-004). Text must be real text, not baked into the image. */
export interface RevealContent {
  readonly title: string;
  readonly message: string;
  readonly image: { readonly url: string; readonly alt: string };
}

/** Caller identity as already resolved by the sharing subsystem (I11/I12). The port does not parse tokens or links. */
export interface AuthorizedShareScope {
  readonly orderVersionId: string;
  /** The single artifact bound to this order version. Absent while preparation failed. */
  readonly boundArtifactId: ArtifactId | undefined;
}

export type RevealResult =
  | { status: 'revealed'; content: RevealContent }
  /**
   * Deliberately one shape for: no scope, other scope, other artifact, unknown target index, and "recognized but not
   * ours". No oracle that distinguishes these (BR-AR-003, INV-08).
   */
  | { status: 'not_found' }
  /** Only for an AUTHORIZED scope whose own artifact cannot be served. The camera-free path still works. */
  | { status: 'unavailable' };

export interface ARRevealService {
  /**
   * Resolves content from `scope` only. The recognition event is a hint that must equal the scope's own binding:
   * `event.artifactId === scope.boundArtifactId` and `event.targetIndex === 0`. It is never a key into any media store,
   * and no function in this port accepts a bare target id and returns media.
   */
  reveal(scope: AuthorizedShareScope | undefined, event: RecognitionEvent): Promise<RevealResult>;
  /** Camera-free path: identical content, identical authorization, no artifact needed. */
  content(scope: AuthorizedShareScope | undefined): Promise<RevealResult>;
}

// ---------------------------------------------------------------------------------------------------------------
// MindAR 1.2.5 adapter mapping (documentation only, see I03-P04 review section 5)
// ---------------------------------------------------------------------------------------------------------------
//   ARPreparationPort.prepare  -> CompilerBase.compileImageTargets([image]) + exportData()  (Node, no native canvas)
//   PreparedARArtifact.artifactSha256 / artifactId -> sha256 of the exported .mind bytes, id = 'ar-' + first 16 hex
//   providerMetadata           -> { tool, toolVersion: 'mind-ar@1.2.5, @tensorflow/tfjs@4.22.0 (cpu)', reproducibility }
//   ARRecognizerPort.start     -> new MindARThree({ imageTargetSrc: blobUrl, maxTrack: 1, ui*: 'no' }); addAnchor(0)
//   RecognitionEvent.targetIndex -> the anchor index passed to addAnchor
//   ARRecognizerPort.stop      -> mindar.stop() + our own getUserMedia track bookkeeping (library does not report it)
