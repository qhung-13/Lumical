import { TemplateAdminService } from './template-admin';
import type { TemplateAdminRepository } from './ports';
import type { TransactionContext, Transactions } from '../../../platform/database/application/transactions';
import type { ActiveAccounts } from '../../identity/application/ports';
import { draftRecord, type TemplateAdminState, type TemplateRevisionInput } from '../domain/template-admin';

const CONTEXT = { scope: Symbol('template-admin-test') } as TransactionContext;
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MEMBER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const FIRST_REVISION_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_REVISION_ID = '33333333-3333-4333-8333-333333333333';
const THIRD_TEMPLATE_ID = '44444444-4444-4444-8444-444444444444';
const KEY = 'idempotency-key-0123456789';
const browser = { requestId: 'req-1' };

const revision = (unitPriceMinor: bigint = 1450n): TemplateRevisionInput => ({
  name: { vi: 'Lịch mùa xuân', en: 'Spring calendar' },
  description: { vi: 'Mô tả', en: 'Description' },
  layout: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 },
  presets: [{ id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } }],
  price: { currency: 'USD', unitPriceMinor },
});

// The HTTP body is JSON, so the price crosses the boundary as a number rather than a bigint.
const body = () => JSON.parse(JSON.stringify({ category: 'GENERAL', revision: revision() },
  (_key, value: unknown) => (typeof value === 'bigint' ? Number(value) : value))) as { category: string; revision: unknown };

const changeBody = (availability: string, reason = 'Đã kiểm tra') => ({ availability, reason });

const state = (overrides: Partial<TemplateAdminState> = {}): TemplateAdminState => ({
  id: TEMPLATE_ID, category: 'GENERAL', availability: 'INACTIVE', version: 1,
  currentPublishedRevisionId: null, published: null, createdAt: new Date('2026-10-27T08:00:00.000Z'), ...overrides,
});

const publishedState = (overrides: Partial<TemplateAdminState> = {}) => state({
  availability: 'ARCHIVED', version: 4, currentPublishedRevisionId: FIRST_REVISION_ID,
  published: draftRecord('GENERAL', revision()), ...overrides,
});

type RepositoryMock = Record<
  'lock' | 'list' | 'create' | 'publish' | 'setAvailability' | 'audit' | 'replay' | 'saveReplay', jest.Mock>;

