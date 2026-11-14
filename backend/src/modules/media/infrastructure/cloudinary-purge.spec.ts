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
    let deleted = false;
    provider = jest.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/resources')) {
        deleted = true;
        return Response.json({ deleted: { [data.asset_id]: 'deleted' } });
      }
      return !deleted && url.includes('/image/') ? Response.json(data) : new Response(null, { status: 404 });
    });
    global.fetch = provider as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...env };
  });
  it('deletes only the independently verified provider asset ID', async () => {
    expect(
      await new CloudinaryPurge().purge({ ...target, uploadsQuiescent: true }, new AbortController().signal),
    ).toEqual({ kind: 'DELETED' });
    expect(provider.mock.calls.slice(4).map(([url]) => new URL(url).pathname.split('/')[4]))
      .toEqual(['image', 'video', 'raw']);
    const [url, options] = provider.mock.calls[3];
    expect(url).toBe('https://api.cloudinary.com/v1_1/test-cloud/resources');
    expect(options.redirect).toBe('error');
    expect(options.method).toBe('DELETE');
    expect(options.body.get('asset_ids[]')).toBe(data.asset_id);
    expect(options.body.get('public_id')).toBeNull();
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from('123:test-secret').toString('base64')}`,
    );
  });
  it('reports observed absence without claiming that physical deletion completed', async () => {
    provider.mockResolvedValue({ ok: false, status: 404 });
    expect(
      await new CloudinaryPurge().purge(target, new AbortController().signal),
    ).toEqual({ kind: 'MISSING' });
    expect(
      provider.mock.calls.some(([url]) => String(url).endsWith('/resources')),
    ).toBe(false);
  });
  it('reports a disappearing candidate as missing when DELETE returns not_found', async () => {
    const inspect = provider.getMockImplementation()!;
    provider.mockImplementation((url: string) => url.endsWith('/resources')
      ? Promise.resolve(Response.json({ deleted: { [data.asset_id]: 'not_found' } }))
      : inspect(url));
    await expect(new CloudinaryPurge().purge(target, new AbortController().signal))
      .resolves.toEqual({ kind: 'MISSING' });
  });
  it('reports HTTP 404 during DELETE as unconfirmed absence', async () => {
    const inspect = provider.getMockImplementation()!;
    provider.mockImplementation((url: string) => url.endsWith('/resources')
      ? Promise.resolve(new Response(null, { status: 404 })) : inspect(url));
    await expect(new CloudinaryPurge().purge(target, new AbortController().signal))
      .resolves.toEqual({ kind: 'MISSING' });
  });
  it('defers the missing result when an earlier namespace gets a late upload', async () => {
    let lateImage: typeof data | undefined;
    provider.mockImplementation(async (url: string) => {
      if (url.includes('/image/') && lateImage) return Response.json(lateImage);
      if (url.includes('/raw/')) lateImage = data;
      return new Response(null, { status: 404 });
    });
    await expect(new CloudinaryPurge().purge({ binding, pinned: null }, new AbortController().signal))
      .resolves.toEqual({ kind: 'MISSING' });
    expect(lateImage).toBeDefined();
    expect(provider.mock.calls.some(([, options]) => options.method === 'DELETE')).toBe(false);
  });
  it('defers completion when an earlier namespace gains an object before DELETE succeeds', async () => {
    const video = { ...data, asset_id: 'c'.repeat(32), resource_type: 'video' };
    let lateImage = false;
    let videoDeleted = false;
    provider.mockImplementation(async (url: string, options: RequestInit) => {
      if (options.method === 'DELETE') {
        expect(lateImage).toBe(true);
        videoDeleted = true;
        return Response.json({ deleted: { [video.asset_id]: 'deleted' } });
      }
      if (url.includes('/image/') && lateImage) return Response.json(data);
      if (url.includes('/video/') && !videoDeleted) return Response.json(video);
      if (url.includes('/raw/')) lateImage = true;
      return new Response(null, { status: 404 });
    });
    await expect(new CloudinaryPurge().purge({ binding, pinned: null }, new AbortController().signal))
      .resolves.toEqual({ kind: 'DELETE_UNCONFIRMED' });
    expect(provider.mock.calls.map(([url, options]) => options.method ?? new URL(url).pathname.split('/')[4]))
      .toEqual(['image', 'video', 'raw', 'DELETE', 'image']);
    expect(provider.mock.calls[3][1].body.get('asset_ids[]')).toBe(video.asset_id);
  });
  it('defers even with three clean post-delete probes when upload quiescence is unknown', async () => {
    await expect(new CloudinaryPurge().purge(target, new AbortController().signal))
      .resolves.toEqual({ kind: 'DELETE_UNCONFIRMED' });
    expect(provider).toHaveBeenCalledTimes(7);
  });
  it.each([503, 'network error'])('defers when verification fails after DELETE: %s', async failure => {
    const inspect = provider.getMockImplementation()!;
    provider.mockImplementation((url: string, options: RequestInit) => {
      if (provider.mock.calls.length <= 4) return inspect(url, options);
      return failure === 503 ? Promise.resolve(new Response(null, { status: 503 })) : Promise.reject(new Error('upstream'));
    });
    await expect(new CloudinaryPurge().purge({ ...target, uploadsQuiescent: true }, new AbortController().signal))
      .resolves.toEqual({ kind: 'DELETE_UNCONFIRMED' });
  });
  it('refuses a legacy unversioned reference before contacting the provider', async () => {
    const legacy = { ...target, pinned: { ...target.pinned!, storageKey: `image/authenticated/${key}` } };
    await expect(new CloudinaryPurge().purge(legacy, new AbortController().signal))
      .resolves.toMatchObject({ kind: 'REJECTED' });
    expect(provider).not.toHaveBeenCalled();
  });
  it('refuses multiple exact bindings in different namespaces even without a Ready pin', async () => {
    provider.mockImplementation(async (url: string) => {
      const resource_type = url.includes('/image/') ? 'image' : 'video';
      return Response.json({ ...data, resource_type });
    });
    await expect(new CloudinaryPurge().purge({ binding, pinned: null }, new AbortController().signal))
      .resolves.toMatchObject({ kind: 'REJECTED' });
    expect(provider.mock.calls.some(([, options]) => options.method === 'DELETE')).toBe(false);
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
    provider.mockResolvedValueOnce(Response.json({ ...data, format: 'svg' }));
    expect(
      (
        await new CloudinaryPurge().purge(
          { binding, pinned: null, uploadsQuiescent: true },
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
