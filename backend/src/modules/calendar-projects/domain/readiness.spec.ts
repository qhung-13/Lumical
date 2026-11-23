import {
  arReadiness,
  finalizationReadiness,
  previewReadiness,
  projectReadiness,
} from './readiness';
import type { ReadinessMedia, ReadinessSnapshot } from './readiness';

const imageId = '10000000-0000-4000-8000-000000000003';
const projectId = '10000000-0000-4000-8000-000000000001';
const ownerId = '10000000-0000-4000-8000-000000000002';
const targetId = '10000000-0000-4000-8000-000000000004';
const media = (overrides: Partial<ReadinessMedia> = {}): ReadinessMedia => ({
  id: imageId,
  ownerId,
  category: 'IMAGE',
  status: 'READY',
  contentVersion: 1,
  verifiedBytes: 42,
  durationMs: null,
  contentType: 'image/png',
  verified: true,
  hasStorage: true,
  deleted: false,
  ...overrides,
});

// Synthetic trusted evidence tests policy acceptance, NOT genuine provider or
// device acceptance. No production adapter manufactures these proofs.
function complete(): ReadinessSnapshot {
  const review = { projectId, ownerId, projectVersion: 7, targetId };
  return {
    project: {
      id: projectId,
      ownerId,
      version: 7,
      status: 'WORKING',
      year: 2000,
      title: 'Saved memories',
      recipientName: 'Family',
    },
    months: Array.from({ length: 12 }, (_, i) => ({
      monthNumber: i + 1,
      images: i === 0 ? [media()] : [],
    })),
    ar: {
      monthNumber: 1,
      revealAssetId: imageId,
      readableText: 'A meaningful memory',
      sourceRevision: 7,
      status: 'READY',
      reveal: media(),
      mappingReview: review,
      target: {
        projectId,
        ownerId,
        sourceRevision: 7,
        monthNumber: 1,
        targetId,
        status: 'READY',
        proof: {
          sourceDigest: 'a'.repeat(64),
          artifactDigest: 'b'.repeat(64),
          revealAssetId: imageId,
          revealContentVersion: 1,
          fallback: {
            projectId,
            ownerId,
            projectVersion: 7,
            revealAssetId: imageId,
            revealContentVersion: 1,
            readableText: 'A meaningful memory',
          },
        },
      },
    },
    review,
  };
}

