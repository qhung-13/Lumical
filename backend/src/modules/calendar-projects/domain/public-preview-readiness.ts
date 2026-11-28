import type { ProjectReadiness, ReadinessIssue } from './readiness';

/** Stable public vocabulary. Never return internal policy rule identifiers. */
export type PublicPreviewIssue =
  | 'PROJECT_STRUCTURE_INVALID'
  | 'PROJECT_MONTHS_INVALID'
  | 'AR_SETUP_REQUIRED'
  | 'AR_SETUP_INVALID'
  | 'AR_MEDIA_UNAVAILABLE'
  | 'AR_PROCESSING'
  | 'AR_PROCESSING_FAILED'
  | 'AR_PREPARATION_REQUIRED'
  | 'AR_CONTENT_INVALID'
  | 'AR_OWNER_CONFIRMATION_REQUIRED'
  | 'PROJECT_CONTENT_INVALID'
  | 'PROJECT_ARCHIVED'
  | 'CALENDAR_IMAGE_REQUIRED'
  | 'AR_REQUIREMENTS_INCOMPLETE'
  | 'PROJECT_REVIEW_REQUIRED';

const publicCode: Record<ReadinessIssue, PublicPreviewIssue> = {
  PREVIEW_INVALID_PROJECT: 'PROJECT_STRUCTURE_INVALID',
  PREVIEW_MONTHS_INVALID: 'PROJECT_MONTHS_INVALID',
  AR_NOT_CONFIGURED: 'AR_SETUP_REQUIRED',
  AR_CONFIGURATION_INVALID: 'AR_SETUP_INVALID',
  AR_REVEAL_UNAVAILABLE: 'AR_MEDIA_UNAVAILABLE',
  AR_PREPARATION_PENDING: 'AR_PROCESSING',
  AR_PREPARATION_UNAVAILABLE: 'AR_PROCESSING_FAILED',
  AR_PREPARATION_MISSING: 'AR_PREPARATION_REQUIRED',
  AR_PREPARATION_UNVERIFIED: 'AR_PREPARATION_REQUIRED',
  AR_PREPARATION_STALE: 'AR_PREPARATION_REQUIRED',
  AR_MAPPING_INVALID: 'AR_CONTENT_INVALID',
  AR_FALLBACK_UNVERIFIED: 'AR_CONTENT_INVALID',
  AR_MAPPING_REVIEW_REQUIRED: 'AR_OWNER_CONFIRMATION_REQUIRED',
  FINALIZATION_PREVIEW_REQUIRED: 'PROJECT_CONTENT_INVALID',
  FINALIZATION_NOT_WORKING: 'PROJECT_ARCHIVED',
  FINALIZATION_PERSONAL_IMAGE_REQUIRED: 'CALENDAR_IMAGE_REQUIRED',
  FINALIZATION_AR_REQUIRED: 'AR_REQUIREMENTS_INCOMPLETE',
  FINALIZATION_REVIEW_REQUIRED: 'PROJECT_REVIEW_REQUIRED',
  FINALIZATION_REVIEW_STALE: 'PROJECT_REVIEW_REQUIRED',
};

export interface PublicPreviewReadiness {
  readonly previewReady: boolean;
  readonly arReady: boolean;
  /** Content eligibility only; owner must separately acknowledge this revision. */
  readonly finalizationContentReady: boolean;
  /** Compatibility field. This is content/finalization preparation, not checkout permission. */
  readonly orderReady: boolean;
  readonly issues: {
    readonly preview: readonly PublicPreviewIssue[];
    readonly ar: readonly PublicPreviewIssue[];
    readonly order: readonly PublicPreviewIssue[];
  };
}

function mapIssues(issues: readonly ReadinessIssue[]): PublicPreviewIssue[] {
  return [...new Set(issues.map(issue => publicCode[issue]))];
}

export function publicPreviewReadiness(value: ProjectReadiness): PublicPreviewReadiness {
  return {
    previewReady: value.preview.ready,
    arReady: value.ar.ready,
    finalizationContentReady: value.finalizationContent.ready,
    orderReady: value.finalization.ready,
    issues: {
      preview: mapIssues(value.preview.issues),
      ar: mapIssues(value.ar.issues),
      order: mapIssues(value.finalization.issues),
    },
  };
}
