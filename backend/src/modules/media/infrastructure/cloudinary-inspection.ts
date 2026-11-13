import { Injectable } from '@nestjs/common';
import { MediaInspection } from '../application/finalize-media';
import type { MediaStorage } from '../application/media-storage';
import {
  assessReadiness,
  type MediaBinding,
  type MediaCategory,
  type VerifiedMediaFacts,
} from '../domain/media';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const mime: Record<MediaCategory, Record<string, string>> = {
  IMAGE: {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  },
  VIDEO: { mp4: 'video/mp4', webm: 'video/webm' },
  AUDIO: {
    mp3: 'audio/mpeg',
    mp4: 'audio/mp4',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    webm: 'audio/webm',
  },
};

/** Resource facts come only from authenticated Admin API responses, never upload DTOs. */
export function inspectCloudinaryResource(
  binding: MediaBinding,
  value: unknown,
): Awaited<ReturnType<MediaStorage['inspect']>> {
  const data = record(value);
  const context = record(record(data.context).custom);
  const key = `lumical/${binding.ownerId}/${binding.assetId}/${binding.uploadIntentId}`;
  const rejected = (reason: 'BINDING_MISMATCH' | 'INVALID_CONTENT') =>
    ({ kind: 'REJECTED', reason }) as const;
  if (
    data.public_id !== key ||
    context.owner_id !== binding.ownerId ||
    context.asset_id !== binding.assetId ||
    context.upload_intent_id !== binding.uploadIntentId
  )
    return rejected('BINDING_MISMATCH');
  if (
    data.type !== 'authenticated' ||
    data.access_mode === 'public' ||
    (data.access_control !== undefined &&
      (!Array.isArray(data.access_control) ||
        data.access_control.some(
          (entry) => record(entry).access_type === 'anonymous',
        )))
  )
    return rejected('INVALID_CONTENT');
  if (
    typeof data.version !== 'number' ||
    !Number.isSafeInteger(data.version) ||
    data.version <= 0 ||
    data.version > 2_147_483_647
  )
    return rejected('INVALID_CONTENT');
  if (data.moderation !== undefined && !Array.isArray(data.moderation))
    return rejected('INVALID_CONTENT');
  if (
    Array.isArray(data.moderation) &&
    data.moderation.some((entry) => record(entry).status !== 'approved')
  ) {
    return data.moderation.some((entry) => record(entry).status === 'rejected')
      ? rejected('INVALID_CONTENT')
      : { kind: 'PENDING' };
  }
  let category: MediaCategory;
  if (data.resource_type === 'image') {
    if (!positive(data.width) || !positive(data.height))
      return rejected('INVALID_CONTENT');
    category = 'IMAGE';
  } else if (data.resource_type === 'video') {
    const video = record(data.video);
    const audio = record(data.audio);
    if (
      typeof video.codec === 'string' &&
      video.codec &&
      positive(data.width) &&
      positive(data.height)
    )
      category = 'VIDEO';
    else if (
      typeof audio.codec === 'string' &&
      audio.codec &&
      !Object.keys(video).length &&
      (data.width === undefined || data.width === 0) &&
      (data.height === undefined || data.height === 0)
    )
      category = 'AUDIO';
    else return rejected('INVALID_CONTENT');
  } else return rejected('INVALID_CONTENT');
  const contentType =
    typeof data.format === 'string' ? mime[category][data.format] : undefined;
  if (!contentType || typeof data.bytes !== 'number')
    return rejected('INVALID_CONTENT');
  if (typeof data.etag !== 'string' || !/^[a-f0-9]{32}$/i.test(data.etag))
    return rejected('INVALID_CONTENT');
  const duration = category === 'IMAGE' ? null : data.duration;
  if (duration !== null && typeof duration !== 'number')
    return rejected('INVALID_CONTENT');
  const facts: VerifiedMediaFacts = {
    object: {
      binding,
      storageKey: `${data.resource_type}/authenticated/${key}#${data.format as string}:${data.etag.toLowerCase()}`,
      contentVersion: String(data.version),
    },
    category,
    contentType,
    bytes: data.bytes,
    durationSeconds: duration,
    // Authenticated delivery type protects originals AND all prepared derivatives.
    privateOriginal: true,
    privateDerivatives: true,
  };
  return assessReadiness(binding, category, { kind: 'VERIFIED', facts })
    .status === 'READY'
    ? { kind: 'VERIFIED', facts }
    : rejected('INVALID_CONTENT');
}

@Injectable()
export class CloudinaryInspection extends MediaInspection {
  async inspect(binding: MediaBinding): ReturnType<MediaStorage['inspect']> {
    const unavailable = { kind: 'UNAVAILABLE', retryable: true } as const;
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (
      !cloud ||
      !/^[a-z0-9_-]+$/i.test(cloud) ||
      !apiKey ||
      !/^\d+$/.test(apiKey) ||
      !secret ||
      !Object.values(binding).every((value) =>
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          value,
        ),
      )
    )
      return unavailable;
    const key = encodeURIComponent(
      `lumical/${binding.ownerId}/${binding.assetId}/${binding.uploadIntentId}`,
    );
    try {
      // The port deliberately has no provider resource type. Probe both namespaces;
      // ambiguity is a collision, never a guess based on caller-declared category.
      const responses = await Promise.all(
        ['image', 'video'].map(async (resourceType) => {
          const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloud}/resources/${resourceType}/authenticated/${key}?context=true&media_metadata=true`,
            {
              headers: {
                Authorization: `Basic ${Buffer.from(`${apiKey}:${secret}`).toString('base64')}`,
              },
              redirect: 'error',
              signal: AbortSignal.timeout(15_000),
            },
          );
          if (response.status === 404) return { kind: 'MISSING' } as const;
          if (!response.ok) return unavailable;
          const data: unknown = await response.json();
          if (record(data).resource_type !== resourceType)
            return { kind: 'REJECTED', reason: 'BINDING_MISMATCH' } as const;
          return { kind: 'FOUND', data } as const;
        }),
      );
      if (responses.some((response) => response.kind === 'UNAVAILABLE'))
        return unavailable;
      if (responses.some((response) => response.kind === 'REJECTED'))
        return { kind: 'REJECTED', reason: 'BINDING_MISMATCH' };
      const found = responses.filter((response) => response.kind === 'FOUND');
      if (!found.length) return { kind: 'PENDING' };
      if (found.length > 1) return { kind: 'REJECTED', reason: 'CONFLICT' };
      return inspectCloudinaryResource(binding, found[0].data);
    } catch {
      return unavailable;
    }
  }
}
