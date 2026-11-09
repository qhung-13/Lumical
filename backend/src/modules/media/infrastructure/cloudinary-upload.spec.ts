import { randomUUID, createHash } from 'node:crypto';
import { CloudinaryUpload } from './cloudinary-upload';
import type { PrivateUploadRequest } from '../application/media-storage';

describe('Cloudinary private upload authorization', () => {
  const saved = { ...process.env };
  const originalFetch = global.fetch;
  let provider: jest.Mock;
  let request: PrivateUploadRequest;
  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = '12345';
    process.env.CLOUDINARY_API_SECRET = 'test-only-secret';
    process.env.CLOUDINARY_UPLOAD_PRESET_IMAGE = 'private-image';
    process.env.CLOUDINARY_UPLOAD_PRESET_AUDIO = 'private-audio';
    provider = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            unsigned: false,
            settings: { allowed_formats: ['jpg', 'png', 'webp'] },
          }),
      });
    global.fetch = provider as typeof fetch;
    request = {
      binding: {
        ownerId: randomUUID(),
        assetId: randomUUID(),
        uploadIntentId: randomUUID(),
      },
      category: 'IMAGE',
      expiresAt: new Date(Date.now() + 3_600_000),
    };
  });
  afterEach(() => {
    process.env = { ...saved };
    global.fetch = originalFetch;
  });
  it('signs exact immutable private fields and returns only the actual one-hour expiry', async () => {
    const result = await new CloudinaryUpload().authorizeUpload(request);
    expect(result.kind).toBe('AUTHORIZED');
    if (result.kind !== 'AUTHORIZED') throw new Error('Expected authorization');
    const { fields } = result.intent;
    expect(result.intent.uploadEndpoint).toBe(
      'https://api.cloudinary.com/v1_1/test-cloud/image/upload',
    );
    expect(fields.public_id).toBe(
      `lumical/${request.binding.ownerId}/${request.binding.assetId}/${request.binding.uploadIntentId}`,
    );
    expect(fields).toMatchObject({
      type: 'authenticated',
      overwrite: 'false',
      unique_filename: 'false',
      allowed_formats: 'jpg,png,webp',
    });
    const signed = Object.fromEntries(
      Object.entries(fields).filter(
        ([key]) => !['api_key', 'signature'].includes(key),
      ),
    );
    const canonical = Object.keys(signed)
      .sort()
      .map((key) => `${key}=${signed[key]}`)
      .join('&');
    expect(fields.signature).toBe(
      createHash('sha256')
        .update(canonical + 'test-only-secret')
        .digest('hex'),
    );
    expect(JSON.stringify(result)).not.toContain('test-only-secret');
    expect(provider.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });
  it.each([
    { unsigned: true, settings: { allowed_formats: ['png'] } },
    { unsigned: false, settings: { allowed_formats: ['svg'] } },
    {
      unsigned: false,
      settings: { allowed_formats: ['png'], transformation: 'c_fill,w_1' },
    },
    {
      unsigned: false,
      settings: { allowed_formats: ['png'], access_control: [] },
    },
    { unsigned: false },
  ])('fails closed for unsafe preset %j', async (preset) => {
    provider.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(preset),
    });
    expect((await new CloudinaryUpload().authorizeUpload(request)).kind).toBe(
      'UNAVAILABLE',
    );
  });
  it('maps provider errors and invalid configuration without leaking credentials', async () => {
    provider.mockRejectedValue(new Error('provider secret raw failure'));
    expect(await new CloudinaryUpload().authorizeUpload(request)).toEqual({
      kind: 'UNAVAILABLE',
      retryable: true,
    });
    process.env.CLOUDINARY_CLOUD_NAME = 'evil.invalid/path';
    provider.mockClear();
    expect((await new CloudinaryUpload().authorizeUpload(request)).kind).toBe(
      'UNAVAILABLE',
    );
    expect(provider).not.toHaveBeenCalled();
  });
  it('does not issue an expired signature or refresh its timestamp', async () => {
    request = { ...request, expiresAt: new Date(Date.now() - 1) };
    expect((await new CloudinaryUpload().authorizeUpload(request)).kind).toBe(
      'UNAVAILABLE',
    );
    expect(provider).not.toHaveBeenCalled();
  });
  it('translates audio upload mechanics without changing the application category', async () => {
    provider.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          unsigned: false,
          settings: { allowed_formats: ['mp3'] },
        }),
    });
    const result = await new CloudinaryUpload().authorizeUpload({
      ...request,
      category: 'AUDIO',
    });
    expect(result.kind).toBe('AUTHORIZED');
    if (result.kind === 'AUTHORIZED')
      expect(result.intent.uploadEndpoint).toMatch(/\/video\/upload$/);
  });
});
