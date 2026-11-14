import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { MediaInspection } from '../application/finalize-media';
import { MediaContent } from '../application/owner-media';
import { resolveMediaRange } from '../application/media-range';
import type {
  MediaStorage,
  PrivateFetchRequest,
} from '../application/media-storage';

@Injectable()
export class CloudinaryContent extends MediaContent {
  constructor(
    @Inject(MediaInspection) private readonly inspection: MediaInspection,
  ) {
    super();
  }

  async fetch(
    request: PrivateFetchRequest,
    signal: AbortSignal,
  ): ReturnType<MediaStorage['fetch']> {
    const unavailable = { kind: 'UNAVAILABLE', retryable: true } as const;
    const rejected = { kind: 'REJECTED', reason: 'BINDING_MISMATCH' } as const;
    const { binding } = request.object;
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !/^[a-z0-9_-]+$/i.test(cloud) || !secret || signal.aborted)
      return unavailable;
    if (
      request.access.ownerId !== binding.ownerId ||
      request.rendition !== 'ORIGINAL' ||
      (request.access.kind === 'OWNER' &&
        request.access.actorId !== binding.ownerId)
    )
      return rejected;
    const publicId = `lumical/${binding.ownerId}/${binding.assetId}/${binding.uploadIntentId}`;
    const match =
      /^(image|video)\/authenticated\/(lumical\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36})#([a-z0-9]+):([a-f0-9]{32})$/.exec(
        request.object.storageKey,
      );
    if (
      !match ||
      match[2] !== publicId ||
      !/^[1-9]\d{0,9}$/.test(request.object.contentVersion)
    )
      return rejected;
    try {
      // Cloudinary v... URLs can fall back to latest. Compare the pinned format,
      // checksum and version to authenticated facts, then require that ETag on bytes.
      const inspected = await this.inspection.inspect(binding, signal);
      if (inspected.kind === 'UNAVAILABLE') return unavailable;
      if (inspected.kind === 'PENDING') return { kind: 'NOT_FOUND' };
      if (
        inspected.kind !== 'VERIFIED' ||
        inspected.facts.object.storageKey !== request.object.storageKey ||
        inspected.facts.object.contentVersion !== request.object.contentVersion
      )
        return rejected;
      if (signal.aborted) return unavailable;
      const facts = inspected.facts;
      let range;
      try {
        range = request.method === 'GET' && request.range
          ? resolveMediaRange(request.range, facts.bytes)
          : undefined;
      } catch {
        return { kind: 'RANGE_NOT_SATISFIABLE', totalBytes: facts.bytes };
      }
      const signature = createHash('sha256')
        .update(`${publicId}.${match[3]}${secret}`)
        .digest('base64url')
        .slice(0, 8);
      const url = `https://res.cloudinary.com/${cloud}/${match[1]}/authenticated/s--${signature}--/v${request.object.contentVersion}/${publicId}.${match[3]}`;
      const headers: Record<string, string> = {
        'Accept-Encoding': 'identity',
        'If-Match': `"${match[4]}"`,
      };
      if (range) headers.Range = `bytes=${range.start}-${range.end}`;
      const response = await fetch(url, {
        method: request.method,
        headers,
        redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
      });
      const cancel = async () => {
        await response.body?.cancel().catch(() => undefined);
      };
      if (response.status === 404) {
        await cancel();
        return { kind: 'NOT_FOUND' };
      }
      const expectedLength = range ? range.end - range.start + 1 : facts.bytes;
      const contentRange = range
        ? `bytes ${range.start}-${range.end}/${facts.bytes}`
        : null;
      const encoding = response.headers.get('content-encoding');
      if (
        response.status !== (range ? 206 : 200) ||
        response.headers
          .get('content-type')
          ?.split(';')[0]
          .trim()
          .toLowerCase() !== facts.contentType ||
        response.headers.get('content-length') !== String(expectedLength) ||
        response.headers.get('content-range') !== contentRange ||
        response.headers.get('etag')?.toLowerCase() !== `"${match[4]}"` ||
        (encoding !== null && encoding !== 'identity')
      ) {
        await cancel();
        return unavailable;
      }
      if (request.method === 'HEAD') {
        await cancel();
        return {
          kind: 'CONTENT',
          status: 200,
          contentType: facts.contentType,
          contentLength: expectedLength,
          totalBytes: facts.bytes,
        };
      }
      if (!response.body) return unavailable;
      const stream = response.body;
      async function* bytes(): AsyncIterable<Uint8Array> {
        const reader = stream.getReader();
        let received = 0;
        try {
          for (;;) {
            const next = await reader.read();
            if (next.done) break;
            received += next.value.byteLength;
            if (received > expectedLength || signal.aborted)
              throw new Error('Media stream interrupted');
            yield next.value;
          }
          if (received !== expectedLength)
            throw new Error('Media stream interrupted');
        } finally {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
      }
      return {
        kind: 'CONTENT',
        status: range ? 206 : 200,
        contentType: facts.contentType,
        contentLength: expectedLength,
        totalBytes: facts.bytes,
        ...(range ? { contentRange: range } : {}),
        body: bytes(),
      };
    } catch {
      return unavailable;
    }
  }
}
