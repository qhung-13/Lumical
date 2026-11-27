import { arWrite } from './personalization';
import { ProjectError, projectName } from './project';
import type { ProjectIdentity, ProjectRoot } from './project';
import type { MediaCategory, MediaReadiness } from '../../media/domain/media';
import {
  MEDIA_LIMITS,
  isSupportedMediaContentType,
} from '../../media/domain/media';

// I08-P01 internal policy vocabulary. HTTP responses must pass through the
// explicit public mapping in public-preview-readiness.ts.
export type ReadinessIssue =
  | 'PREVIEW_INVALID_PROJECT'
  | 'PREVIEW_MONTHS_INVALID'
  | 'AR_NOT_CONFIGURED'
  | 'AR_CONFIGURATION_INVALID'
  | 'AR_REVEAL_UNAVAILABLE'
  | 'AR_PREPARATION_PENDING'
  | 'AR_PREPARATION_UNAVAILABLE'
  | 'AR_PREPARATION_MISSING'
  | 'AR_PREPARATION_UNVERIFIED'
  | 'AR_PREPARATION_STALE'
  | 'AR_MAPPING_INVALID'
  | 'AR_FALLBACK_UNVERIFIED'
  | 'AR_MAPPING_REVIEW_REQUIRED'
  | 'FINALIZATION_PREVIEW_REQUIRED'
  | 'FINALIZATION_NOT_WORKING'
  | 'FINALIZATION_PERSONAL_IMAGE_REQUIRED'
  | 'FINALIZATION_AR_REQUIRED'
  | 'FINALIZATION_REVIEW_REQUIRED'
  | 'FINALIZATION_REVIEW_STALE';

export interface ReadinessMedia {
  readonly id: string;
  readonly ownerId: string;
  readonly category: MediaCategory;
  readonly status: MediaReadiness;
  readonly contentVersion: number;
  readonly verifiedBytes: number | null;
  readonly durationMs: number | null;
  readonly contentType: string | null;
  readonly verified: boolean;
  readonly hasStorage: boolean;
  readonly deleted: boolean;
}

// These are trusted, server-established facts, never client input or a READY
// database flag. P02/P04/P05 must supply reviewed verification/acknowledgement
// adapters. The current persistence adapter always supplies null proof/reviews.
export interface PreviewReviewEvidence {
  readonly projectId: string;
  readonly ownerId: string;
  readonly projectVersion: number;
  readonly targetId: string;
}

export interface PreparationProof {
  readonly sourceDigest: string;
  readonly artifactDigest: string;
  readonly revealAssetId: string;
  readonly revealContentVersion: number;
  readonly fallback: {
    readonly projectId: string;
    readonly ownerId: string;
    readonly projectVersion: number;
    readonly revealAssetId: string;
    readonly revealContentVersion: number;
    readonly readableText: string;
  } | null;
}

export interface ReadinessAR {
  readonly monthNumber: number;
  readonly revealAssetId: string;
  readonly readableText: string;
  readonly sourceRevision: number;
  readonly status: 'NOT_CONFIGURED' | 'PREPARING' | 'READY' | 'UNAVAILABLE';
  readonly reveal: ReadinessMedia | null;
  readonly target: {
    readonly projectId: string;
    readonly ownerId: string;
    readonly sourceRevision: number;
    readonly monthNumber: number | null;
    readonly targetId: string;
    readonly status: ReadinessAR['status'];
    readonly proof: PreparationProof | null;
  } | null;
  readonly mappingReview: PreviewReviewEvidence | null;
}

export interface ReadinessSnapshot {
  readonly project: ProjectRoot & ProjectIdentity & { readonly id: string };
  readonly months: readonly {
    readonly monthNumber: number;
    readonly images: readonly ReadinessMedia[];
  }[];
  readonly ar: ReadinessAR | null;
  readonly review: PreviewReviewEvidence | null;
}

