import {
  TEMPLATE_AVAILABILITIES, TemplateAdminError, adminListInput, availabilityChange, canTransition, createInput, draftRecord,
  assertComplete, encodeAdminCursor, invalidTransition, preconditionRequired, projectView, publishInput, revisionInput,
  storedPresets, type TemplateAdminState, type TemplateRevisionInput,
} from './template-admin';

const revision = (): TemplateRevisionInput => ({
  name: { vi: 'Lịch mùa xuân', en: 'Spring calendar' },
  description: { vi: 'Mô tả', en: 'Description' },
  layout: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 },
  presets: [{ id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } }],
  price: { currency: 'USD', unitPriceMinor: 1450n },
});

const json = () => JSON.parse(JSON.stringify(revision(), (_key, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value)) as unknown;

const state = (overrides: Partial<TemplateAdminState> = {}): TemplateAdminState => ({
  id: '11111111-1111-4111-8111-111111111111', category: 'GENERAL', availability: 'INACTIVE', version: 1,
  currentPublishedRevisionId: null, published: null, createdAt: new Date('2026-10-27T08:00:00.000Z'), ...overrides,
});

function expectError(work: () => unknown, code: string, status: number, field?: string): void {
  let thrown: unknown;
  try { work(); } catch (error) { thrown = error; }
  expect(thrown).toBeInstanceOf(TemplateAdminError);
  const failure = thrown as TemplateAdminError;
  expect(failure.code).toBe(code);
  expect(failure.status).toBe(status);
  if (field !== undefined) expect(failure.field).toBe(field);
}

describe('Template availability state machine', () => {
  it('allows every distinct transition and refuses only a no-op repeat', () => {
    for (const from of TEMPLATE_AVAILABILITIES) {
      for (const to of TEMPLATE_AVAILABILITIES) {
        expect(canTransition(from, to)).toBe(from !== to);
      }
    }
  });

  it('uses the same safe precondition vocabulary as the account-status command', () => {
    expect(invalidTransition().code).toBe('INVALID_TRANSITION');
    expect(invalidTransition().status).toBe(409);
    expect(preconditionRequired().code).toBe('PRECONDITION_REQUIRED');
    expect(preconditionRequired().status).toBe(428);
  });
});

describe('operational reason', () => {
  it('accepts a non-empty reason and trims it', () => {
    expect(availabilityChange({ availability: 'ACTIVE', reason: '  Đã kiểm tra  ' }))
      .toEqual({ availability: 'ACTIVE', reason: 'Đã kiểm tra' });
  });

  it.each([
    ['missing', { availability: 'ACTIVE' }, 'reason'],
    ['blank', { availability: 'ACTIVE', reason: '   ' }, 'reason'],
    ['NUL', { availability: 'ACTIVE', reason: `review${String.fromCharCode(0)}` }, 'reason'],
    ['lone surrogate', { availability: 'ACTIVE', reason: 'review\ud800' }, 'reason'],
    ['too long', { availability: 'ACTIVE', reason: 'x'.repeat(1001) }, 'reason'],
    ['unknown availability', { availability: 'PAUSED', reason: 'TEST ONLY' }, 'availability'],
    ['missing availability', { reason: 'TEST ONLY' }, 'availability'],
  ])('rejects %s before any transaction opens', (_label, input, field) => {
    expectError(() => availabilityChange(input), 'VALIDATION_FAILED', 422, field);
  });

  it('rejects unknown and nested keys rather than silently ignoring them', () => {
    expectError(() => availabilityChange({ availability: 'ACTIVE', reason: 'TEST ONLY', version: 2 }), 'VALIDATION_FAILED', 422);
    expectError(() => availabilityChange([{ availability: 'ACTIVE', reason: 'TEST ONLY' }]), 'VALIDATION_FAILED', 422);
    expectError(() => availabilityChange('ACTIVE'), 'VALIDATION_FAILED', 422);
  });
});

describe('revision input', () => {
  it('round-trips a complete bilingual revision', () => {
    expect(revisionInput(json())).toEqual(revision());
  });

  it.each([
    ['zero price', (value: Record<string, unknown>) => { value.price = { currency: 'USD', unitPriceMinor: 0 }; }, 'price.unitPriceMinor'],
    ['negative price', (value: Record<string, unknown>) => { value.price = { currency: 'USD', unitPriceMinor: -1 }; }, 'price.unitPriceMinor'],
    ['fractional price', (value: Record<string, unknown>) => { value.price = { currency: 'USD', unitPriceMinor: 1.5 }; }, 'price.unitPriceMinor'],
    ['unsafe price', (value: Record<string, unknown>) => {
      value.price = { currency: 'USD', unitPriceMinor: 9007199254740992 };
    }, 'price.unitPriceMinor'],
    ['non-USD', (value: Record<string, unknown>) => { value.price = { currency: 'EUR', unitPriceMinor: 1450 }; }, 'price.currency'],
    ['experimental layout', (value: Record<string, unknown>) => {
      value.layout = { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 5 };
    }, 'layout'],
    ['unknown preset id', (value: Record<string, unknown>) => {
      value.presets = [{ id: 'custom', name: { vi: 'A', en: 'B' } }];
    }, 'presets'],
    ['duplicate preset id', (value: Record<string, unknown>) => {
      value.presets = [{ id: 'classic', name: { vi: 'A', en: 'B' } }, { id: 'classic', name: { vi: 'C', en: 'D' } }];
    }, 'presets'],
    ['blank VI name', (value: Record<string, unknown>) => { value.name = { vi: '   ', en: 'Calendar' }; }, 'name.vi'],
    ['surrogate EN name', (value: Record<string, unknown>) => { value.name = { vi: 'Lịch', en: 'Cal\ud800' }; }, 'name.en'],
  ])('rejects %s', (_label, mutate, field) => {
    const input = json() as Record<string, unknown>;
    mutate(input);
    expectError(() => revisionInput(input), 'VALIDATION_FAILED', 422, field);
  });

  it('rejects an empty preset list and unknown top-level keys', () => {
    const input = json() as Record<string, unknown>;
    input.presets = [];
    expectError(() => revisionInput(input), 'VALIDATION_FAILED', 422, 'presets');
    const extra = json() as Record<string, unknown>;
    extra.published = true;
    expectError(() => revisionInput(extra), 'VALIDATION_FAILED', 422);
  });

  it('defaults create and publish reasons but rejects a supplied malformed one', () => {
    expect(createInput({ category: 'GENERAL', revision: json() }).reason).toBe('Initial catalog entry');
    expect(publishInput({ revision: json() }).reason).toBe('Revision published');
    expectError(() => publishInput({ revision: json(), reason: ' ' }), 'VALIDATION_FAILED', 422, 'reason');
    expectError(() => createInput({ category: 'PARTY', revision: revision() }), 'VALIDATION_FAILED', 422, 'category');
  });
});

describe('completeness gate', () => {
  it('accepts a complete draft, so an incomplete definition is the only blocker', () => {
    expect(() => assertComplete(draftRecord('GENERAL', revision()))).not.toThrow();
  });

  // Regression: the gate reads the stored flat preset shape. Forwarding the API's nested
  // { id, name: { vi, en } } pair straight through made every create fail as incomplete.
  it('flattens the nested preset name before the projector sees it', () => {
    const nested = draftRecord('GENERAL', revision());
    expectError(() => assertComplete({ ...nested, revision: { ...nested.revision,
      stylePresets: [{ id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } }] } }),
      'INCOMPLETE_DEFINITION', 422);
    expect(() => assertComplete(draftRecord('GENERAL', revision()))).not.toThrow();
  });

  it('writes the flat three-key preset row P01 SQL filter and projector both read', () => {
    const stored = storedPresets(revision().presets);
    expect(stored).toEqual([{ id: 'classic', nameVi: 'Cổ điển', nameEn: 'Classic' }]);
    for (const preset of stored) expect(Object.keys(preset)).toHaveLength(3);
  });

  it('reports INCOMPLETE_DEFINITION rather than the projector vocabulary', () => {
    const incomplete = draftRecord('GENERAL', revision());
    incomplete.revision.nameEn = ' ';
    expectError(() => assertComplete(incomplete, 'currentPublishedRevisionId'),
      'INCOMPLETE_DEFINITION', 422, 'currentPublishedRevisionId');
  });
});

