import type { TransactionContext } from '../../../platform/database/application/transactions';
import type { ActiveAccounts } from '../../identity/application/ports';
import type { VerifiedMediaFacts } from '../domain/media';
import { FinalizeMedia, type FinalizationAsset, type MediaFinalizations } from './finalize-media';

describe('finalize media idempotency under a competing pin', () => {
  const binding = {
    ownerId: '22222222-2222-4222-8222-222222222222',
    assetId: '11111111-1111-4111-8111-111111111111',
    uploadIntentId: '33333333-3333-4333-8333-333333333333',
  };
  const pending: FinalizationAsset = {
    binding, category: 'IMAGE', status: 'PENDING', storageKey: null,
    contentVersion: 1, verifiedBytes: null, durationMs: null,
  };
  const ready: FinalizationAsset = {
    ...pending, status: 'READY', storageKey: 'winning-pin', verifiedBytes: 10,
  };
  const facts: VerifiedMediaFacts = {
    object: { binding, storageKey: 'different-pin', contentVersion: '2' },
    category: 'IMAGE', contentType: 'image/png', bytes: 10,
    durationSeconds: null, privateOriginal: true, privateDerivatives: true,
  };

  it.each([false, true])('replays the first durable outcome (same-key winner: %s)', async (sameKeyWon) => {
    let saved = sameKeyWon ? { ...ready, completed: true } : ready;
    const complete = jest.fn(async (_intent, outcome: Parameters<MediaFinalizations['complete']>[1]) => {
      if (!saved.completed) saved = {
        ...saved, completed: true,
        ...('error' in outcome ? { rejection: outcome.error } : {}),
      };
    });
    const reject = jest.fn();
    const repository: MediaFinalizations = {
      begin: jest.fn(async () => saved).mockResolvedValueOnce(pending),
      complete, reject, ready: jest.fn(), isRetryable: () => false,
    };
    const accounts: ActiveAccounts = {
      withActiveAccount: (_request, _mutation, work) => work({
        kind: 'account', id: binding.ownerId, role: 'USER', accountStatus: 'ACTIVE',
      }, { scope: Symbol() } as TransactionContext),
    };
    const inspect = jest.fn().mockResolvedValue({ kind: 'VERIFIED', facts });
    const service = new FinalizeMedia(accounts, repository, { inspect }, { now: () => new Date() });
    const finalize = () => service.execute({}, binding.assetId, { uploadCompleted: true }, 'synthetic-intent-key');

    if (sameKeyWon) {
      await expect(finalize()).resolves.toMatchObject({ status: 200 });
      await expect(finalize()).resolves.toMatchObject({ status: 200 });
    } else {
      await expect(finalize()).rejects.toMatchObject({ status: 409 });
      await expect(finalize()).rejects.toMatchObject({ status: 409 });
      expect(complete).toHaveBeenCalledTimes(1);
      expect(complete.mock.calls[0][1]).toEqual({ error: 'CONFLICT' });
    }
    expect(saved.storageKey).toBe('winning-pin');
    expect(reject).not.toHaveBeenCalled();
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it('passes the client signal to inspection and skips a commit after disconnect', async () => {
    const controller = new AbortController();
    const repository: MediaFinalizations = {
      begin: jest.fn().mockResolvedValue(pending), complete: jest.fn(),
      reject: jest.fn(), ready: jest.fn(), isRetryable: () => false,
    };
    const accounts: ActiveAccounts = {
      withActiveAccount: (_request, _mutation, work) => work({
        kind: 'account', id: binding.ownerId, role: 'USER', accountStatus: 'ACTIVE',
      }, { scope: Symbol() } as TransactionContext),
    };
    const inspect = jest.fn(async () => {
      controller.abort();
      return { kind: 'VERIFIED' as const, facts };
    });
    const service = new FinalizeMedia(accounts, repository, { inspect }, { now: () => new Date() });
    await expect(service.execute({}, binding.assetId, { uploadCompleted: true }, 'synthetic-intent-key', controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(inspect).toHaveBeenCalledWith(binding, controller.signal);
    expect(repository.begin).toHaveBeenCalledTimes(1);
    expect(repository.ready).not.toHaveBeenCalled();
  });
});