describe('version-bound readiness policies (synthetic evidence)', () => {
  it('R01: twelve empty Months, zero dates/captions/AR remain previewable', () => {
    const snapshot = complete();
    const result = projectReadiness({
      ...snapshot,
      months: snapshot.months.map((m) => ({ ...m, images: [] })),
      ar: null,
      review: null,
    });
    expect(result.projectVersion).toBe(7);
    expect(result.preview).toEqual({ ready: true, issues: [] });
    expect(result.ar).toEqual({
      ready: false,
      issues: ['AR_NOT_CONFIGURED'],
      preparation: 'NOT_CONFIGURED',
    });
    expect(result.finalization.issues).toEqual([
      'FINALIZATION_PERSONAL_IMAGE_REQUIRED',
      'FINALIZATION_AR_REQUIRED',
      'FINALIZATION_REVIEW_REQUIRED',
    ]);
  });

  it('R02: one Ready image, zero dates and eleven empty Months satisfy completeness; old saved year is valid', () => {
    expect(projectReadiness(complete())).toEqual({
      projectVersion: 7,
      preview: { ready: true, issues: [] },
      ar: { ready: true, issues: [], preparation: 'VERIFIED' },
      finalization: { ready: true, issues: [] },
    });
  });

  it('R03: Archived is owner-previewable but cannot finalize', () => {
    const snapshot = complete();
    const result = projectReadiness({
      ...snapshot,
      project: { ...snapshot.project, status: 'ARCHIVED' },
    });
    expect(result.preview.ready).toBe(true);
    expect(result.finalization.issues).toEqual(['FINALIZATION_NOT_WORKING']);
  });

  it.each([
    [
      'missing Month',
      (s: ReadinessSnapshot) => ({ ...s, months: s.months.slice(1) }),
    ],
    [
      'duplicate Month',
      (s: ReadinessSnapshot) => ({
        ...s,
        months: s.months.map((m) => ({ ...m, monthNumber: 1 })),
      }),
    ],
    [
      'out-of-range Month',
      (s: ReadinessSnapshot) => ({
        ...s,
        months: s.months.map((m) => ({ ...m, monthNumber: m.monthNumber + 1 })),
      }),
    ],
    [
      'invalid identity',
      (s: ReadinessSnapshot) => ({
        ...s,
        project: { ...s.project, title: '  ' },
      }),
    ],
    [
      'invalid saved year',
      (s: ReadinessSnapshot) => ({ ...s, project: { ...s.project, year: 0 } }),
    ],
  ])('R04: rejects invalid saved structure: %s', (_name, change) => {
    const snapshot = change(complete());
    expect(previewReadiness(snapshot).ready).toBe(false);
    expect(arReadiness(snapshot).ready).toBe(false);
    expect(finalizationReadiness(snapshot).issues).toContain(
      'FINALIZATION_PREVIEW_REQUIRED',
    );
  });

  it.each([
    ['PENDING', { status: 'PENDING' as const }],
    ['unavailable', { status: 'UNAVAILABLE' as const }],
    ['foreign owner', { ownerId: 'someone-else' }],
    ['unverified', { verified: false }],
    ['deleted', { deleted: true }],
    ['no bytes', { verifiedBytes: null }],
    ['oversize', { verifiedBytes: 10_000_001 }],
    ['no storage', { hasStorage: false }],
    [
      'wrong category',
      {
        category: 'VIDEO' as const,
        contentType: 'video/mp4',
        durationMs: 5000,
      },
    ],
  ])(
    'R05: %s calendar media cannot satisfy the personal-image gate',
    (_name, values) => {
      const snapshot = complete();
      expect(
        finalizationReadiness({
          ...snapshot,
          months: snapshot.months.map((m, i) => ({
            ...m,
            images: i === 0 ? [media(values)] : [],
          })),
        }).issues,
      ).toEqual(['FINALIZATION_PERSONAL_IMAGE_REQUIRED']);
    },
  );

  it.each([
    ['PREPARING', 'PENDING', 'AR_PREPARATION_PENDING'],
    ['UNAVAILABLE', 'UNAVAILABLE', 'AR_PREPARATION_UNAVAILABLE'],
  ] as const)(
    'R06: configuration %s never means ready',
    (status, preparation, issue) => {
      const snapshot = complete();
      const result = arReadiness({
        ...snapshot,
        ar: { ...snapshot.ar!, status },
      });
      expect(result.ready).toBe(false);
      expect(result.preparation).toBe(preparation);
      expect(result.issues).toContain(issue);
    },
  );

  it('R07: missing artifact and READY row without proof both fail closed', () => {
    const snapshot = complete();
    const ar = snapshot.ar!;
    expect(
      arReadiness({ ...snapshot, ar: { ...ar, target: null } }).issues,
    ).toContain('AR_PREPARATION_MISSING');
    const result = arReadiness({
      ...snapshot,
      ar: { ...ar, target: { ...ar.target!, proof: null } },
    });
    expect(result.ready).toBe(false);
    expect(result.preparation).toBe('UNVERIFIED');
    expect(result.issues).toContain('AR_PREPARATION_UNVERIFIED');
  });

  it.each(['config', 'artifact'] as const)(
    'R08: rejects stale %s revision',
    (subject) => {
      const snapshot = complete();
      const ar = snapshot.ar!;
      const changed =
        subject === 'config'
          ? { ...ar, sourceRevision: 6 }
          : { ...ar, target: { ...ar.target!, sourceRevision: 6 } };
      const result = arReadiness({ ...snapshot, ar: changed });
      expect(result.ready).toBe(false);
      expect(result.preparation).toBe('STALE');
    },
  );

  it.each([
    ['wrong target owner', { ownerId: 'someone-else' }],
    ['wrong target Project', { projectId: 'another-project' }],
    ['wrong designated Month', { monthNumber: 2 }],
    ['missing target identity', { targetId: '' }],
  ])('R09: invalid mapping: %s', (_name, changes) => {
    const snapshot = complete();
    const ar = snapshot.ar!;
    expect(
      arReadiness({
        ...snapshot,
        ar: { ...ar, target: { ...ar.target!, ...changes } },
      }).issues,
    ).toContain('AR_MAPPING_INVALID');
  });

  it('R10: reveal replacement/content version mismatch cannot reuse preparation', () => {
    const snapshot = complete();
    const ar = snapshot.ar!;
    expect(
      arReadiness({
        ...snapshot,
        ar: { ...ar, reveal: media({ contentVersion: 2 }) },
      }).issues,
    ).toContain('AR_MAPPING_INVALID');
    expect(
      arReadiness({
        ...snapshot,
        ar: {
          ...ar,
          target: {
            ...ar.target!,
            proof: {
              ...ar.target!.proof!,
              revealAssetId: 'another-asset',
            },
          },
        },
      }).issues,
    ).toContain('AR_MAPPING_INVALID');
  });

  it.each(['IMAGE', 'VIDEO', 'AUDIO'] as const)(
    'R11: supports %s reveal with readable text and verified current mapping/fallback',
    (category) => {
      const snapshot = complete();
      const ar = snapshot.ar!;
      const reveal = media({
        category,
        durationMs: category === 'IMAGE' ? null : 4000,
        contentType: {
          IMAGE: 'image/png',
          VIDEO: 'video/webm',
          AUDIO: 'audio/ogg',
        }[category],
      });
      expect(arReadiness({ ...snapshot, ar: { ...ar, reveal } }).ready).toBe(
        true,
      );
      expect(
        arReadiness({ ...snapshot, ar: { ...ar, reveal, readableText: '  ' } })
          .issues,
      ).toContain('AR_CONFIGURATION_INVALID');
    },
  );

  it.each([
    ['wrong owner', { ownerId: 'foreign' }],
    ['Pending', { status: 'PENDING' as const }],
    ['no verified bytes', { verifiedBytes: null }],
    ['invalid media type', { contentType: 'text/html' }],
    [
      'video over 60s',
      {
        category: 'VIDEO' as const,
        contentType: 'video/mp4',
        durationMs: 60_001,
      },
    ],
    [
      'audio without duration',
      {
        category: 'AUDIO' as const,
        contentType: 'audio/ogg',
        durationMs: null,
      },
    ],
  ])('R12: rejects unusable reveal: %s', (_name, changes) => {
    const snapshot = complete();
    const ar = snapshot.ar!;
    expect(
      arReadiness({ ...snapshot, ar: { ...ar, reveal: media(changes) } })
        .issues,
    ).toContain('AR_REVEAL_UNAVAILABLE');
  });

  it('R13: fallback must preserve the same authorized content/text/revision', () => {
    const snapshot = complete();
    const ar = snapshot.ar!;
    for (const fallback of [
      null,
      { ...ar.target!.proof!.fallback!, readableText: 'Different message' },
      { ...ar.target!.proof!.fallback!, ownerId: 'foreign' },
      { ...ar.target!.proof!.fallback!, projectVersion: 6 },
    ]) {
      expect(
        arReadiness({
          ...snapshot,
          ar: {
            ...ar,
            target: {
              ...ar.target!,
              proof: {
                ...ar.target!.proof!,
                fallback,
              },
            },
          },
        }).issues,
      ).toContain('AR_FALLBACK_UNVERIFIED');
    }
  });

  it('R14: owner mapping confirmation and current preview review are distinct requirements', () => {
    const snapshot = complete();
    expect(
      arReadiness({ ...snapshot, ar: { ...snapshot.ar!, mappingReview: null } })
        .issues,
    ).toContain('AR_MAPPING_REVIEW_REQUIRED');
    expect(finalizationReadiness({ ...snapshot, review: null }).issues).toEqual(
      ['FINALIZATION_REVIEW_REQUIRED'],
    );
    for (const review of [
      { ...snapshot.review!, projectVersion: 6 },
      { ...snapshot.review!, ownerId: 'foreign' },
      { ...snapshot.review!, projectId: 'foreign' },
      { ...snapshot.review!, targetId: 'different' },
    ])
      expect(finalizationReadiness({ ...snapshot, review }).issues).toEqual([
        'FINALIZATION_REVIEW_STALE',
      ]);
  });

  it('R15: Month/style/date edit after review invalidates preparation and review at root revision N+1', () => {
    const snapshot = complete();
    const result = projectReadiness({
      ...snapshot,
      project: { ...snapshot.project, version: 8 },
    });
    expect(result.preview.ready).toBe(true);
    expect(result.projectVersion).toBe(8);
    expect(result.ar.preparation).toBe('STALE');
    expect(result.finalization.issues).toContain('FINALIZATION_REVIEW_STALE');
  });

  it('R16: AR config edit and late old preparation never restore readiness', () => {
    const snapshot = complete();
    const ar = snapshot.ar!;
    const result = projectReadiness({
      ...snapshot,
      project: { ...snapshot.project, version: 8 },
      ar: {
        ...ar,
        sourceRevision: 8,
        status: 'PREPARING',
        readableText: 'Edited memory',
      },
    });
    expect(result.ar.ready).toBe(false);
    expect(result.ar.preparation).toBe('STALE');
  });

  it('R17: mutable Order/Payment state is absent from readiness and cannot affect it', () => {
    const snapshot = complete();
    const before = projectReadiness(snapshot);
    for (const commerce of [
      { order: null, payment: null },
      { order: 'PLACED', payment: 'COMPLETED' },
      { order: 'CANCELLED', payment: 'FAILED' },
    ])
      expect(projectReadiness({ ...snapshot, ...commerce })).toEqual(before);
    expect(JSON.stringify(before)).not.toMatch(
      /ownerId|assetId|Digest|readableText|storage|targetId|share/i,
    );
  });

  it('R18: corrupted hashes and unconfirmed artifact status never verify preparation', () => {
    const snapshot = complete();
    const ar = snapshot.ar!;
    for (const proof of [
      { ...ar.target!.proof!, sourceDigest: '' },
      { ...ar.target!.proof!, artifactDigest: 'mock-success' },
    ])
      expect(
        arReadiness({
          ...snapshot,
          ar: { ...ar, target: { ...ar.target!, proof } },
        }).preparation,
      ).toBe('UNVERIFIED');
    expect(
      arReadiness({
        ...snapshot,
        ar: { ...ar, target: { ...ar.target!, status: 'UNAVAILABLE' } },
      }).ready,
    ).toBe(false);
  });
});
