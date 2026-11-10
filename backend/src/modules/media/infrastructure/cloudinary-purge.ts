import { Injectable } from '@nestjs/common';
import { MediaPurge, type CleanupTarget } from '../application/media-cleanup';

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

@Injectable()
export class CloudinaryPurge extends MediaPurge {
  async purge(
    target: CleanupTarget,
    signal: AbortSignal,
  ): ReturnType<MediaPurge['purge']> {
    const unavailable = { kind: 'UNAVAILABLE', retryable: true } as const;
    const rejected = { kind: 'REJECTED', reason: 'BINDING_MISMATCH' } as const;
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (
      !cloud ||
      !/^[a-z0-9_-]+$/i.test(cloud) ||
      !apiKey ||
      !/^\d+$/.test(apiKey) ||
      !secret ||
      signal.aborted
    )
      return unavailable;
    const binding = target.binding;
    if (
      ![binding.ownerId, binding.assetId, binding.uploadIntentId].every((id) =>
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          id,
        ),
      )
    )
      return rejected;
    const key = `lumical/${binding.ownerId}/${binding.assetId}/${binding.uploadIntentId}`;
    const auth = {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${secret}`).toString('base64')}`,
    };
    try {
      const found: Array<{ resource: string; assetId: string }> = [];
      // resource_type is not covered by Cloudinary upload signatures. Include
      // raw only for cleanup of malicious/unsupported intake, never readiness.
      for (const resource of ['image', 'video', 'raw']) {
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloud}/resources/${resource}/authenticated/${encodeURIComponent(key)}?context=true&media_metadata=true`,
          {
            headers: auth,
            redirect: 'error',
            signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
          },
        );
        if (response.status === 404) continue;
        if (!response.ok) return unavailable;
        const data = object(await response.json());
        const context = object(object(data.context).custom);
        if (
          data.public_id !== key ||
          data.type !== 'authenticated' ||
          data.resource_type !== resource ||
          context.owner_id !== binding.ownerId ||
          context.asset_id !== binding.assetId ||
          context.upload_intent_id !== binding.uploadIntentId ||
          typeof data.asset_id !== 'string' ||
          !/^[a-f0-9]{32}$/i.test(data.asset_id) ||
          typeof data.version !== 'number' ||
          !Number.isSafeInteger(data.version) ||
          data.version <= 0
        )
          return rejected;
        if (target.pinned) {
          const pinned = target.pinned;
          const storageKey = `${resource}/authenticated/${key}#${String(data.format)}:${String(data.etag).toLowerCase()}`;
          if (
            pinned.storageKey !== storageKey ||
            pinned.contentVersion !== String(data.version) ||
            pinned.binding.assetId !== binding.assetId ||
            pinned.binding.ownerId !== binding.ownerId ||
            pinned.binding.uploadIntentId !== binding.uploadIntentId
          )
            return rejected;
        }
        found.push({ resource, assetId: data.asset_id });
      }
      // All candidates are checked before the first delete. Pending unsafe objects
      // may be removed by exact binding; a newer/different pinned object never is.
      for (const item of found) {
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloud}/resources`,
          {
            method: 'DELETE',
            headers: auth,
            body: new URLSearchParams({ 'asset_ids[]': item.assetId }),
            redirect: 'error',
            signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
          },
        );
        if (!response.ok) return unavailable;
        const result = object(await response.json());
        const deleted = object(result.deleted);
        const outcome = deleted[item.assetId] ?? deleted[key];
        if (outcome !== 'deleted' && outcome !== 'not_found')
          return unavailable;
      }
      return { kind: 'DELETED' };
    } catch {
      return unavailable;
    }
  }
}
