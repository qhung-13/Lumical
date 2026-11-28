import type { PrismaTransactions } from '../../../platform/database/infrastructure/prisma-transactions';
import { PREPARATION_LEASE_MS, type PreparationClaim } from '../application/prepare-target';
import type { OwnerMediaRepository } from '../../media/application/owner-media';
import { PrismaPreparationJobs } from './prisma-preparation-jobs';

function fixture() {
  // Deliberately unrelated to wall time: every scheduling/lease decision must
  // use the same Clock as the command that enqueued the preparation job.
  let now = new Date('2040-01-01T00:00:00Z');
  const claim: PreparationClaim = {
    id: 'job', objectId: 'project', operationIdentity: 'AR_PREPARE:project:3',
    claimedBy: 'token', attempts: 1,
  };
  const client = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: claim.id }]),
    jobRecord: {
      update: jest.fn().mockResolvedValue(claim),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    calendarProject: { findUnique: jest.fn().mockResolvedValue({
      id: 'project', ownerId: 'owner', status: 'WORKING', version: 3,
      owner: { status: 'ACTIVE' },
      projectARExperience_project: {
        preparationStatus: 'PREPARING', targetArtifactId: null, sourceRevision: 3,
        monthNumber: 1, revealAssetId: 'asset', revealContentVersion: 1,
      },
    }) },
    projectMonthMedia: { findFirst: jest.fn().mockResolvedValue({ assetId: 'asset', crop: null }) },
    projectARExperience: { update: jest.fn() },
  };
  const media = { find: jest.fn().mockResolvedValue({
    status: 'READY', category: 'IMAGE', storageKey: 'key', verifiedBytes: 10,
    contentType: 'image/png', contentVersion: 1,
  }), isRetryable: () => false };
  const jobs = new PrismaPreparationJobs({
    run: (work: (context: object) => Promise<unknown>) => work({}),
    clientFor: () => client,
  } as unknown as PrismaTransactions, media as unknown as OwnerMediaRepository, { now: () => now });
  return { jobs, client, claim, now: () => now, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

it('uses the injected Clock for due/expired-lease selection and new lease duration', async () => {
  const { jobs, client, now, advance } = fixture();
  await jobs.claim();
  expect(client.$queryRaw.mock.calls[0].slice(1)).toEqual(['AR_PREPARE', now(), now()]);
  expect(client.jobRecord.update).toHaveBeenLastCalledWith(expect.objectContaining({
    data: expect.objectContaining({ leaseUntil: new Date(now().getTime() + PREPARATION_LEASE_MS) }),
  }));
  advance(15_000);
  await jobs.claim();
  expect(client.$queryRaw.mock.calls[1].slice(1)).toEqual(['AR_PREPARE', now(), now()]);
});

it.each([1, 2])('uses the injected Clock for attempt %s retry backoff and lease fencing', async (attempts) => {
  const { jobs, client, claim, now, advance } = fixture();
  advance(2_000);
  await jobs.finish({ ...claim, attempts }, { kind: 'RETRY' });
  expect(client.jobRecord.updateMany).toHaveBeenCalledWith({
    where: { id: claim.id, condition: 'PENDING', claimedBy: claim.claimedBy, leaseUntil: { gt: now() } },
    data: { claimedBy: null, leaseUntil: null },
  });
  expect(client.jobRecord.update).toHaveBeenCalledWith({
    where: { id: claim.id },
    data: { condition: 'PENDING', safeErrorCode: 'AR_PREPARATION_RETRY', dueAt: new Date(now().getTime() + 15_000 * 2 ** (attempts - 1)) },
  });
});

it('does not finish or reschedule a claim when its lease fence is lost', async () => {
  const { jobs, client, claim } = fixture();
  client.jobRecord.updateMany.mockResolvedValue({ count: 0 });
  await jobs.finish(claim, { kind: 'RETRY' });
  expect(client.calendarProject.findUnique).not.toHaveBeenCalled();
  expect(client.jobRecord.update).not.toHaveBeenCalled();
});
