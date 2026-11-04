import {
  assertProjectAction,
  assertProjectDeletionEligible,
} from '../domain/project';
import {
  assertProjectVersion,
  prepareProjectCreation,
  projectDeletionConfirmation,
  projectPatch,
} from './project-contracts';

const owner = {
  kind: 'account',
  id: 'owner',
  accountStatus: 'ACTIVE',
} as const;
const identity = {
  title: 'A year of memories',
  recipientName: 'Bà ngoại',
  year: 2026,
};
const clock = { now: () => new Date('2026-11-04T00:00:00Z') };
const project = prepareProjectCreation(owner, identity, clock, 'UTC');

describe('Project creation and patch contracts', () => {
  it.each([2026, 2028])(
    'accepts year %i within the injected clock window',
    (year) => {
      expect(
        prepareProjectCreation(owner, { ...identity, year }, clock, 'UTC').year,
      ).toBe(year);
    },
  );

  it('uses the configured calendar zone at the year boundary', () => {
    const newYearClock = { now: () => new Date('2026-12-31T17:00:00Z') };
    expect(
      prepareProjectCreation(
        owner,
        { ...identity, year: 2029 },
        newYearClock,
        'Asia/Ho_Chi_Minh',
      ).year,
    ).toBe(2029);
    expect(() =>
      prepareProjectCreation(owner, identity, newYearClock, 'Asia/Ho_Chi_Minh'),
    ).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED', field: 'year' }),
    );
    expect(
      prepareProjectCreation(owner, identity, newYearClock, 'UTC').year,
    ).toBe(2026);
  });

  it('continues to authorize reads and edits after the creation year window has passed', () => {
    let now = new Date('2026-12-31T00:00:00Z');
    const advancingClock = { now: () => now };
    const existing = prepareProjectCreation(
      owner,
      identity,
      advancingClock,
      'UTC',
    );
    now = new Date('2027-01-01T00:00:00Z');
    expect(() =>
      prepareProjectCreation(owner, identity, advancingClock, 'UTC'),
    ).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED', field: 'year' }),
    );
    expect(() => assertProjectAction(owner, existing, 'READ')).not.toThrow();
    expect(() => assertProjectAction(owner, existing, 'EDIT')).not.toThrow();
    expect({
      ...existing,
      ...projectPatch({ title: '  New title ' }),
    }).toMatchObject({
      year: 2026,
      ownerId: owner.id,
      title: 'New title',
    });
  });

  it.each([{ ownerId: 'other-owner' }, { year: 2027 }])(
    'rejects immutable patch fields %p',
    (input) => {
      expect(() => projectPatch({ ...input, title: 'New title' })).toThrow(
        expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      );
    },
  );

  it('accepts the changed identity and style fields and validates changed names', () => {
    expect(
      projectPatch({
        title: '  Calendar  ',
        recipientName: '  Ba\u0300  ',
        stylePresetId: 'CLASSIC',
      }),
    ).toEqual({
      title: 'Calendar',
      recipientName: 'Bà',
      stylePresetId: 'CLASSIC',
    });
    expect(() => projectPatch({ recipientName: ' ' })).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        field: 'recipientName',
      }),
    );
  });

  it('rejects an invisible-only recipient name in a patch', () => {
    expect(() => projectPatch({ recipientName: '\u200b\u200d' })).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        field: 'recipientName',
      }),
    );
  });

  it.each(['title', 'recipientName'] as const)(
    'applies the same grapheme limit to %s on creation and patch',
    (field) => {
      const familyEmoji = '👩‍👧';
      const atLimit = familyEmoji.repeat(80);
      const created = prepareProjectCreation(
        owner,
        { ...identity, [field]: atLimit },
        clock,
        'UTC',
      );
      expect(projectPatch({ [field]: atLimit })).toEqual({
        [field]: created[field],
      });
      expect(() => projectPatch({ [field]: atLimit + familyEmoji })).toThrow(
        expect.objectContaining({ code: 'VALIDATION_FAILED', field }),
      );
    },
  );
});

describe('Project deletion contract', () => {
  it('accepts explicit confirmation for a never-ordered Working or Archived Project', () => {
    expect(projectDeletionConfirmation({ confirmed: true })).toEqual({
      confirmed: true,
    });
    expect(() =>
      assertProjectDeletionEligible(owner, project, 'NEVER_ORDERED'),
    ).not.toThrow();
    expect(() =>
      assertProjectDeletionEligible(
        owner,
        { ...project, status: 'ARCHIVED' },
        'NEVER_ORDERED',
      ),
    ).not.toThrow();
  });

  it.each([{}, { confirmed: false }, { confirmed: 'true' }, { confirmed: 1 }])(
    'requires literal confirmation in %p',
    (input) => {
      expect(() => projectDeletionConfirmation(input)).toThrow(
        expect.objectContaining({
          code: 'VALIDATION_FAILED',
          field: 'confirmed',
        }),
      );
    },
  );
});

describe('Project root revision contract', () => {
  it('accepts the current version and requires an expected version', () => {
    expect(() => assertProjectVersion(project, project.version)).not.toThrow();
    expect(() => assertProjectVersion(project, undefined)).toThrow(
      expect.objectContaining({ code: 'PRECONDITION_REQUIRED' }),
    );
  });

  it('rejects a stale Month edit after a Project update, using the root version rather than the child version', () => {
    const monthEdit = {
      monthNumber: 1,
      expectedProjectVersion: project.version,
    };
    expect(() =>
      assertProjectVersion(project, monthEdit.expectedProjectVersion),
    ).not.toThrow();

    const updatedRoot = { ...project, version: project.version + 1 };
    expect(() =>
      assertProjectVersion(updatedRoot, monthEdit.expectedProjectVersion),
    ).toThrow(
      expect.objectContaining({
        code: 'VERSION_CONFLICT',
        currentVersion: updatedRoot.version,
      }),
    );
    expect(() =>
      assertProjectVersion(updatedRoot, updatedRoot.version),
    ).not.toThrow();
  });
});