function harness(overrides: Partial<RepositoryMock> = {}) {
  const repository = {
    lock: jest.fn(), list: jest.fn().mockResolvedValue([]), create: jest.fn(), publish: jest.fn(),
    setAvailability: jest.fn().mockResolvedValue(undefined),
    audit: jest.fn().mockResolvedValue(undefined),
    replay: jest.fn().mockResolvedValue(null),
    saveReplay: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as RepositoryMock;
  const transactions = { run: jest.fn((work: (context: TransactionContext) => Promise<unknown>) => work(CONTEXT)) };
  const principal = { kind: 'account', id: ADMIN_ID, role: 'ADMIN', accountStatus: 'ACTIVE' };
  const accounts = {
    withActiveAccount: jest.fn((_request: unknown, _mutation: boolean,
      work: (value: typeof principal, context: TransactionContext) => Promise<unknown>) => work(principal, CONTEXT)),
  };
  const service = new TemplateAdminService(
    repository as unknown as TemplateAdminRepository,
    transactions as unknown as Transactions,
    accounts as unknown as ActiveAccounts);
  return { repository, transactions, accounts, service };
}

describe('TemplateAdminService list', () => {
  it('answers an empty page and writes no audit row for an operational read', async () => {
    const { repository, service } = harness();
    await expect(service.list({}, browser)).resolves.toEqual({
      data: [], meta: { nextCursor: null, hasMore: false },
    });
    // BR-ADM-001: listing is not a publication action, so only mutations are audited.
    expect(repository.audit).not.toHaveBeenCalled();
    expect(repository.lock).not.toHaveBeenCalled();
  });

  it('passes the state filter, one extra row and the cursor pair to the repository', async () => {
    const { repository, service } = harness();
    const cursor = Buffer.from(JSON.stringify({
      createdAt: '2026-10-27T08:00:00.000Z', id: TEMPLATE_ID })).toString('base64url');
    await service.list({ state: 'ACTIVE', cursor, limit: 10 }, browser);
    expect(repository.list).toHaveBeenCalledWith({
      state: 'ACTIVE', after: { createdAt: new Date('2026-10-27T08:00:00.000Z'), id: TEMPLATE_ID }, take: 11,
    }, CONTEXT);
  });

  it('slices the extra row into nextCursor and hasMore', async () => {
    const rows = [state({ version: 3, createdAt: new Date('2026-10-27T09:00:00.000Z') }),
      state({ id: THIRD_TEMPLATE_ID, createdAt: new Date('2026-10-27T08:00:00.000Z') })];
    const { service } = harness({ list: jest.fn().mockResolvedValue(rows) });
    await expect(service.list({ limit: 1 }, browser)).resolves.toEqual({
      data: [{ id: TEMPLATE_ID, category: 'GENERAL', availability: 'INACTIVE', version: 3,
        currentPublishedRevisionId: null, publishedRevision: null }],
      meta: { nextCursor: Buffer.from(JSON.stringify({
        createdAt: '2026-10-27T09:00:00.000Z', id: TEMPLATE_ID })).toString('base64url'), hasMore: true },
    });
  });

  it('reports a final page with a null cursor', async () => {
    const { service } = harness({ list: jest.fn().mockResolvedValue([state()]) });
    await expect(service.list({ limit: 1 }, browser)).resolves.toEqual({
      data: [{ id: TEMPLATE_ID, category: 'GENERAL', availability: 'INACTIVE', version: 1,
        currentPublishedRevisionId: null, publishedRevision: null }],
      meta: { nextCursor: null, hasMore: false },
    });
  });

  it('rejects a bad query before the repository is reached', async () => {
    const { repository, service } = harness();
    await expect(service.list({ state: 'PAUSED' }, browser))
      .rejects.toMatchObject({ status: 422, code: 'VALIDATION_FAILED', field: 'state' });
    await expect(service.list({ limit: 51 }, browser))
      .rejects.toMatchObject({ status: 422, code: 'VALIDATION_FAILED', field: 'limit' });
    expect(repository.list).not.toHaveBeenCalled();
  });
});

describe('TemplateAdminService authorization', () => {
  it('refuses a non-admin principal before any repository method runs', async () => {
    const { repository, accounts, service } = harness();
    accounts.withActiveAccount.mockImplementation((_request, _mutation, work) =>
      work({ kind: 'account', id: MEMBER_ID, role: 'MEMBER', accountStatus: 'ACTIVE' }, CONTEXT));
    await expect(service.create(body(), KEY, browser)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(repository.replay).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("keeps Identity's own 401 instead of degrading it into a 503", async () => {
    const { accounts, service } = harness();
    accounts.withActiveAccount.mockImplementation(() => Promise.reject({ status: 401, code: 'UNAUTHENTICATED' }));
    await expect(service.list({}, browser)).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('refuses the operational list for a non-admin principal before the repository runs', async () => {
    const { repository, accounts, service } = harness();
    accounts.withActiveAccount.mockImplementation((_request, _mutation, work) =>
      work({ kind: 'account', id: MEMBER_ID, role: 'MEMBER', accountStatus: 'ACTIVE' }, CONTEXT));
    await expect(service.list({}, browser)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(repository.list).not.toHaveBeenCalled();
  });
});

describe('TemplateAdminService precondition and version conflicts', () => {
  it('requires If-Match before it will touch the template', async () => {
    const { repository, service } = harness();
    await expect(service.availability(TEMPLATE_ID, changeBody('ACTIVE'), KEY, undefined, browser))
      .rejects.toMatchObject({ status: 428, code: 'PRECONDITION_REQUIRED' });
    expect(repository.lock).not.toHaveBeenCalled();
  });

  it('rejects a malformed If-Match rather than assuming version 1', async () => {
    const { repository, service } = harness();
    await expect(service.availability(TEMPLATE_ID, changeBody('ACTIVE'), KEY, '1', browser))
      .rejects.toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
    expect(repository.lock).not.toHaveBeenCalled();
  });

  it('answers 412 carrying the current version when If-Match is stale', async () => {
    const { repository, service } = harness({ lock: jest.fn().mockResolvedValue(state({ version: 3 })) });
    await expect(service.availability(TEMPLATE_ID, changeBody('ACTIVE'), KEY, '"1"', browser))
      .rejects.toMatchObject({ status: 412, code: 'VERSION_CONFLICT', currentVersion: 3 });
    expect(repository.setAvailability).not.toHaveBeenCalled();
  });

  it('requires a well-formed Idempotency-Key before opening a transaction', async () => {
    const { repository, transactions, service } = harness();
    await expect(service.create(body(), undefined, browser)).rejects.toMatchObject({ status: 422 });
    await expect(service.create(body(), 'too-short', browser)).rejects.toMatchObject({ status: 422 });
    expect(transactions.run).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe('TemplateAdminService availability transitions', () => {
  it('refuses a no-op repeat with the safe invalid-transition conflict', async () => {
    const { repository, service } = harness({
      lock: jest.fn().mockResolvedValue(publishedState({ availability: 'ACTIVE', version: 1 })),
    });
    await expect(service.availability(TEMPLATE_ID, changeBody('ACTIVE'), KEY, '"1"', browser))
      .rejects.toMatchObject({ status: 409, code: 'INVALID_TRANSITION' });
    expect(repository.setAvailability).not.toHaveBeenCalled();
    expect(repository.audit).not.toHaveBeenCalled();
  });

  it('refuses activation of a template with no published revision', async () => {
    const { repository, service } = harness({ lock: jest.fn().mockResolvedValue(state({ availability: 'ARCHIVED' })) });
    await expect(service.availability(TEMPLATE_ID, changeBody('ACTIVE'), KEY, '"1"', browser))
      .rejects.toMatchObject({ status: 409, code: 'INCOMPLETE_PUBLICATION' });
    expect(repository.setAvailability).not.toHaveBeenCalled();
    expect(repository.audit).not.toHaveBeenCalled();
  });

  it('refuses activation when the stored published revision no longer projects', async () => {
    const corrupt = publishedState();
    if (corrupt.published) corrupt.published.revision.nameEn = ' ';
    const { repository, service } = harness({ lock: jest.fn().mockResolvedValue(corrupt) });
    await expect(service.availability(TEMPLATE_ID, changeBody('ACTIVE'), KEY, '"4"', browser))
      .rejects.toMatchObject({ status: 409, code: 'INCOMPLETE_PUBLICATION' });
    expect(repository.setAvailability).not.toHaveBeenCalled();
  });

  it('allows ARCHIVED back into the catalog and orders state, audit, replay', async () => {
    const { repository, service } = harness({
      lock: jest.fn().mockResolvedValue(publishedState({ version: 4 })),
    });
    await expect(service.availability(TEMPLATE_ID, changeBody('ACTIVE', '  Đã kiểm tra  '), KEY, '"4"', browser))
      .resolves.toEqual({
        id: TEMPLATE_ID, category: 'GENERAL', availability: 'ACTIVE', version: 5,
        currentPublishedRevisionId: FIRST_REVISION_ID, publishedRevision: 1,
      });
    expect(repository.setAvailability).toHaveBeenCalledWith(TEMPLATE_ID, 'ACTIVE', expect.any(Date), CONTEXT);
    expect(repository.audit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: ADMIN_ID, action: 'TEMPLATE_ACTIVE', targetId: TEMPLATE_ID, purpose: 'Đã kiểm tra', correlationId: 'req-1',
    }), CONTEXT);
    expect(repository.saveReplay).toHaveBeenCalledWith(expect.objectContaining({
      operation: `TEMPLATE_AVAILABILITY:${TEMPLATE_ID}`, targetId: TEMPLATE_ID,
      safeResult: expect.objectContaining({ availability: 'ACTIVE', version: 5 }),
    }), CONTEXT);
    expect(repository.setAvailability.mock.invocationCallOrder[0]).toBeLessThan(repository.audit.mock.invocationCallOrder[0]);
    expect(repository.audit.mock.invocationCallOrder[0]).toBeLessThan(repository.saveReplay.mock.invocationCallOrder[0]);
  });
});

describe('TemplateAdminService create and publish', () => {
  it('creates a template as INACTIVE with revision 1 and records the audit row', async () => {
    const { repository, service } = harness({
      create: jest.fn().mockResolvedValue({ id: TEMPLATE_ID, revision: { revisionId: FIRST_REVISION_ID, revision: 1 } }),
    });
    await expect(service.create(body(), KEY, browser)).resolves.toEqual({
      id: TEMPLATE_ID, category: 'GENERAL', availability: 'INACTIVE', version: 1,
      currentPublishedRevisionId: FIRST_REVISION_ID, publishedRevision: 1,
    });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ category: 'GENERAL' }), CONTEXT);
    expect(repository.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'TEMPLATE_CREATED', purpose: 'Initial catalog entry',
    }), CONTEXT);
    expect(repository.saveReplay).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'TEMPLATE_CREATE', safeResult: expect.objectContaining({ availability: 'INACTIVE' }),
    }), CONTEXT);
  });

  it('rejects an invalid definition before any insert', async () => {
    const { repository, service } = harness();
    const invalidBody = body();
    (invalidBody.revision as { price: { unitPriceMinor: number } }).price.unitPriceMinor = 0;
    await expect(service.create(invalidBody, KEY, browser))
      .rejects.toMatchObject({ status: 422, code: 'VALIDATION_FAILED', field: 'price.unitPriceMinor' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('publishes a new numbered revision and moves the pointer without rewriting a row', async () => {
    const { repository, service } = harness({
      lock: jest.fn().mockResolvedValue(publishedState({ availability: 'ACTIVE', version: 4 })),
      publish: jest.fn().mockResolvedValue({ revisionId: SECOND_REVISION_ID, revision: 2 }),
    });
    await expect(service.publish(TEMPLATE_ID, { revision: body().revision }, KEY, '"4"', browser)).resolves.toEqual({
      id: TEMPLATE_ID, category: 'GENERAL', availability: 'ACTIVE', version: 5,
      currentPublishedRevisionId: SECOND_REVISION_ID, publishedRevision: 2,
    });
    expect(repository.publish).toHaveBeenCalledWith(TEMPLATE_ID, expect.objectContaining({ revision: expect.anything() }), CONTEXT);
    expect(repository.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'TEMPLATE_PUBLISHED', purpose: 'Revision published',
    }), CONTEXT);
  });
});

describe('TemplateAdminService idempotency', () => {
  const created = () => harness({
    create: jest.fn().mockResolvedValue({ id: TEMPLATE_ID, revision: { revisionId: FIRST_REVISION_ID, revision: 1 } }),
  });

  it('replays a repeated create instead of inserting a second template', async () => {
    const { repository, service } = created();
    const first = await service.create(body(), KEY, browser);
    const stored = repository.saveReplay.mock.calls[0][0] as { requestDigest: string; safeResult: unknown };
    repository.replay.mockResolvedValue({ requestDigest: stored.requestDigest, safeResult: stored.safeResult });
    await expect(service.create(body(), KEY, browser)).resolves.toEqual(first);
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.audit).toHaveBeenCalledTimes(1);
  });

  it('answers 409 when a reused key arrives with a different body', async () => {
    const { repository, service } = created();
    repository.replay.mockResolvedValue({ requestDigest: 'f'.repeat(64), safeResult: {} });
    await expect(service.create(body(), KEY, browser))
      .rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.saveReplay).not.toHaveBeenCalled();
  });

  it('treats a tampered stored result as untrusted input', async () => {
    const { repository, service } = created();
    await service.create(body(), KEY, browser);
    const stored = repository.saveReplay.mock.calls[0][0] as { requestDigest: string; safeResult: Record<string, unknown> };
    repository.replay.mockResolvedValue({
      requestDigest: stored.requestDigest, safeResult: { ...stored.safeResult, availability: 'ACTIVE' },
    });
    await expect(service.create(body(), KEY, browser))
      .rejects.toMatchObject({ status: 503, code: 'PROVIDER_UNAVAILABLE' });
    expect(repository.create).toHaveBeenCalledTimes(1);
  });
});

describe('TemplateAdminService transaction failures', () => {
  it('maps a unique-constraint race to the safe conflict once the retries are spent', async () => {
    const { transactions, service } = harness();
    // A unique violation is first treated as a concurrent equivalent request and retried, so the
    // replay check can serve the winner's stored outcome. Only when every retry is spent does it
    // become the safe conflict.
    transactions.run.mockRejectedValueOnce({ code: 'P2002' }).mockRejectedValueOnce({ code: 'P2002' })
      .mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.list({}, browser)).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(transactions.run).toHaveBeenCalledTimes(3);
  });

  it('serves the winner outcome when a unique violation was a concurrent equivalent request', async () => {
    const { transactions, service } = harness({ list: jest.fn().mockResolvedValue([state()]) });
    // First attempt loses the write race; the retry finds the winner's replay record and returns
    // the stored page instead of a conflict the caller would wrongly retry.
    transactions.run.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.list({}, browser)).resolves.toMatchObject({ data: [expect.objectContaining({ id: TEMPLATE_ID })] });
    expect(transactions.run).toHaveBeenCalledTimes(2);
  });

  it('retries serialization failures and succeeds on the third attempt', async () => {
    const { transactions, service } = harness({ list: jest.fn().mockResolvedValue([state()]) });
    transactions.run.mockRejectedValueOnce({ code: 'P2034' }).mockRejectedValueOnce({ code: 'P2034' });
    await expect(service.list({}, browser)).resolves.toMatchObject({ data: [expect.objectContaining({ id: TEMPLATE_ID })] });
    expect(transactions.run).toHaveBeenCalledTimes(3);
  });

  it('reports an unexpected database failure as a truthful 503', async () => {
    const { transactions, service } = harness();
    transactions.run.mockRejectedValueOnce(new Error('connection reset'));
    await expect(service.list({}, browser))
      .rejects.toMatchObject({ status: 503, code: 'PROVIDER_UNAVAILABLE' });
  });
});
