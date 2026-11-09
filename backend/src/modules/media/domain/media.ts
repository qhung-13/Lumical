export type MediaCategory = 'IMAGE' | 'VIDEO' | 'AUDIO';
export type MediaReadiness = 'PENDING' | 'READY' | 'UNAVAILABLE';

export const MEDIA_LIMITS = {
  IMAGE: { maxBytes: 10_000_000, maxDurationSeconds: null },
  VIDEO: { maxBytes: 100_000_000, maxDurationSeconds: 60 },
  AUDIO: { maxBytes: 20_000_000, maxDurationSeconds: 60 },
} as const;

// Conservative initial allowlist; active content (including SVG/HTML) is excluded.
const CONTENT_TYPES: Record<MediaCategory, readonly string[]> = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
  VIDEO: ['video/mp4', 'video/webm'],
  AUDIO: ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm'],
};

export interface MediaBinding {
  readonly assetId: string;
  readonly ownerId: string;
  readonly uploadIntentId: string;
}

/** Opaque backend-only reference: never a delivery URL or a public DTO field. */
export interface ImmutableMedia {
  readonly binding: MediaBinding;
  readonly storageKey: string;
  readonly contentVersion: string;
}

export interface VerifiedMediaFacts {
  readonly object: ImmutableMedia;
  readonly category: MediaCategory;
  readonly contentType: string;
  readonly bytes: number;
  readonly durationSeconds: number | null;
  readonly privateOriginal: boolean;
  readonly privateDerivatives: boolean;
}

export type Inspection =
  | { readonly kind: 'VERIFIED'; readonly facts: VerifiedMediaFacts }
  | { readonly kind: 'PENDING' }
  | { readonly kind: 'UNAVAILABLE' };

export type ReadinessDecision =
  | { readonly status: 'READY'; readonly facts: VerifiedMediaFacts }
  | { readonly status: 'PENDING' }
  | { readonly status: 'UNAVAILABLE'; readonly reason: 'STORAGE_UNAVAILABLE' | 'INVALID_FACTS' };

export function assessReadiness(
  expected: MediaBinding,
  category: MediaCategory,
  inspection: Inspection,
): ReadinessDecision {
  if (inspection.kind === 'PENDING') return { status: 'PENDING' };
  if (inspection.kind === 'UNAVAILABLE') return { status: 'UNAVAILABLE', reason: 'STORAGE_UNAVAILABLE' };
  const facts = inspection.facts;
  const binding = facts.object.binding;
  const limit = MEDIA_LIMITS[category];
  const duration = facts.durationSeconds;
  if (
    binding.assetId !== expected.assetId || binding.ownerId !== expected.ownerId ||
    binding.uploadIntentId !== expected.uploadIntentId ||
    !facts.object.storageKey.trim() || !facts.object.contentVersion.trim() ||
    facts.category !== category || !facts.privateOriginal || !facts.privateDerivatives ||
    !CONTENT_TYPES[category].includes(facts.contentType) ||
    !Number.isSafeInteger(facts.bytes) || facts.bytes <= 0 || facts.bytes > limit.maxBytes ||
    (category !== 'IMAGE' && (duration === null || !Number.isFinite(duration) ||
      duration <= 0 || duration > limit.maxDurationSeconds!))
  ) return { status: 'UNAVAILABLE', reason: 'INVALID_FACTS' };
  return { status: 'READY', facts };
}