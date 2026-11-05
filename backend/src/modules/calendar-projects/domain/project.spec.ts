import {
  applyProjectPatch,
  assertProjectAction,
  assertProjectDeletionEligible,
  encodeProjectCursor,
  newProject,
  projectListInput,
  projectStatusAfter,
  projectView,
} from './project';

const owner = {
  kind: 'account',
  id: 'owner',
  role: 'USER',
  accountStatus: 'ACTIVE',
} as const;
const otherOwner = { ...owner, id: 'other-owner' };
const admin = { ...otherOwner, role: 'ADMIN' as const };
const disabledOwner = { ...owner, accountStatus: 'DISABLED' as const };
const identity = {
  title: 'A year of memories',
  recipientName: 'Bà ngoại',
  year: 2026,
};
const working = newProject(owner, identity, 2026);
const archived = { ...working, status: 'ARCHIVED' as const };

describe('Project identity and ownership', () => {
  it('establishes one private Working Project for the registered actor', () => {
    expect(working).toMatchObject({
      ...identity,
      ownerId: owner.id,
      status: 'WORKING',
      version: 1,
    });
    expect(() => assertProjectAction(owner, working, 'READ')).not.toThrow();
  });

  it.each(['title', 'recipientName'] as const)(
    'trims %s and accepts 1–80 graphemes',
    (field) => {
      for (const name of ['ệ', '🌷'.repeat(80)]) {
        expect(
          newProject(owner, { ...identity, [field]: `  ${name}\n` }, 2026)[
            field
          ],
        ).toBe(name);
      }
    },
  );

  describe.each(['title', 'recipientName'] as const)(
    '%s validation',
    (field) => {
      it.each([
        '',
        '  \t\n',
        '\u200b',
        '\u200b\u200d',
        '\u0007\u0600',
        'ệ'.repeat(81),
        null,
        'a\u0000b',
        '\ud800',
      ])('rejects invalid input %p', (input) => {
        expect(() =>
          newProject(owner, { ...identity, [field]: input }, 2026),
        ).toThrow(
          expect.objectContaining({ code: 'VALIDATION_FAILED', field }),
        );
      });
    },
  );

  it.each(['title', 'recipientName'] as const)(
    'normalizes decomposed Vietnamese in %s before enforcing the length limit',
    (field) => {
      const decomposed = 'e\u0302\u0323';
      expect(
        newProject(
          owner,
          { ...identity, [field]: decomposed.repeat(80) },
          2026,
        )[field],
      ).toBe('ệ'.repeat(80));
      expect(() =>
        newProject(
          owner,
          { ...identity, [field]: decomposed.repeat(81) },
          2026,
        ),
      ).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED', field }));
    },
  );

  it('preserves Vietnamese text, internal spaces, combining marks and an emoji sequence', () => {
    const name = 'Bà  ngoại 👩‍👧 x\u0301';
    expect(
      newProject(owner, { ...identity, recipientName: name }, 2026)
        .recipientName,
    ).toBe(name);
  });

  it.each(['title', 'recipientName'] as const)(
    'accepts 80 family emoji in %s and rejects 81',
    (field) => {
      const familyEmoji = '👩‍👧';
      const atLimit = familyEmoji.repeat(80);
      expect(
        newProject(owner, { ...identity, [field]: atLimit }, 2026)[field],
      ).toBe(atLimit);
      expect(() =>
        newProject(
          owner,
          { ...identity, [field]: atLimit + familyEmoji },
          2026,
        ),
      ).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED', field }));
    },
  );

  it.each([2025, 2029, 2026.5, 0, -1, NaN, Infinity, '2026', null])(
    'rejects invalid year %p',
    (year) => {
      expect(() => newProject(owner, { ...identity, year }, 2026)).toThrow(
        expect.objectContaining({ code: 'VALIDATION_FAILED', field: 'year' }),
      );
    },
  );

  it('rejects years outside the persisted Gregorian range even when near the clock year', () => {
    expect(() => newProject(owner, { ...identity, year: 10000 }, 9999)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED', field: 'year' }),
    );
  });

  it.each([otherOwner, admin])(
    'conceals the Project from a non-owner with role $role',
    (account) => {
      for (const action of [
        'READ',
        'EDIT',
        'PLACE_ORDER',
        'FIRST_SHARE',
        'MANAGE_EXISTING_SHARE',
      ] as const) {
        expect(() => assertProjectAction(account, working, action)).toThrow(
          expect.objectContaining({ code: 'NOT_FOUND' }),
        );
      }
      expect(() => projectStatusAfter(account, working, 'ARCHIVE')).toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      );
      expect(() => projectStatusAfter(account, archived, 'RESTORE')).toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      );
    },
  );

  it('permits an Admin to edit a Project they own', () => {
    const ownerWithAdminRole = { ...owner, role: 'ADMIN' };
    expect(() =>
      assertProjectAction(ownerWithAdminRole, working, 'EDIT'),
    ).not.toThrow();
  });

  it('rejects a disabled owner and an absent account', () => {
    for (const account of [disabledOwner, null]) {
      expect(() => newProject(account, identity, 2026)).toThrow(
        expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      );
      expect(() => assertProjectAction(account, working, 'EDIT')).toThrow(
        expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      );
      expect(() => projectStatusAfter(account, working, 'ARCHIVE')).toThrow(
        expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      );
      expect(() =>
        assertProjectDeletionEligible(account, working, 'NEVER_ORDERED'),
      ).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
    }
  });
});

