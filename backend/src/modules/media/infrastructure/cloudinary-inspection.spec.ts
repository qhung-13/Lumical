import { randomUUID } from 'node:crypto';
import {
  CloudinaryInspection,
  inspectCloudinaryResource,
} from './cloudinary-inspection';
import type { MediaBinding, MediaCategory } from '../domain/media';

const binding: MediaBinding = {
  ownerId: randomUUID(),
  assetId: randomUUID(),
  uploadIntentId: randomUUID(),
};
const resource = (category: MediaCategory = 'IMAGE') => ({
  etag: 'a'.repeat(32),
  public_id: `lumical/${binding.ownerId}/${binding.assetId}/${binding.uploadIntentId}`,
  context: {
    custom: {
      owner_id: binding.ownerId,
      asset_id: binding.assetId,
      upload_intent_id: binding.uploadIntentId,
    },
  },
  type: 'authenticated',
  resource_type: category === 'IMAGE' ? 'image' : 'video',
  version: 1_794_200_000,
  format: category === 'IMAGE' ? 'png' : category === 'VIDEO' ? 'mp4' : 'mp3',
  bytes: 100,
  ...(category === 'AUDIO'
    ? { audio: { codec: 'mp3' }, duration: 60 }
    : {
        width: 1,
        height: 1,
        ...(category === 'VIDEO'
          ? { video: { codec: 'h264' }, duration: 60 }
          : {}),
      }),
});
describe('trusted Cloudinary metadata translation', () => {
  it.each<MediaCategory>(['IMAGE', 'VIDEO', 'AUDIO'])(
    'verifies %s with immutable provider identity and MIME',
    (category) => {
      const result = inspectCloudinaryResource(binding, resource(category));
      expect(result.kind).toBe('VERIFIED');
      if (result.kind === 'VERIFIED') {
        expect(result.facts.category).toBe(category);
        expect(result.facts.object.contentVersion).toBe('1794200000');
        expect(
          result.facts.privateOriginal && result.facts.privateDerivatives,
        ).toBe(true);
        expect(result.facts.object.storageKey).not.toMatch(/https?:/);
      }
    },
  );
  it.each([
    { public_id: 'different' },
    { context: {} },
    {
      context: {
        custom: {
          owner_id: 'other',
          asset_id: binding.assetId,
          upload_intent_id: binding.uploadIntentId,
        },
      },
    },
    {
      context: {
        custom: {
          owner_id: binding.ownerId,
          asset_id: binding.assetId,
          upload_intent_id: 'other',
        },
      },
    },
  ])('rejects mismatched binding %j', (patch) => {
    expect(
      inspectCloudinaryResource(binding, { ...resource(), ...patch }),
    ).toMatchObject({ kind: 'REJECTED', reason: 'BINDING_MISMATCH' });
  });
  it.each([
    { type: 'upload' },
    { type: 'private' },
    { format: 'svg' },
    { format: 'html' },
    { bytes: 0 },
    { bytes: -1 },
    { bytes: 1.5 },
    { bytes: 10_000_001 },
    { bytes: '100' },
    { width: 0 },
    { height: null },
    { version: 0 },
    { version: '1794200000' },
    { version: 2_147_483_648 },
    { access_mode: 'public' },
    { etag: undefined },
    { etag: 'invalid-checksum' },
    { moderation: 'approved' },
    { access_control: [{ access_type: 'anonymous' }] },
  ])('rejects unsafe/malformed image metadata %j', (patch) => {
    expect(
      inspectCloudinaryResource(binding, { ...resource(), ...patch }).kind,
    ).toBe('REJECTED');
  });
  it.each<MediaCategory>(['VIDEO', 'AUDIO'])(
    'rejects %s exceeding real duration/size or missing codec evidence',
    (category) => {
      for (const patch of [
        { duration: 60.01 },
        { duration: null },
        { duration: 0 },
        { duration: '60' },
        { bytes: category === 'VIDEO' ? 100_000_001 : 20_000_001 },
        { video: {}, audio: {} },
      ])
        expect(
          inspectCloudinaryResource(binding, {
            ...resource(category),
            ...patch,
          }).kind,
        ).toBe('REJECTED');
    },
  );
  it('requires moderation approval instead of marking in-progress content Ready', () => {
    expect(
      inspectCloudinaryResource(binding, {
        ...resource(),
        moderation: [{ status: 'pending' }],
      }),
    ).toEqual({ kind: 'PENDING' });
    expect(
      inspectCloudinaryResource(binding, {
        ...resource(),
        moderation: [{ status: 'rejected' }],
      }).kind,
    ).toBe('REJECTED');
  });
});

