import type { ActiveAccounts } from '../../identity/application/ports';
import type { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import { MediaCleanup, type CleanupClaim } from '../application/media-cleanup';
import { PrismaMediaCleanup } from './prisma-media-cleanup';

it.each([
  ['MISSING', 'MEDIA_MISSING_UNCONFIRMED'],
  ['DELETE_UNCONFIRMED', 'MEDIA_DELETE_UNCONFIRMED'],
] as const)('persists %s for manual review and releases the lease', async (kind, safeErrorCode) => {
  const now = new Date('2026-11-14T00:00:00Z');
  const claim: CleanupClaim = {
    id: 'job', token: 'lease',
    target: { binding: { assetId: 'asset', ownerId: 'owner', uploadIntentId: 'intent' }, pinned: null },
  };
  const client = {
    $queryRaw: jest.fn(),
    mediaAsset: { findUnique: jest.fn().mockResolvedValue({ id: 'asset' }) },
    jobRecord: {
      findUnique: jest.fn().mockResolvedValue({ id: claim.id, claimedBy: claim.token, condition: 'RUNNING', attempts: 1 }),
      update: jest.fn(),
    },
  };
  const persistence = new PrismaMediaCleanup({
    run: (work: (context: object) => Promise<unknown>) => work({}), clientFor: () => client,
  } as unknown as PrismaTransactions);
  jest.spyOn(persistence, 'scan').mockResolvedValue(undefined);
  jest.spyOn(persistence, 'claim').mockResolvedValueOnce(claim).mockResolvedValue(null);
  const cleanup = new MediaCleanup({} as ActiveAccounts, persistence, {
    purge: async () => ({ kind }),
  }, { now: () => now });

  await expect(cleanup.runBatch(20, new AbortController().signal)).resolves.toBe(1);
  expect(client.jobRecord.update).toHaveBeenCalledWith({
    where: { id: claim.id },
    data: expect.objectContaining({
      condition: 'FAILED', safeErrorCode, claimedBy: null, leaseUntil: null,
    }),
  });
  expect(client.jobRecord.update).toHaveBeenCalledTimes(1);
});
