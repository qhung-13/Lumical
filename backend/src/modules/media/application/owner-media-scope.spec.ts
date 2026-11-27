import type { TransactionContext } from '../../../platform/database/application/transactions';
import { ActiveAccounts } from '../../identity/application/ports';
import type { ActiveAccountPrincipal } from '../../identity/domain/identity';
import {
  MediaContent,
  OwnerMedia,
  OwnerMediaRepository,
  type OwnedMedia,
} from './owner-media';

const asset: OwnedMedia = {
  binding: {
    assetId: '10000000-0000-4000-8000-000000000001',
    ownerId: 'owner',
    uploadIntentId: 'intent',
  },
  contentType: 'image/png',
  contentVersion: 1,
  category: 'IMAGE',
  status: 'READY',
  storageKey: 'private',
  verifiedBytes: 3,
  durationMs: null,
};
function setup() {
  const accounts = {
    withActiveAccount: jest.fn(
      async (
        _auth: unknown,
        _mutation: boolean,
        work: (
          actor: ActiveAccountPrincipal,
          context: TransactionContext,
        ) => Promise<unknown>,
      ) =>
        work(
          { id: 'owner' } as ActiveAccountPrincipal,
          {} as TransactionContext,
        ),
    ),
  };
  const find = jest.fn().mockResolvedValue(asset);
  const fetch = jest
    .fn()
    .mockResolvedValue({
      kind: 'CONTENT',
      status: 200,
      contentType: 'image/png',
      totalBytes: 3,
      contentLength: 3,
      body: [new Uint8Array([1, 2, 3])],
    });
  const service = new OwnerMedia(
    accounts as unknown as ActiveAccounts,
    { find, isRetryable: () => false } as unknown as OwnerMediaRepository,
    { fetch } as MediaContent,
  );
  return { service, find, fetch, accounts };
}
describe('private media scope revalidation', () => {
  it('does not call storage when scoped project/target authorization fails', async () => {
    const { service, fetch } = setup();
    const denied = new Error('safe refusal');
    await expect(
      service.content(
        {},
        asset.binding.assetId,
        'GET',
        undefined,
        new AbortController().signal,
        () => Promise.reject(denied),
      ),
    ).rejects.toBe(denied);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rechecks pinned scope after provider I/O before exposing the body', async () => {
    const { service, fetch } = setup();
    const stale = new Error('stale project');
    const check = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(stale);
    await expect(
      service.content(
        {},
        asset.binding.assetId,
        'GET',
        undefined,
        new AbortController().signal,
        check,
      ),
    ).rejects.toBe(stale);
    expect(check).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0].object.contentVersion).toBe('1');
  });
  it('retains media-level version checks in addition to project scope', async () => {
    const { service, find } = setup();
    find
      .mockResolvedValueOnce(asset)
      .mockResolvedValueOnce({ ...asset, contentVersion: 2 });
    await expect(
      service.content(
        {},
        asset.binding.assetId,
        'GET',
        undefined,
        new AbortController().signal,
        async () => undefined,
      ),
    ).rejects.toMatchObject({ code: 'MEDIA_UNAVAILABLE' });
  });
  it('rechecks active-account access after slow provider I/O', async () => {
    const { service, accounts } = setup();
    let count = 0;
    accounts.withActiveAccount.mockImplementation(
      async (_auth, _mutation, work) => {
        if (++count === 2) throw new Error('session disabled');
        return work(
          { id: 'owner' } as ActiveAccountPrincipal,
          {} as TransactionContext,
        );
      },
    );
    await expect(
      service.content(
        {},
        asset.binding.assetId,
        'GET',
        undefined,
        new AbortController().signal,
      ),
    ).rejects.toThrow('session disabled');
  });
});
