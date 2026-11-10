import { describe, expect, it, vi } from 'vitest';
import { mediaApi, type UploadIntent } from './media';

const id = '11111111-1111-4111-8111-111111111111';
const intent: UploadIntent = { assetId: id, upload: { url: 'https://api.cloudinary.com/v1_1/lumical/image/upload',
  fields: { api_key: 'public-key', signature: 'bounded-signature', timestamp: '123' }, expiresAt: '2027-01-01T00:00:00.000Z' } };
const ready = { data: { id, category: 'IMAGE', status: 'READY', verifiedBytes: 1250, contentPath: `/api/v1/media/${id}/content` } };

describe('typed private Media API', () => {
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

  it('refuses a provider endpoint outside the backend-approved Cloudinary upload origin and shape', async () => {
    const uploader = vi.fn();
    const api = mediaApi({ csrf: () => 'c'.repeat(64), epoch: () => 1, unauthorized: vi.fn(), uploader });
    const untrusted: UploadIntent = { ...intent, upload: { ...intent.upload, url: 'https://example.test/upload' } };
    await expect(api.upload(untrusted, new File(['x'], 'family.jpg', { type: 'image/jpeg' }), 'IMAGE', vi.fn(), new AbortController().signal))
      .rejects.toBeInstanceOf(Error);
    expect(uploader).not.toHaveBeenCalled();
  });
});
