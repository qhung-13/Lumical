import { randomUUID } from 'node:crypto';
import { CloudinaryPurge } from './cloudinary-purge';
import type { CleanupTarget } from '../application/media-cleanup';

describe('Cloudinary exact-binding cleanup', () => {
  const env = { ...process.env };
  const originalFetch = global.fetch;
  const binding = {
    ownerId: randomUUID(),
    assetId: randomUUID(),
    uploadIntentId: randomUUID(),
  };
  const key = `lumical/${binding.ownerId}/${binding.assetId}/${binding.uploadIntentId}`;
  const data = {
    public_id: key,
    resource_type: 'image',
    type: 'authenticated',
    asset_id: 'b'.repeat(32),
    version: 1794200000,
    format: 'png',
    etag: 'a'.repeat(32),
    context: {
      custom: {
        owner_id: binding.ownerId,
        asset_id: binding.assetId,
        upload_intent_id: binding.uploadIntentId,
      },
    },
  };
  const target: CleanupTarget = {
    binding,
    pinned: {
      binding,
      storageKey: `image/authenticated/${key}#png:${data.etag}`,
      contentVersion: String(data.version),
    },
  };
  let provider: jest.Mock;
  beforeEach(() => {
    Object.assign(process.env, {
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: '123',
      CLOUDINARY_API_SECRET: 'test-secret',
    });
    provider = jest
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith('/resources')
            ? {
                ok: true,
                json: () =>
                  Promise.resolve({ deleted: { [data.asset_id]: 'deleted' } }),
              }
            : url.includes('/image/')
              ? { ok: true, json: () => Promise.resolve(data) }
              : { ok: false, status: 404 },
        ),
      );
    global.fetch = provider as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...env };
  });
  it('deletes only the independently verified provider asset ID', async () => {
    expect(
      await new CloudinaryPurge().purge(target, new AbortController().signal),
    ).toEqual({ kind: 'DELETED' });
    const [url, options] = provider.mock.calls.at(-1)!;
    expect(url).toBe('https://api.cloudinary.com/v1_1/test-cloud/resources');
    expect(options.redirect).toBe('error');
    expect(options.method).toBe('DELETE');
    expect(options.body.get('asset_ids[]')).toBe(data.asset_id);
    expect(options.body.get('public_id')).toBeNull();
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from('123:test-secret').toString('base64')}`,
    );
  });
  it('missing bytes are idempotent success without a destructive provider call', async () => {
    provider.mockResolvedValue({ ok: false, status: 404 });
    expect(
      await new CloudinaryPurge().purge(target, new AbortController().signal),
    ).toEqual({ kind: 'DELETED' });
    expect(
      provider.mock.calls.some(([url]) => String(url).endsWith('/resources')),
    ).toBe(false);
  });
  it.each([
    { version: 1794200001 },
    { etag: 'c'.repeat(32) },
    { public_id: 'different' },
    { context: {} },
    { type: 'upload' },
  ])('never purges mismatched/replaced content %j', async (patch) => {
    provider.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...data, ...patch }),
    });
    expect(
      (await new CloudinaryPurge().purge(target, new AbortController().signal))
        .kind,
    ).toBe('REJECTED');
    expect(
      provider.mock.calls.some(([url]) => String(url).endsWith('/resources')),
    ).toBe(false);
  });
  it('cleans unfinalized unsafe media by trusted binding without requiring a safe content format', async () => {
    provider.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/resources')
          ? {
              ok: true,
              json: () =>
                Promise.resolve({ deleted: { [data.asset_id]: 'deleted' } }),
            }
          : url.includes('/image/')
            ? {
                ok: true,
                json: () => Promise.resolve({ ...data, format: 'svg' }),
              }
            : { ok: false, status: 404 },
      ),
    );
    expect(
      (
        await new CloudinaryPurge().purge(
          { binding, pinned: null },
          new AbortController().signal,
        )
      ).kind,
    ).toBe('DELETED');
  });
  it('does not partially delete when another namespace is uncertain', async () => {
    provider.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('/image/')
          ? { ok: true, json: () => Promise.resolve(data) }
          : { ok: false, status: 503 },
      ),
    );
    expect(
      (await new CloudinaryPurge().purge(target, new AbortController().signal))
        .kind,
    ).toBe('UNAVAILABLE');
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it('maps delete failure safely for durable retry', async () => {
    provider.mockImplementation((url: string) => {
      if (url.endsWith('/resources'))
        return Promise.reject(new Error('raw provider secret'));
      return Promise.resolve(
        url.includes('/image/')
          ? { ok: true, json: () => Promise.resolve(data) }
          : { status: 404 },
      );
    });
    expect(
      await new CloudinaryPurge().purge(target, new AbortController().signal),
    ).toEqual({ kind: 'UNAVAILABLE', retryable: true });
  });
});