describe('Project lifecycle and Order history', () => {
  it('permits working edits and first-time shares at the Project gate', () => {
    expect(() => assertProjectAction(owner, working, 'EDIT')).not.toThrow();
    expect(() =>
      assertProjectAction(owner, working, 'FIRST_SHARE'),
    ).not.toThrow();
  });

  it('archives and restores to the desired state, including safe repeats', () => {
    expect(projectStatusAfter(owner, working, 'ARCHIVE')).toBe('ARCHIVED');
    expect(projectStatusAfter(owner, archived, 'ARCHIVE')).toBe('ARCHIVED');
    expect(projectStatusAfter(owner, archived, 'RESTORE')).toBe('WORKING');
    expect(projectStatusAfter(owner, working, 'RESTORE')).toBe('WORKING');
  });

  it.each(['EDIT', 'PLACE_ORDER', 'FIRST_SHARE'] as const)(
    'blocks %s while Archived',
    (action) => {
      expect(() => assertProjectAction(owner, archived, action)).toThrow(
        expect.objectContaining({ code: 'INVALID_TRANSITION' }),
      );
    },
  );

  it('leaves the archived Project readable and permits existing share management at the Project gate', () => {
    expect(() => assertProjectAction(owner, archived, 'READ')).not.toThrow();
    expect(() =>
      assertProjectAction(owner, archived, 'MANAGE_EXISTING_SHARE'),
    ).not.toThrow();
  });

  it('blocks deletion with Order history, including cancelled and closed Orders, while allowing Working edits and later Orders', () => {
    for (const project of [working, archived]) {
      expect(() =>
        assertProjectDeletionEligible(owner, project, 'HAS_ORDERS'),
      ).toThrow(expect.objectContaining({ code: 'PROJECT_HAS_ORDERS' }));
    }
    expect(() => assertProjectAction(owner, working, 'EDIT')).not.toThrow();
    expect(() =>
      assertProjectAction(owner, working, 'PLACE_ORDER'),
    ).not.toThrow();
    expect(projectStatusAfter(owner, working, 'ARCHIVE')).toBe('ARCHIVED');
  });

  it('rejects cross-owner deletion before disclosing Order history', () => {
    expect(() =>
      assertProjectDeletionEligible(otherOwner, working, 'HAS_ORDERS'),
    ).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });
});