export interface PolicyReadiness {
  readonly ready: boolean;
  readonly issues: readonly ReadinessIssue[];
}
export interface ProjectReadiness {
  readonly projectVersion: number;
  readonly preview: PolicyReadiness;
  readonly ar: PolicyReadiness & {
    readonly preparation:
      | 'NOT_CONFIGURED'
      | 'PENDING'
      | 'UNAVAILABLE'
      | 'MISSING'
      | 'STALE'
      | 'UNVERIFIED'
      | 'VERIFIED';
  };
  readonly finalization: PolicyReadiness;
}

const policy = (issues: ReadinessIssue[]): PolicyReadiness => ({
  ready: issues.length === 0,
  issues,
});
const positiveInteger = (value: number) =>
  Number.isSafeInteger(value) && value > 0;
const digest = (value: string) => /^[a-f0-9]{64}$/i.test(value);

export function usable(
  media: ReadinessMedia | null,
  ownerId: string,
): media is ReadinessMedia {
  if (
    !media ||
    media.ownerId !== ownerId ||
    media.status !== 'READY' ||
    media.deleted ||
    !media.verified ||
    !media.hasStorage ||
    !positiveInteger(media.contentVersion) ||
    !media.verifiedBytes ||
    !positiveInteger(media.verifiedBytes)
  )
    return false;
  const bytes = media.verifiedBytes;
  const limits = MEDIA_LIMITS[media.category];
  if (
    bytes > limits.maxBytes ||
    !isSupportedMediaContentType(media.category, media.contentType)
  )
    return false;
  if (media.category === 'IMAGE') return true;
  const duration = media.durationMs;
  return (
    duration !== null &&
    positiveInteger(duration) &&
    limits.maxDurationSeconds !== null &&
    duration <= limits.maxDurationSeconds * 1000
  );
}

// BR-RDY-001, BR-MON-001/003, BR-PRJ-002/005: no photo/date/AR gate,
// no creation-time year-window recheck, and archived owner-readable work remains previewable.
export function previewReadiness(snapshot: ReadinessSnapshot): PolicyReadiness {
  const { project, months } = snapshot;
  const issues: ReadinessIssue[] = [];
  try {
    projectName(project.title, 'title');
    projectName(project.recipientName, 'recipientName');
    if (
      !project.id ||
      !project.ownerId ||
      !positiveInteger(project.version) ||
      !Number.isInteger(project.year) ||
      project.year < 1 ||
      project.year > 9999 ||
      !['WORKING', 'ARCHIVED'].includes(project.status)
    )
      throw new ProjectError('VALIDATION_FAILED');
  } catch (error) {
    if (!(error instanceof ProjectError)) throw error;
    issues.push('PREVIEW_INVALID_PROJECT');
  }
  if (
    months.length !== 12 ||
    new Set(months.map((m) => m.monthNumber)).size !== 12 ||
    months.some(
      (m) =>
        !Number.isInteger(m.monthNumber) ||
        m.monthNumber < 1 ||
        m.monthNumber > 12,
    )
  )
    issues.push('PREVIEW_MONTHS_INVALID');
  return policy(issues);
}

function currentReview(
  snapshot: ReadinessSnapshot,
  review: PreviewReviewEvidence | null,
): boolean {
  const { project, ar } = snapshot;
  return (
    review !== null &&
    review.projectId === project.id &&
    review.ownerId === project.ownerId &&
    review.projectVersion === project.version &&
    !!ar?.target &&
    review.targetId === ar.target.targetId
  );
}

