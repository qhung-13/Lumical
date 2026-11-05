import { HttpException } from '@nestjs/common';
import type { TransactionContext } from '../../../platform/database/application/transactions';
import { ActiveAccounts, Clock } from '../../identity/application/ports';
import type { ActiveAccountPrincipal } from '../../identity/domain/identity';
import { ProjectError } from '../domain/project';
import { CreateProject } from './create-project';
import { ProjectOwnerService } from './project-owner';
import { ProjectRepository } from './project-repository';

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
  );

describe('Project restart boundary', () => {
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
