import { randomUUID } from 'node:crypto';
import { CloudinaryContent } from './cloudinary-content';
import type { PrivateFetchRequest } from '../application/media-storage';
import type { VerifiedMediaFacts } from '../domain/media';

describe('Cloudinary private immutable delivery', () => {
  const env = { ...process.env };
  const originalFetch = global.fetch;
  const binding = {
    ownerId: randomUUID(),
    assetId: randomUUID(),
    uploadIntentId: randomUUID(),
  };
  const publicId = `lumical/${binding.ownerId}/${binding.assetId}/${binding.uploadIntentId}`;
  const etag = 'a'.repeat(32);
  const object = {
    binding,
    storageKey: `image/authenticated/${publicId}#png:${etag}`,
    contentVersion: '1794200000',
  };
  const facts: VerifiedMediaFacts = {
    object,
    category: 'IMAGE',
    contentType: 'image/png',
    bytes: 6,
    durationSeconds: null,
    privateOriginal: true,
    privateDerivatives: true,
  };
  const request: PrivateFetchRequest = {
    object,
    access: {
      kind: 'OWNER',
      actorId: binding.ownerId,
      ownerId: binding.ownerId,
    },
    method: 'GET',
    rendition: 'ORIGINAL',
  };
  let inspection: jest.Mock;
  let provider: jest.Mock;
  let storage: CloudinaryContent;
  let cancelled: jest.Mock;
  const headers = (patch: Record<string, string> = {}) => ({
    'content-type': 'image/png',
    'content-length': '6',
    etag: `"${etag}"`,
    ...patch,
  });
  function response(
    patch: Record<string, string> = {},
    status = 200,
    data = new Uint8Array([1, 2, 3, 4, 5, 6]),
  ) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data);
      },
      cancel: cancelled,
    });
    return new Response(stream, { status, headers: headers(patch) });
  }
  beforeEach(() => {
    Object.assign(process.env, {
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_SECRET: 'test-secret',
    });
    inspection = jest.fn().mockResolvedValue({ kind: 'VERIFIED', facts });
    cancelled = jest.fn();
    provider = jest.fn().mockResolvedValue(response());
    global.fetch = provider as typeof fetch;
    storage = new CloudinaryContent({ inspect: inspection });
  });
  afterEach(() => {
    process.env = { ...env };
    global.fetch = originalFetch;
  });
  it('keeps signatures internal, verifies pinned facts and applies redirect/encoding constraints', async () => {
    const result = await storage.fetch(request, new AbortController().signal);
    expect(result.kind).toBe('CONTENT');
    expect(provider.mock.calls[0][0]).toMatch(
      /^https:\/\/res.cloudinary.com\/test-cloud\/image\/authenticated\/s--[\w-]{8}--\/v1794200000\/lumical\//,
    );
    expect(provider.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      redirect: 'error',
      headers: { 'Accept-Encoding': 'identity', 'If-Match': `"${etag}"` },
    });
    expect(JSON.stringify(result)).not.toMatch(/https:|test-secret|s--/);
    if (result.kind === 'CONTENT') {
      const iterator = result.body![Symbol.asyncIterator]();
      expect((await iterator.next()).value).toEqual(
        new Uint8Array([1, 2, 3, 4, 5, 6]),
      );
      await iterator.return?.();
      expect(cancelled).toHaveBeenCalled();
    }
  });
  it.each([
    [{ kind: 'CLOSED', start: 1, end: 2 }, 'bytes=1-2', 1, 2],
    [{ kind: 'OPEN', start: 4 }, 'bytes=4-5', 4, 5],
    [{ kind: 'SUFFIX', length: 2 }, 'bytes=4-5', 4, 5],
  ] as const)(
    'normalizes and verifies single range %j',
    async (range, header, start, end) => {
      provider.mockResolvedValue(
        response(
          { 'content-length': '2', 'content-range': `bytes ${start}-${end}/6` },
          206,
          new Uint8Array([5, 6]),
        ),
      );
      const result = await storage.fetch(
        { ...request, range },
        new AbortController().signal,
      );
      expect(result).toMatchObject({
        kind: 'CONTENT',
        status: 206,
        contentLength: 2,
        totalBytes: 6,
        contentRange: { start, end },
      });
      expect(provider.mock.calls[0][1].headers.Range).toBe(header);
      if (result.kind === 'CONTENT')
        await result.body![Symbol.asyncIterator]().return?.();
    },
  );
  it('returns HEAD headers without exposing a body and cancels any upstream body', async () => {
    const result = await storage.fetch(
      { ...request, method: 'HEAD' },
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      kind: 'CONTENT',
      status: 200,
      contentLength: 6,
    });
    if (result.kind === 'CONTENT') expect(result.body).toBeUndefined();
    expect(cancelled).toHaveBeenCalled();
  });
  it.each<Record<string, string>>([
    { 'content-type': 'text/html' },
    { 'content-length': '7' },
    { etag: `"${'b'.repeat(32)}"` },
    { etag: `W/"${etag}"` },
    { 'content-range': 'bytes 0-5/6' },
    { 'content-encoding': 'gzip' },
  ])('cancels and rejects unsafe upstream headers %j', async (patch) => {
    provider.mockResolvedValue(response(patch));
    expect(
      (await storage.fetch(request, new AbortController().signal)).kind,
    ).toBe('UNAVAILABLE');
    expect(cancelled).toHaveBeenCalled();
  });
  it('rejects ignored or incorrect range responses', async () => {
    expect(
      (
        await storage.fetch(
          { ...request, range: { kind: 'OPEN', start: 1 } },
          new AbortController().signal,
        )
      ).kind,
    ).toBe('UNAVAILABLE');
  });
  it('refuses newer versions/checksums before fetching any bytes', async () => {
    for (const changed of [
      { ...object, contentVersion: '1794200001' },
      {
        ...object,
        storageKey: object.storageKey.replace(etag, 'b'.repeat(32)),
      },
    ]) {
      inspection.mockResolvedValue({
        kind: 'VERIFIED',
        facts: { ...facts, object: changed },
      });
      expect(
        (await storage.fetch(request, new AbortController().signal)).kind,
      ).toBe('REJECTED');
    }
    expect(provider).not.toHaveBeenCalled();
  });
  it('rejects legacy keys, arbitrary paths and unprepared renditions before inspection', async () => {
    for (const storageKey of [
      `image/authenticated/${publicId}`,
      'https://evil.invalid/a',
      `${object.storageKey}/../other`,
    ])
      expect(
        (
          await storage.fetch(
            { ...request, object: { ...object, storageKey } },
            new AbortController().signal,
          )
        ).kind,
      ).toBe('REJECTED');
    expect(
      (
        await storage.fetch(
          { ...request, rendition: 'PREVIEW' },
          new AbortController().signal,
        )
      ).kind,
    ).toBe('REJECTED');
    expect(inspection).not.toHaveBeenCalled();
  });
  it('does not treat owner scope as permission for a different owner', async () => {
    expect(
      (
        await storage.fetch(
          {
            ...request,
            access: {
              kind: 'OWNER',
              actorId: randomUUID(),
              ownerId: binding.ownerId,
            },
          },
          new AbortController().signal,
        )
      ).kind,
    ).toBe('REJECTED');
    expect(provider).not.toHaveBeenCalled();
  });
  it('maps transient, missing and redirected upstream responses without leaking raw errors', async () => {
    inspection.mockResolvedValue({ kind: 'PENDING' });
    expect(
      (await storage.fetch(request, new AbortController().signal)).kind,
    ).toBe('NOT_FOUND');
    inspection.mockResolvedValue({ kind: 'UNAVAILABLE' });
    expect(
      (await storage.fetch(request, new AbortController().signal)).kind,
    ).toBe('UNAVAILABLE');
    inspection.mockResolvedValue({ kind: 'VERIFIED', facts });
    provider.mockRejectedValue(new Error('signed URL and provider details'));
    expect(await storage.fetch(request, new AbortController().signal)).toEqual({
      kind: 'UNAVAILABLE',
      retryable: true,
    });
    provider.mockResolvedValue(response({}, 302));
    expect(
      (await storage.fetch(request, new AbortController().signal)).kind,
    ).toBe('UNAVAILABLE');
  });
  it('rejects unsafe range bounds without fetching', async () => {
    expect(
      await storage.fetch(
        { ...request, range: { kind: 'OPEN', start: 100 } },
        new AbortController().signal,
      ),
    ).toEqual({ kind: 'RANGE_NOT_SATISFIABLE', totalBytes: 6 });
    expect(provider).not.toHaveBeenCalled();
  });
  it('checks actual streamed length and cancels a corrupt or disconnected stream', async () => {
    provider.mockResolvedValue(response({}, 200, new Uint8Array(7)));
    const result = await storage.fetch(request, new AbortController().signal);
    if (result.kind !== 'CONTENT') throw new Error('Expected content headers');
    await expect(result.body![Symbol.asyncIterator]().next()).rejects.toThrow(
      'Media stream interrupted',
    );
    expect(cancelled).toHaveBeenCalled();
    const controller = new AbortController();
    controller.abort();
    provider.mockClear();
    expect((await storage.fetch(request, controller.signal)).kind).toBe(
      'UNAVAILABLE',
    );
    expect(provider).not.toHaveBeenCalled();
  });
});
