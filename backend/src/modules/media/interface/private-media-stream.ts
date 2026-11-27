import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { mediaUnavailable, type OwnerMedia } from '../application/owner-media';
import { beforeMediaDeadline } from './media-request-deadline';

export async function streamPrivateMedia(
  req: Request,
  res: Response,
  load: (signal: AbortSignal) => ReturnType<OwnerMedia['content']>,
) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.vary('Cookie');
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.once('aborted', abort);
  res.once('close', abort);
  try {
    if (req.aborted || res.destroyed) return;
    const result = await beforeMediaDeadline(
      controller.signal,
      () => mediaUnavailable(true),
      load,
    );
    if (controller.signal.aborted) return;
    res.setHeader('Accept-Ranges', 'bytes');
    if (result.kind === 'RANGE_NOT_SATISFIABLE') {
      res.setHeader('Content-Range', `bytes */${result.totalBytes}`);
      res.status(416).end();
      return;
    }
    res.status(result.status);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', result.contentLength);
    res.setHeader('Content-Disposition', 'inline');
    if (result.contentRange)
      res.setHeader(
        'Content-Range',
        `bytes ${result.contentRange.start}-${result.contentRange.end}/${result.totalBytes}`,
      );
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    // pipeline applies backpressure and closes both ends on disconnect/error.
    // Never serialize a provider error or URL into an already-started stream.
    try {
      res.flushHeaders();
      await pipeline(Readable.from(result.body!), res, {
        signal: controller.signal,
      });
    } catch {
      if (!res.destroyed) res.destroy();
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  } finally {
    controller.abort();
    req.off('aborted', abort);
    res.off('close', abort);
  }
}