describe('Project safe projection and owner list query', () => {
  const facts = {
    id: '01000000-0000-4000-8000-000000000010',
    title: 'A year of memories',
    year: 2026,
    recipientName: 'Bà ngoại',
    status: 'WORKING' as const,
    version: 3,
    stylePresetId: 'classic',
    baselineNameVi: 'Lịch mùa xuân',
    baselineNameEn: 'Spring calendar',
    baselineStyle: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 },
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-02-03T04:05:06.000Z'),
  };

  it('projects identity, state, baseline and version and nothing internal', () => {
    const view = projectView(facts);
    expect(Object.keys(view).sort()).toEqual([
      'baseline', 'createdAt', 'id', 'recipientName', 'status', 'stylePresetId', 'title', 'updatedAt', 'version', 'year',
    ]);
    expect(view.baseline).toEqual({
      name: { vi: 'Lịch mùa xuân', en: 'Spring calendar' },
      layout: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 },
    });
    expect(view.createdAt).toBe('2026-01-02T03:04:05.000Z');
    // ownerId, template revision, price and currency are never part of the response.
    expect(JSON.stringify(view)).not.toMatch(/owner|templateRevision|unitPrice|currency/);
  });

  it('fails closed when the stored baseline layout is no longer an approved shape', () => {
    for (const corrupt of [null, {}, { ...facts.baselineStyle, type: 'NEON' },
      { ...facts.baselineStyle, monthCount: 6 }, [facts.baselineStyle]]) {
      expect(() => projectView({ ...facts, baselineStyle: corrupt })).toThrow(/Corrupt Project baseline layout/);
    }
  });

  it('applies an identity patch against the presets the Project captured', () => {
    const captured = [{ id: 'classic', nameVi: 'Cổ điển', nameEn: 'Classic' }];
    expect(applyProjectPatch(facts, captured, { title: 'Mới' })).toEqual({ title: 'Mới' });
    expect(applyProjectPatch(facts, captured, { stylePresetId: 'classic' })).toEqual({ stylePresetId: 'classic' });
    expect(() => applyProjectPatch(facts, captured, { stylePresetId: 'vibrant' }))
      .toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED', field: 'stylePresetId' }));
    // An unreadable captured baseline approves nothing rather than everything.
    expect(() => applyProjectPatch(facts, undefined, { stylePresetId: 'classic' }))
      .toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED', field: 'stylePresetId' }));
  });

  it('defaults the owner list to 20 rows, caps it at 50 and rejects an unknown filter', () => {
    expect(projectListInput({})).toEqual({ state: undefined, after: undefined, limit: 20 });
    expect(projectListInput({ limit: 50 }).limit).toBe(50);
    for (const input of [{ limit: 0 }, { limit: 51 }, { limit: 1.5 }, { limit: 'many' },
      { state: 'DELETED' }, { state: 'working' }, { cursor: '' }, { cursor: 'not-a-cursor' }, { after: 1 }]) {
      expect(() => projectListInput(input)).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    }
    expect(() => projectListInput({ limit: 0 })).toThrow(expect.objectContaining({ field: 'limit' }));
    expect(() => projectListInput({ state: 'DELETED' })).toThrow(expect.objectContaining({ field: 'state' }));
    expect(() => projectListInput({ cursor: 'not-a-cursor' })).toThrow(expect.objectContaining({ field: 'cursor' }));
  });

  it('round-trips an opaque cursor through base64url with an id tie-break pair', () => {
    const after = { createdAt: new Date('2026-03-04T05:06:07.000Z'), id: facts.id };
    const token = encodeProjectCursor(after);
    expect(token).not.toContain('createdAt');
    expect(projectListInput({ cursor: token }).after).toEqual(after);
    // A tampered payload is rejected instead of being trusted as a position.
    const tampered = Buffer.from(JSON.stringify({ createdAt: after.createdAt.toISOString(), id: 'other' })).toString('base64url');
    expect(() => projectListInput({ cursor: tampered })).toThrow(expect.objectContaining({ field: 'cursor' }));
  });
});