describe('view projection', () => {
  it('exposes only availability fields and a null revision when nothing is published', () => {
    expect(projectView(state())).toEqual({
      id: '11111111-1111-4111-8111-111111111111', category: 'GENERAL', availability: 'INACTIVE',
      version: 1, currentPublishedRevisionId: null, publishedRevision: null,
    });
  });

  it('carries the published revision number when the pointer is set', () => {
    const published = draftRecord('GENERAL', revision());
    const view = projectView(state({ currentPublishedRevisionId: '22222222-2222-4222-8222-222222222222',
      published: { ...published, revision: { ...published.revision, revision: 4 } } }));
    expect(view.publishedRevision).toBe(4);
    expect(view.currentPublishedRevisionId).toBe('22222222-2222-4222-8222-222222222222');
  });

  // The operational list never leaks createdAt, so paging can depend on a column no client sees.
  it('omits the ordering key from the projection', () => {
    expect(Object.keys(projectView(state())).sort()).toEqual(
      ['availability', 'category', 'currentPublishedRevisionId', 'id', 'publishedRevision', 'version']);
  });
});

// API contract §7: cursor page, default limit 20, maximum 50, allowlisted state filter.
describe('admin list query', () => {
  it('defaults the limit to 20 and leaves filters absent', () => {
    // The controller always builds an object from the query string, so {} is the empty case.
    expect(adminListInput({})).toEqual({ state: undefined, after: undefined, limit: 20 });
  });

  it.each([['minimum', 1], ['middle', 30], ['maximum', 50]])('accepts the %s page size', (_label, limit) => {
    expect(adminListInput({ limit }).limit).toBe(limit);
  });

  it.each([
    ['zero', 0], ['negative', -1], ['fractional', 1.5], ['text', '10'], ['unsafe', Number.MAX_SAFE_INTEGER + 2], ['over maximum', 51],
  ])('rejects a %s page size', (_label, limit) => {
    expectError(() => adminListInput({ limit }), 'VALIDATION_FAILED', 422, 'limit');
  });

  it('accepts each declared availability state and refuses anything else', () => {
    for (const availability of TEMPLATE_AVAILABILITIES) {
      expect(adminListInput({ state: availability }).state).toBe(availability);
    }
    expectError(() => adminListInput({ state: 'PAUSED' }), 'VALIDATION_FAILED', 422, 'state');
    expectError(() => adminListInput({ state: 'active' }), 'VALIDATION_FAILED', 422, 'state');
  });

  it('rejects unknown and nested keys rather than silently ignoring them', () => {
    expectError(() => adminListInput({ category: 'GENERAL' }), 'VALIDATION_FAILED', 422);
    expectError(() => adminListInput({ limit: 10, sort: 'createdDesc' }), 'VALIDATION_FAILED', 422);
    expectError(() => adminListInput([{ limit: 10 }]), 'VALIDATION_FAILED', 422);
    expectError(() => adminListInput('limit=10'), 'VALIDATION_FAILED', 422);
    expectError(() => adminListInput(undefined), 'VALIDATION_FAILED', 422);
  });

  it('round-trips an opaque cursor back to the exact timestamp and id pair', () => {
    const after = { createdAt: new Date('2026-10-27T08:00:00.000Z'), id: '11111111-1111-4111-8111-111111111111' };
    expect(adminListInput({ cursor: encodeAdminCursor(after) }).after).toEqual(after);
  });

  it.each([
    ['empty', ''],
    ['plain JSON', '{"createdAt":"2026-10-27T08:00:00.000Z","id":"11111111-1111-4111-8111-111111111111"}'],
    ['not a pair', Buffer.from(JSON.stringify({ createdAt: '2026-10-27T08:00:00.000Z' })).toString('base64url')],
    ['extra key', Buffer.from(JSON.stringify({
      createdAt: '2026-10-27T08:00:00.000Z', id: '11111111-1111-4111-8111-111111111111', offset: 10 })).toString('base64url')],
    ['bad uuid', Buffer.from(JSON.stringify({ createdAt: '2026-10-27T08:00:00.000Z', id: '11111111-1111-4111-8111-11111111111' })).toString('base64url')],
    ['bad timestamp', Buffer.from(JSON.stringify({ createdAt: 'yesterday', id: '11111111-1111-4111-8111-111111111111' })).toString('base64url')],
    ['truncated token', 'eyJjcmVhdGVkQXQiOiIyMDI2'],
  ])('rejects a %s cursor', (_label, cursor) => {
    expectError(() => adminListInput({ cursor }), 'VALIDATION_FAILED', 422, 'cursor');
  });
});
