import { publicPreviewReadiness } from './public-preview-readiness';
import type { ProjectReadiness, ReadinessIssue } from './readiness';

const policy = (issues: ReadinessIssue[]) => ({ ready: issues.length === 0, issues });

describe('public preview readiness projection', () => {
  it('maps private policy vocabulary to stable public codes and groups by policy', () => {
    const internal: ProjectReadiness = {
      projectVersion: 7,
      preview: policy(['PREVIEW_MONTHS_INVALID']),
      ar: { ...policy(['AR_PREPARATION_PENDING', 'AR_PREPARATION_UNVERIFIED', 'AR_MAPPING_REVIEW_REQUIRED']), preparation: 'PENDING' },
      finalizationContent: policy(['FINALIZATION_PREVIEW_REQUIRED', 'FINALIZATION_NOT_WORKING']),
      finalization: policy(['FINALIZATION_NOT_WORKING', 'FINALIZATION_REVIEW_REQUIRED']),
    };
    const result = publicPreviewReadiness(internal);
    expect(result).toEqual({
      previewReady: false, arReady: false, finalizationContentReady: false, orderReady: false,
      issues: {
        preview: ['PROJECT_MONTHS_INVALID'],
        ar: ['AR_PROCESSING', 'AR_PREPARATION_REQUIRED', 'AR_OWNER_CONFIRMATION_REQUIRED'],
        order: ['PROJECT_ARCHIVED', 'PROJECT_REVIEW_REQUIRED'],
      },
    });
    const serialized = JSON.stringify(result);
    for (const issue of ['PREVIEW_MONTHS_INVALID', 'AR_PREPARATION_PENDING', 'FINALIZATION_NOT_WORKING']) expect(serialized).not.toContain(issue);
  });

  it('coalesces internal details and de-duplicates their public explanation', () => {
    const internal: ProjectReadiness = {
      projectVersion: 1, preview: policy([]), ar: { ...policy(['AR_PREPARATION_MISSING', 'AR_PREPARATION_STALE']), preparation: 'STALE' },
      finalizationContent: policy(['FINALIZATION_AR_REQUIRED']),
      finalization: policy(['FINALIZATION_AR_REQUIRED']),
    };
    const result = publicPreviewReadiness(internal);
    expect(result.issues.ar).toEqual(['AR_PREPARATION_REQUIRED']);
    expect(new Set(Object.values(result.issues).flat()).size).toBeGreaterThan(0);
  });

  it('keeps preview availability independent from order/finalization preparation', () => {
    const internal: ProjectReadiness = {
      projectVersion: 1, preview: policy([]), ar: { ...policy(['AR_NOT_CONFIGURED']), preparation: 'NOT_CONFIGURED' },
      finalizationContent: policy(['FINALIZATION_AR_REQUIRED']),
      finalization: policy(['FINALIZATION_AR_REQUIRED', 'FINALIZATION_REVIEW_REQUIRED']),
    };
    const result = publicPreviewReadiness(internal);
    expect(result.previewReady).toBe(true);
    expect(result.arReady).toBe(false);
    expect(result.orderReady).toBe(false);
    expect(result.finalizationContentReady).toBe(false);
    expect(result.issues.preview).toEqual([]);
  });

  it('keeps content eligibility separate from the owner review acknowledgement', () => {
    const result = publicPreviewReadiness({
      projectVersion: 7,
      preview: policy([]),
      ar: { ...policy([]), preparation: 'VERIFIED' },
      finalizationContent: policy([]),
      finalization: policy(['FINALIZATION_REVIEW_REQUIRED']),
    });
    expect(result.finalizationContentReady).toBe(true);
    expect(result.orderReady).toBe(false);
    expect(result.issues.order).toEqual(['PROJECT_REVIEW_REQUIRED']);
  });
});
