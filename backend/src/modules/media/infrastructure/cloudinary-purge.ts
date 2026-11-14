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
    const pinned = target.pinned;
    if (pinned) {
      const pin = /^(image|video)\/authenticated\/([^#]+)#[a-z0-9]+:[a-f0-9]{32}$/.exec(pinned.storageKey);
      if (
        pin?.[2] !== key ||
        pinned.binding.assetId !== binding.assetId ||
        pinned.binding.ownerId !== binding.ownerId ||
        pinned.binding.uploadIntentId !== binding.uploadIntentId ||
        !/^[1-9]\d{0,9}$/.test(pinned.contentVersion) ||
        Number(pinned.contentVersion) > 2_147_483_647
      ) return rejected;
    }
    const auth = {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${secret}`).toString('base64')}`,
    };
    // resource_type is not covered by Cloudinary upload signatures. Include
    // raw only for cleanup of malicious/unsupported intake, never readiness.
    const namespaces = ['image', 'video', 'raw'];
    const inspect = (resource: string) => fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/resources/${resource}/authenticated/${encodeURIComponent(key)}?context=true&media_metadata=true`,
      {
        headers: auth,
        redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      },
    );
    const unconfirmed = { kind: 'DELETE_UNCONFIRMED' } as const;
    let deleteAcknowledged = false;
    try {
      let assetId: string | undefined;
      for (const resource of namespaces) {
        const response = await inspect(resource);
        if (!response.ok) {
          await response.body?.cancel();
          if (response.status === 404) continue;
          return unavailable;
        }
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
        if (pinned) {
          const storageKey = `${resource}/authenticated/${key}#${String(data.format)}:${String(data.etag).toLowerCase()}`;
          if (
            pinned.storageKey !== storageKey ||
            pinned.contentVersion !== String(data.version)
          )
            return rejected;
        }
        // More than one namespace for the same intake makes the target ambiguous.
        if (assetId) return rejected;
        assetId = data.asset_id;
      }
      if (!assetId) return { kind: 'MISSING' };
      // The single matching object was inspected, but Cloudinary does not bind
      // this DELETE to its inspected version. Writer isolation is still needed.
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud}/resources`,
        {
          method: 'DELETE',
          headers: auth,
          body: new URLSearchParams({ 'asset_ids[]': assetId }),
          redirect: 'error',
          signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 404) return { kind: 'MISSING' };
        return unavailable;
      }
      const deleted = object(object(await response.json()).deleted);
      const outcome = deleted[assetId] ?? deleted[key];
      if (outcome === 'not_found') return { kind: 'MISSING' };
      if (outcome !== 'deleted') return unavailable;
      deleteAcknowledged = true;
      for (const resource of namespaces) {
        const remaining = await inspect(resource);
        await remaining.body?.cancel();
        // Leave any new object for review. The previous checks covered only
        // the asset ID already sent to DELETE.
        if (remaining.status !== 404) return unconfirmed;
      }
      // A recheck is a snapshot. A signed request accepted before expiry may
      // still complete later even though every namespace just reported 404.
      return target.uploadsQuiescent ? { kind: 'DELETED' } : unconfirmed;
    } catch {
      return deleteAcknowledged ? unconfirmed : unavailable;
    }
  }
}
