import { HttpException } from '@nestjs/common';
import type { TransactionContext } from '../../../platform/database/application/transactions';
import type { OwnerMediaRepository } from '../../media/application/owner-media';
import { ActiveAccounts, Clock } from '../../identity/application/ports';
import type { ActiveAccountPrincipal } from '../../identity/domain/identity';
import { ProjectError } from '../domain/project';
import { CreateProject } from './create-project';
import { ProjectOwnerService } from './project-owner';
import { ProjectRepository } from './project-repository';
import type { ProjectRecord } from './project-repository';

const principal: ActiveAccountPrincipal = {
  kind: 'account',
  id: '01000000-0000-4000-8000-000000000010',
  role: 'USER',
  accountStatus: 'ACTIVE',
};

// The authentication boundary is replaced here so a restart can be observed:
// every attempt re-runs it, which is the point of the retry loop.
class FlakyAccounts extends ActiveAccounts {
  attempts = 0;
  constructor(
    private readonly failures: number,
    private readonly failure: () => unknown,
  ) {
    super();
  }

  withActiveAccount<T>(
    _request: { secret?: string; csrf?: string; origin?: string },
    _mutation: boolean,
    work: (actor: ActiveAccountPrincipal, context: TransactionContext) => Promise<T>,
  ): Promise<T> {
    this.attempts += 1;
    if (this.attempts <= this.failures) return Promise.reject(this.failure());
    return work(principal, {} as TransactionContext);
  }
}

// A PostgreSQL serialization failure the bounded restart exists for.
const serialization = () =>
  Object.assign(new Error('serialization failure'), {
    code: 'P2010',
    meta: { driverAdapterError: { cause: { originalCode: '40001' } } },
  });

const service = (accounts: ActiveAccounts): ProjectOwnerService =>
  new ProjectOwnerService(
    accounts,
    { now: () => new Date('2026-01-01T00:00:00.000Z') } as Clock,
    { list: async () => [] } as unknown as ProjectRepository,
    {} as CreateProject,
    {} as OwnerMediaRepository,
  );

const ownedRecord: ProjectRecord = {
  id: '10000000-0000-4000-8000-000000000001', ownerId: principal.id, title: 'A saved year', year: 2027,
  recipientName: 'Owner', status: 'WORKING', version: 2, stylePresetId: 'classic', baselineNameVi: 'Mẫu', baselineNameEn: 'Design',
  baselineStyle: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 },
  createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-02T00:00:00.000Z'), stylePresets: [],
};

