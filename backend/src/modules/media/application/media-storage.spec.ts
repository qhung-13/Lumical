import { MediaStorage, type PrivateFetchRequest, type PrivateUploadRequest } from './media-storage';
import { assessReadiness, type ImmutableMedia, type Inspection, type MediaBinding } from '../domain/media';

const binding: MediaBinding = { assetId: 'asset', ownerId: 'owner', uploadIntentId: 'intent' };
const object: ImmutableMedia = { binding, storageKey: 'key', contentVersion: 'v1' };

/** Contract fixture only; not configured-provider privacy evidence. */
class FakeMediaStorage extends MediaStorage {
  inspection: Inspection = { kind: 'PENDING' };
  async authorizeUpload(request: PrivateUploadRequest) {
    return Promise.resolve({ kind: 'AUTHORIZED' as const, intent: {
      binding: request.binding, expiresAt: request.expiresAt,
      uploadEndpoint: 'https://upload.invalid', fields: { boundedSignature: 'synthetic' },
    } });
  }
  async inspect() { return Promise.resolve(this.inspection); }
  async fetch(request: PrivateFetchRequest, signal: AbortSignal) {
    if (signal.aborted) return Promise.resolve({ kind: 'UNAVAILABLE' as const, retryable: true });
    if (request.object.contentVersion !== 'v1') return Promise.resolve({ kind: 'NOT_FOUND' as const });
    return Promise.resolve({ kind: 'CONTENT' as const, status: 200 as const,
      contentType: 'image/jpeg', contentLength: 3, totalBytes: 3,
      body: request.method === 'HEAD' ? undefined : (async function* () { yield new Uint8Array([1, 2, 3]); })(),
    });
  }
  async delete() { return Promise.resolve({ kind: 'DELETED' as const }); }
}

describe('MediaStorage contract fake', () => {
  it('binds upload intent and keeps incomplete/unavailable inspection out of Ready', async () => {
    const storage: MediaStorage = new FakeMediaStorage();
    const result = await storage.authorizeUpload({ binding, category: 'IMAGE', expiresAt: new Date('2026-11-09T01:00:00Z') });
    expect(result.kind).toBe('AUTHORIZED');
    if (result.kind === 'AUTHORIZED') expect(result.intent.binding).toEqual(binding);
    expect(await storage.inspect(binding)).toEqual({ kind: 'PENDING' });
    const fake = new FakeMediaStorage();
    fake.inspection = { kind: 'UNAVAILABLE' };
    const inspection = await fake.inspect();
    expect(assessReadiness(binding, 'IMAGE', inspection).status).toBe('UNAVAILABLE');
  });
  it('fetches only the requested immutable version, supports HEAD and cancellation', async () => {
    const storage: MediaStorage = new FakeMediaStorage();
    const request: PrivateFetchRequest = { object, access: { kind: 'OWNER', actorId: 'owner', ownerId: 'owner' },
      method: 'HEAD', rendition: 'ORIGINAL' };
    const controller = new AbortController();
    const result = await storage.fetch(request, controller.signal);
    expect(result.kind).toBe('CONTENT');
    if (result.kind === 'CONTENT') expect(result.body).toBeUndefined();
    expect(await storage.fetch({ ...request, object: { ...object, contentVersion: 'v2' } }, controller.signal)).toEqual({ kind: 'NOT_FOUND' });
    controller.abort();
    expect(await storage.fetch(request, controller.signal)).toEqual({ kind: 'UNAVAILABLE', retryable: true });
    expect(await storage.delete(object)).toEqual({ kind: 'DELETED' });
    expect(await storage.delete(object)).toEqual({ kind: 'DELETED' });
  });
});