import { afterEach, describe, expect, it, vi } from 'vitest';
import { mediaApi, uploadToProvider, type UploadIntent } from './media';

const id = '11111111-1111-4111-8111-111111111111';
const intent: UploadIntent = { assetId: id, upload: { url: 'https://api.cloudinary.com/v1_1/lumical/image/upload',
  fields: { api_key: 'public-key', signature: 'bounded-signature', timestamp: '123' }, expiresAt: '2027-01-01T00:00:00.000Z' } };
const ready = { data: { id, category: 'IMAGE', status: 'READY', verifiedBytes: 1250, contentPath: `/api/v1/media/${id}/content` } };

describe('typed private Media API', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('gives finalize a longer response budget than the media gateway', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { assetId: id, status: 'PENDING' } }), { status: 202 }));
      const api = mediaApi({ csrf: () => 'csrf', epoch: () => 1, unauthorized: vi.fn(), fetcher });
      await expect(api.finalize(id, 'finalize-key-000000')).resolves.toMatchObject({ status: 202 });
      expect(timeout).toHaveBeenCalledWith(35_000);
    } finally {
      timeout.mockRestore();
    }
  });
  it('settles an already-cancelled transfer without relying on an XHR abort event', async () => {
    const xhr = { open: vi.fn(), upload: {}, abort: vi.fn(), send: vi.fn() };
    vi.stubGlobal('XMLHttpRequest', class { constructor() { return xhr; } });
    const abort = new AbortController(); abort.abort();
    await expect(uploadToProvider(intent, new File(['x'], 'x.jpg'), 'IMAGE', vi.fn(), abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(xhr.send).not.toHaveBeenCalled();
  });
  it.each([409, 503, 'timeout'])('treats provider %s as uncertain so the backend can inspect existing bytes', async outcome => {
    const xhr: Record<string, unknown> = { open: vi.fn(), upload: {}, abort: vi.fn(), status: outcome };
    xhr.send = () => (xhr[outcome === 'timeout' ? 'ontimeout' : 'onload'] as () => void)();
    vi.stubGlobal('XMLHttpRequest', class { constructor() { return xhr; } });
    await expect(uploadToProvider(intent, new File(['x'], 'x.jpg'), 'IMAGE', vi.fn(), new AbortController().signal)).rejects.toMatchObject({ uncertain: true });
  });
  it('keeps a definitive provider validation error separate from a lost response', async () => {
    const xhr: Record<string, unknown> = { open: vi.fn(), upload: {}, status: 400 };
    xhr.send = () => (xhr.onload as () => void)();
    vi.stubGlobal('XMLHttpRequest', class { constructor() { return xhr; } });
    await expect(uploadToProvider(intent, new File(['x'], 'x.jpg'), 'IMAGE', vi.fn(), new AbortController().signal))
      .rejects.toMatchObject({ status: 400, uncertain: false });
  });
  it('accepts the backend-supported underscore in a Cloudinary cloud name', async () => {
    const uploader = vi.fn().mockResolvedValue(undefined);
    const api = mediaApi({ csrf: () => 'csrf', epoch: () => 1, unauthorized: vi.fn(), uploader });
    await api.upload({ ...intent, upload: { ...intent.upload, url: 'https://api.cloudinary.com/v1_1/my_cloud/image/upload' } }, new File(['x'], 'x.jpg'), 'IMAGE', vi.fn(), new AbortController().signal);
    expect(uploader).toHaveBeenCalledOnce();
  });
  it('initiates with the same typed request, same-origin credentials and idempotency key', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: intent }), { status: 201 }));
    const api = mediaApi({ csrf: () => 'c'.repeat(64), epoch: () => 1, unauthorized: vi.fn(), fetcher });
    const body = { category: 'IMAGE' as const, fileName: 'family.jpg', declaredBytes: 1250 };
    await expect(api.initiate(body, 'init-key-000000000000')).resolves.toEqual(intent);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/media/uploads', expect.objectContaining({ method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: expect.objectContaining({ 'X-CSRF-Token': 'c'.repeat(64), 'Idempotency-Key': 'init-key-000000000000' }), body: JSON.stringify(body) }));
  });

  it('keeps finalize PENDING distinct and reads status from the backend', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { assetId: id, status: 'PENDING' } }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id, category: 'IMAGE', status: 'PENDING', verifiedBytes: null } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ready), { status: 200 }));
    const api = mediaApi({ csrf: () => 'c'.repeat(64), epoch: () => 1, unauthorized: vi.fn(), fetcher });
    await expect(api.finalize(id, 'finalize-key-000000')).resolves.toMatchObject({ status: 202, data: { status: 'PENDING' } });
    await expect(api.status(id)).resolves.toMatchObject({ status: 'PENDING' });
    await expect(api.status(id)).resolves.toMatchObject({ status: 'READY', verifiedBytes: 1250 });
  });

  it('preserves the backend message key that identifies an expired upload intent', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'CONFLICT', messageKey: 'errors.uploadIntentExpired', retryable: false } }), { status: 409 }));
    const api = mediaApi({ csrf: () => 'c'.repeat(64), epoch: () => 1, unauthorized: vi.fn(), fetcher });
    await expect(api.initiate({ category: 'IMAGE', fileName: 'family.jpg', declaredBytes: 1250 }, 'init-key-000000000000'))
      .rejects.toMatchObject({ code: 'CONFLICT', status: 409, messageKey: 'errors.uploadIntentExpired' });
  });

  const now = Date.UTC(2026, 10, 14, 10, 0);
  it.each([
    ['600', now + 600_000],
    ['0', now],
    [new Date(now + 60_000).toUTCString(), now + 60_000],
    [new Date(now - 60_000).toUTCString(), now],
    [undefined, undefined], ['-1', undefined], ['1.5', undefined],
    ['2, 3', undefined], ['99999999999999', undefined], ['tomorrow', undefined], ['Invalid Date', undefined],
  ])('reads and validates Retry-After %s on 429', async (header, retryAt) => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const fetcher = vi.fn().mockResolvedValue(new Response('{}', {
        status: 429, headers: header === undefined ? undefined : { 'Retry-After': header },
      }));
      const api = mediaApi({ csrf: () => 'csrf', epoch: () => 1, unauthorized: vi.fn(), fetcher });
      await expect(api.initiate({ category: 'IMAGE', fileName: 'family.jpg', declaredBytes: 1250 }, 'init-key-000000000000'))
        .rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429, retryAt });
    } finally {
      clock.mockRestore();
    }
  });

  it('refuses a provider endpoint outside the backend-approved Cloudinary upload origin and shape', async () => {
    const uploader = vi.fn();
    const api = mediaApi({ csrf: () => 'c'.repeat(64), epoch: () => 1, unauthorized: vi.fn(), uploader });
    const untrusted: UploadIntent = { ...intent, upload: { ...intent.upload, url: 'https://example.test/upload' } };
    await expect(api.upload(untrusted, new File(['x'], 'family.jpg', { type: 'image/jpeg' }), 'IMAGE', vi.fn(), new AbortController().signal))
      .rejects.toBeInstanceOf(Error);
    expect(uploader).not.toHaveBeenCalled();
  });
});