describe('authenticated Cloudinary inspection boundary', () => {
  const env = { ...process.env };
  const originalFetch = global.fetch;
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
          url.includes('/image/')
            ? { ok: true, status: 200, json: () => Promise.resolve(resource()) }
            : { ok: false, status: 404 },
        ),
      );
    global.fetch = provider as typeof fetch;
  });
  afterEach(() => {
    process.env = { ...env };
    global.fetch = originalFetch;
  });
  it('uses fixed authenticated Admin API paths with no redirects or public delivery URLs', async () => {
    const result = await new CloudinaryInspection().inspect(binding);
    expect(result.kind).toBe('VERIFIED');
    expect(provider).toHaveBeenCalledTimes(2);
    for (const [url, options] of provider.mock.calls) {
      expect(url).toMatch(
        /^https:\/\/api.cloudinary.com\/v1_1\/test-cloud\/resources\/(image|video)\/authenticated\/lumical%2F/,
      );
      expect(options.redirect).toBe('error');
      expect(options.headers.Authorization).toBe(
        `Basic ${Buffer.from('123:test-secret').toString('base64')}`,
      );
    }
    expect(JSON.stringify(result)).not.toMatch(/test-secret|secure_url|https:/);
  });
  it('maps not-yet-visible resources to Pending', async () => {
    provider.mockResolvedValue({ ok: false, status: 404 });
    expect(await new CloudinaryInspection().inspect(binding)).toEqual({
      kind: 'PENDING',
    });
  });
  it('cancels both outstanding Admin probes when the caller disconnects', async () => {
    const controller = new AbortController();
    const cancelled = jest.fn();
    provider.mockImplementation((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
      signal!.addEventListener('abort', () => {
        cancelled();
        reject(signal!.reason);
      }, { once: true });
    }));
    const pending = new CloudinaryInspection().inspect(binding, controller.signal);
    expect(provider).toHaveBeenCalledTimes(2);
    controller.abort();
    await expect(pending).resolves.toMatchObject({ kind: 'UNAVAILABLE' });
    expect(cancelled).toHaveBeenCalledTimes(2);
  });
  it('returns controlled uncertainty and aborts both slow Admin probes at 15 s', async () => {
    const timer = new AbortController();
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(timer.signal);
    try {
      const aborted = jest.fn();
      provider.mockImplementation((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
        signal!.addEventListener('abort', () => {
          aborted();
          reject(signal!.reason);
        }, { once: true });
      }));
      const result = new CloudinaryInspection().inspect(binding);
      expect(timeout).toHaveBeenCalledWith(15_000);
      timer.abort(new DOMException('Timeout', 'TimeoutError'));
      await expect(result).resolves.toEqual({ kind: 'UNAVAILABLE', retryable: true });
      expect(aborted).toHaveBeenCalledTimes(2);
    } finally {
      timeout.mockRestore();
    }
  });
  it.each([401, 403, 429, 500, 503])(
    'maps HTTP %s to controlled uncertainty',
    async (status) => {
      provider.mockResolvedValue({ ok: false, status });
      expect(await new CloudinaryInspection().inspect(binding)).toEqual({
        kind: 'UNAVAILABLE',
        retryable: true,
      });
    },
  );
  it('maps timeout and malformed provider JSON without exposing raw errors', async () => {
    provider.mockRejectedValue(new Error('raw secret'));
    expect((await new CloudinaryInspection().inspect(binding)).kind).toBe(
      'UNAVAILABLE',
    );
    provider.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('invalid JSON')),
    });
    expect((await new CloudinaryInspection().inspect(binding)).kind).toBe(
      'UNAVAILABLE',
    );
  });
  it('rejects a collision across provider resource namespaces', async () => {
    provider.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            resource(url.includes('/image/') ? 'IMAGE' : 'VIDEO'),
          ),
      }),
    );
    expect(await new CloudinaryInspection().inspect(binding)).toEqual({
      kind: 'REJECTED',
      reason: 'CONFLICT',
    });
  });
  it('fails closed before network for invalid configuration or binding', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = '../evil';
    expect((await new CloudinaryInspection().inspect(binding)).kind).toBe(
      'UNAVAILABLE',
    );
    expect(provider).not.toHaveBeenCalled();
  });
});