// BR-RDY-002, BR-MED-001..004, ADR-005: configuration/status alone never proves readiness.
export function arReadiness(
  snapshot: ReadinessSnapshot,
): ProjectReadiness['ar'] {
  const { ar, project } = snapshot;
  if (!ar)
    return { ...policy(['AR_NOT_CONFIGURED']), preparation: 'NOT_CONFIGURED' };
  const issues: ReadinessIssue[] = [];
  try {
    if (!previewReadiness(snapshot).ready)
      throw new ProjectError('VALIDATION_FAILED');
    arWrite({
      monthNumber: ar.monthNumber,
      revealAssetId: ar.revealAssetId,
      readableText: ar.readableText,
    });
    if (!snapshot.months.some((m) => m.monthNumber === ar.monthNumber))
      throw new ProjectError('VALIDATION_FAILED');
  } catch (error) {
    if (!(error instanceof ProjectError)) throw error;
    issues.push('AR_CONFIGURATION_INVALID');
  }
  const reveal = ar.reveal;
  if (!usable(reveal, project.ownerId) || reveal.id !== ar.revealAssetId)
    issues.push('AR_REVEAL_UNAVAILABLE');

  const target = ar.target;
  let preparation: ProjectReadiness['ar']['preparation'];
  if (
    ar.sourceRevision !== project.version ||
    (target && target.sourceRevision !== project.version)
  ) {
    preparation = 'STALE';
    issues.push('AR_PREPARATION_STALE');
  } else if (ar.status === 'UNAVAILABLE' || target?.status === 'UNAVAILABLE') {
    preparation = 'UNAVAILABLE';
    issues.push('AR_PREPARATION_UNAVAILABLE');
  } else if (ar.status === 'PREPARING' || target?.status === 'PREPARING') {
    preparation = 'PENDING';
    issues.push('AR_PREPARATION_PENDING');
  } else if (!target) {
    preparation = 'MISSING';
    issues.push('AR_PREPARATION_MISSING');
  } else if (
    ar.status !== 'READY' ||
    target.status !== 'READY' ||
    !target.proof ||
    !digest(target.proof.sourceDigest) ||
    !digest(target.proof.artifactDigest)
  ) {
    preparation = 'UNVERIFIED';
    issues.push('AR_PREPARATION_UNVERIFIED');
  } else preparation = 'VERIFIED';

  if (target) {
    const proof = target.proof;
    if (
      target.projectId !== project.id ||
      target.ownerId !== project.ownerId ||
      !target.targetId ||
      target.monthNumber !== ar.monthNumber ||
      (proof &&
        (proof.revealAssetId !== ar.revealAssetId ||
          proof.revealContentVersion !== reveal?.contentVersion))
    )
      issues.push('AR_MAPPING_INVALID');
    const fallback = proof?.fallback;
    if (
      !fallback ||
      fallback.projectId !== project.id ||
      fallback.ownerId !== project.ownerId ||
      fallback.projectVersion !== project.version ||
      fallback.revealAssetId !== ar.revealAssetId ||
      fallback.revealContentVersion !== reveal?.contentVersion ||
      fallback.readableText !== ar.readableText
    )
      issues.push('AR_FALLBACK_UNVERIFIED');
    if (!currentReview(snapshot, ar.mappingReview))
      issues.push('AR_MAPPING_REVIEW_REQUIRED');
  }
  return { ...policy(issues), preparation };
}

// BR-RDY-003. Shared content/review criteria only: no Order, Payment or Sharing inputs.
export function finalizationReadiness(
  snapshot: ReadinessSnapshot,
): PolicyReadiness {
  const preview = previewReadiness(snapshot);
  const ar = arReadiness(snapshot);
  const issues: ReadinessIssue[] = [];
  if (!preview.ready) issues.push('FINALIZATION_PREVIEW_REQUIRED');
  if (snapshot.project.status !== 'WORKING')
    issues.push('FINALIZATION_NOT_WORKING');
  if (
    !snapshot.months.some((month) =>
      month.images.some(
        (image) =>
          image.category === 'IMAGE' && usable(image, snapshot.project.ownerId),
      ),
    )
  )
    issues.push('FINALIZATION_PERSONAL_IMAGE_REQUIRED');
  if (!ar.ready) issues.push('FINALIZATION_AR_REQUIRED');
  if (!snapshot.review) issues.push('FINALIZATION_REVIEW_REQUIRED');
  else if (!currentReview(snapshot, snapshot.review))
    issues.push('FINALIZATION_REVIEW_STALE');
  return policy(issues);
}

export function projectReadiness(
  snapshot: ReadinessSnapshot,
): ProjectReadiness {
  const preview = previewReadiness(snapshot);
  const ar = arReadiness(snapshot);
  return {
    projectVersion: snapshot.project.version,
    preview,
    ar,
    finalization: finalizationReadiness(snapshot),
  };
}
