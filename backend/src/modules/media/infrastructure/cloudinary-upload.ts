import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { UploadAuthorization } from '../application/upload-intake';
import type {
  PrivateUploadRequest,
  MediaStorage,
} from '../application/media-storage';

const formats = {
  IMAGE: 'jpg,png,webp',
  VIDEO: 'mp4,webm',
  AUDIO: 'mp3,m4a,ogg,wav,webm',
} as const;
const uuid = /^[a-f0-9-]{36}$/i;

/** Upload-only implementation; inspection, delivery and deletion remain separate slices.
 * Never assumes a client-declared byte count or duration is verified media evidence.
 */
@Injectable()
export class CloudinaryUpload extends UploadAuthorization {
  async authorizeUpload(
    request: PrivateUploadRequest,
  ): ReturnType<MediaStorage['authorizeUpload']> {
    const unavailable = { kind: 'UNAVAILABLE', retryable: true } as const;
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    const preset = process.env[`CLOUDINARY_UPLOAD_PRESET_${request.category}`];
    if (
      !cloud ||
      !/^[a-z0-9_-]+$/i.test(cloud) ||
      !apiKey ||
      !/^\d+$/.test(apiKey) ||
      !secret ||
      !preset ||
      !/^[a-z0-9_-]+$/i.test(preset) ||
      !Object.values(request.binding).every((value) => uuid.test(value))
    )
      return unavailable;
    const timestamp = Math.floor(request.expiresAt.getTime() / 1000) - 3600;
    if (
      !Number.isSafeInteger(timestamp) ||
      timestamp > Date.now() / 1000 ||
      timestamp + 3600 <= Date.now() / 1000
    )
      return unavailable;
    try {
      // An explicit signed preset avoids account defaults, unsigned intake and hidden
      // transformations. Recheck at issuance instead of trusting an environment flag.
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud}/upload_presets/${preset}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${apiKey}:${secret}`).toString('base64')}`,
          },
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) return unavailable;
      const settings = (await response.json()) as {
        unsigned?: boolean;
        settings?: Record<string, unknown>;
      };
      const options = settings.settings;
      if (
        settings.unsigned !== false ||
        !options ||
        Object.keys(options).some(
          (key) =>
            ![
              'allowed_formats',
              'type',
              'overwrite',
              'use_filename',
              'unique_filename',
              'discard_original_filename',
            ].includes(key),
        )
      )
        return unavailable;
      const allowed = options.allowed_formats;
      const list = Array.isArray(allowed)
        ? allowed
        : typeof allowed === 'string'
          ? allowed.split(',')
          : [];
      if (
        !list.length ||
        list.some(
          (value) =>
            typeof value !== 'string' ||
            !formats[request.category].split(',').includes(value),
        )
      )
        return unavailable;
      const { ownerId, assetId, uploadIntentId } = request.binding;
      const fields: Record<string, string> = {
        timestamp: String(timestamp),
        upload_preset: preset,
        public_id: `lumical/${ownerId}/${assetId}/${uploadIntentId}`,
        type: 'authenticated',
        overwrite: 'false',
        use_filename: 'false',
        unique_filename: 'false',
        discard_original_filename: 'true',
        allowed_formats: formats[request.category],
        context: `owner_id=${ownerId}|asset_id=${assetId}|upload_intent_id=${uploadIntentId}`,
      };
      const canonical = Object.keys(fields)
        .sort()
        .map((key) => `${key}=${fields[key]}`)
        .join('&');
      const signature = createHash('sha256')
        .update(canonical + secret)
        .digest('hex');
      return {
        kind: 'AUTHORIZED',
        intent: {
          binding: request.binding,
          expiresAt: request.expiresAt,
          uploadEndpoint: `https://api.cloudinary.com/v1_1/${cloud}/${request.category === 'IMAGE' ? 'image' : 'video'}/upload`,
          fields: { ...fields, api_key: apiKey, signature },
        },
      } as const;
    } catch {
      return unavailable;
    }
  }
}
