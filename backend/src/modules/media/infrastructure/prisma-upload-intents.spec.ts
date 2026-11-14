import type { TransactionContext } from '../../../platform/database/application/transactions';
import type { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import { PrismaUploadIntents } from './prisma-upload-intents';

describe('new upload intent quota', () => {
  const context = { scope: Symbol() } as TransactionContext;
  const now = new Date('2026-11-14T00:10:00.000Z');
  const asset = { id: 'asset', status: 'PENDING', category: 'IMAGE', uploadIntentId: 'intent', createdAt: now };
  const client = {
    idempotencyRecord: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    mediaAsset: { findFirst: jest.fn(), create: jest.fn() },
  };
  const transactions = { clientFor: () => client } as unknown as PrismaTransactions;
  const env = process.env.MEDIA_UPLOAD_INTENTS_PER_10_MINUTES;
  const reserve = (repository = new PrismaUploadIntents(transactions)) =>
    repository.reserve('owner', 'intent-key', 'digest', 'IMAGE', now, context);

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.MEDIA_UPLOAD_INTENTS_PER_10_MINUTES;
    client.idempotencyRecord.findMany.mockResolvedValue([]);
    client.mediaAsset.create.mockResolvedValue(asset);
  });

  afterEach(() => {
    if (env === undefined) delete process.env.MEDIA_UPLOAD_INTENTS_PER_10_MINUTES;
    else process.env.MEDIA_UPLOAD_INTENTS_PER_10_MINUTES = env;
  });

  it('uses five per account over a rolling ten-minute window and stores the debit as the intent', async () => {
    await reserve();
    expect(client.idempotencyRecord.findMany).toHaveBeenCalledWith({
      where: { actorId: 'owner', operation: 'INITIATE_MEDIA_UPLOAD', createdAt: { gt: new Date('2026-11-14T00:00:00.000Z') } },
      orderBy: { createdAt: 'desc' }, take: 5, select: { createdAt: true },
    });
    expect(client.idempotencyRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: 'owner', key: 'intent-key', createdAt: now }),
    });
  });

  it('honors a configured cap and rounds Retry-After up without writing any new rows', async () => {
    process.env.MEDIA_UPLOAD_INTENTS_PER_10_MINUTES = '2';
    client.idempotencyRecord.findMany.mockResolvedValue([
      { createdAt: new Date(now.getTime() - 5000) },
      { createdAt: new Date(now.getTime() - 598_100) },
    ]);
    await expect(reserve()).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429, retryAfterSeconds: 2 });
    expect(client.idempotencyRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
    expect(client.mediaAsset.create).not.toHaveBeenCalled();
    expect(client.idempotencyRecord.create).not.toHaveBeenCalled();
  });

  it('replays the bound row and rejects a changed digest before checking the quota', async () => {
    client.idempotencyRecord.findUnique.mockResolvedValueOnce({ requestDigest: 'digest', resourceId: asset.id })
      .mockResolvedValueOnce({ requestDigest: 'changed', resourceId: asset.id });
    client.mediaAsset.findFirst.mockResolvedValue(asset);
    await expect(reserve()).resolves.toMatchObject({ binding: { assetId: asset.id } });
    await expect(reserve()).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
    expect(client.idempotencyRecord.findMany).not.toHaveBeenCalled();
    expect(client.mediaAsset.create).not.toHaveBeenCalled();
    expect(client.idempotencyRecord.create).not.toHaveBeenCalled();
  });
});