describe('Project child write boundary', () => {
  const event = { date: '2027-01-01', title: 'New event' };
  const key = 'synthetic-event-key';
  function setup(project: ProjectRecord | null = ownedRecord) {
    const advanceVersion = jest.fn().mockResolvedValue(3);
    const saveSpecialDate = jest.fn().mockResolvedValue(ownedRecord.id);
    const completeIntent = jest.fn();
    const replayIntent = jest.fn().mockResolvedValue(null);
    const lock = jest.fn().mockResolvedValue(project);
    const repository = { lock, advanceVersion, saveSpecialDate, completeIntent, replayIntent };
    const app = new ProjectOwnerService(
      new FlakyAccounts(0, serialization),
      { now: () => new Date('2026-01-03T00:00:00.000Z') },
      repository as unknown as ProjectRepository,
      {} as CreateProject,
      {} as OwnerMediaRepository,
    );
    return { app, ...repository };
  }

  it.each([
    [null, '"2"', 'NOT_FOUND'],
    [ownedRecord, undefined, 'PRECONDITION_REQUIRED'],
    [ownedRecord, '"1"', 'VERSION_CONFLICT'],
    [{ ...ownedRecord, status: 'ARCHIVED' as const }, '"2"', 'INVALID_TRANSITION'],
  ] as const)('rejects before mutating the child or advancing the root (%#)', async (row, etag, code) => {
    const { app, advanceVersion, saveSpecialDate, completeIntent } = setup(row);
    await expect(app.createSpecialDate(ownedRecord.id, event, etag, key, {})).rejects.toMatchObject({ code });
    expect(saveSpecialDate).not.toHaveBeenCalled();
    expect(advanceVersion).not.toHaveBeenCalled();
    expect(completeIntent).not.toHaveBeenCalled();
  });

  it('binds the child result and original revision in the same context and replays it without writing', async () => {
    const { app, lock, advanceVersion, saveSpecialDate, completeIntent, replayIntent } = setup();
    const result = await app.createSpecialDate(ownedRecord.id, event, '"2"', key, {});
    const [intent, digest, outcome, context] = completeIntent.mock.calls[0];
    expect(intent).toEqual({ actorId: principal.id, operation: 'SPECIAL_DATE_CREATE', key });
    expect(lock).toHaveBeenCalledWith(principal.id, ownedRecord.id, context);
    expect(saveSpecialDate).toHaveBeenCalledWith(ownedRecord, { ...event, note: null }, undefined, context);
    expect(advanceVersion).toHaveBeenCalledWith(ownedRecord, expect.any(Date), context);
    expect(outcome).toEqual({ resourceId: ownedRecord.id, projectVersion: 3 });

    lock.mockResolvedValue({ ...ownedRecord, version: 3, status: 'ARCHIVED' });
    replayIntent.mockResolvedValue({ digest, ...outcome });
    await expect(app.createSpecialDate(ownedRecord.id, event, '"2"', key, {})).resolves.toEqual(result);
    await expect(app.createSpecialDate(ownedRecord.id, { ...event, title: 'Changed' }, '"2"', key, {}))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(saveSpecialDate).toHaveBeenCalledTimes(1);
    expect(advanceVersion).toHaveBeenCalledTimes(1);
    expect(completeIntent).toHaveBeenCalledTimes(1);
  });
});

describe('Project restart boundary', () => {
  it.each([
    ['never ordered', 'NEVER_ORDERED', true],
    ['has order history', 'HAS_ORDERS', false],
  ] as const)('projects detail deletion eligibility from trusted history when the Project is %s', async (_label, history, eligible) => {
    const repository = {
      find: async () => ownedRecord,
      orderHistory: async () => history,
    } as unknown as ProjectRepository;
    const app = new ProjectOwnerService(
      new FlakyAccounts(0, serialization),
      { now: () => new Date('2026-01-03T00:00:00.000Z') } as Clock,
      repository,
      {} as CreateProject,
      {} as OwnerMediaRepository,
    );
    await expect(app.get(ownedRecord.id, {})).resolves.toMatchObject({ id: ownedRecord.id, deletionEligible: eligible });
  });

  it('restarts a serialization failure and re-runs authentication with it', async () => {
    const accounts = new FlakyAccounts(2, serialization);
    await expect(service(accounts).list({}, {})).resolves.toEqual({
      data: [],
      meta: { nextCursor: null, hasMore: false },
    });
    expect(accounts.attempts).toBe(3);
  });

  it('gives up after three attempts instead of restarting forever', async () => {
    const accounts = new FlakyAccounts(99, serialization);
    await expect(service(accounts).list({}, {})).rejects.toThrow(
      'serialization failure',
    );
    expect(accounts.attempts).toBe(3);
  });

  it.each([
    ['a domain refusal', () => new ProjectError('NOT_FOUND')],
    ['an HTTP refusal', () => new HttpException('forbidden', 403)],
    [
      'an error that already carries a status',
      () => Object.assign(new Error('conflict'), { status: 409, code: 'CONFLICT' }),
    ],
  ])('never restarts %s', async (_label, failure) => {
    const accounts = new FlakyAccounts(99, failure);
    await expect(service(accounts).list({}, {})).rejects.toBeInstanceOf(Error);
    expect(accounts.attempts).toBe(1);
  });

  it('validates the request before opening any transaction', async () => {
    const accounts = new FlakyAccounts(0, serialization);
    await expect(service(accounts).list({ limit: 0 }, {})).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'limit',
    });
    expect(accounts.attempts).toBe(0);
  });
});
