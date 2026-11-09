import { Controller, Get, Head, Inject, Param, Req, Res } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { IdentityPolicy } from '../../identity/application/ports';
import { accountCookie } from '../../identity/domain/identity';
import { ErrorResponseDto } from '../../calendar-projects/interface/dto';
import { OwnerMedia } from '../application/owner-media';

class OwnedMediaDto {
  @ApiProperty({ type: String, format: 'uuid' }) id: string;
  @ApiProperty({ enum: ['IMAGE', 'VIDEO', 'AUDIO'] }) category: string;
  @ApiProperty({ enum: ['PENDING', 'READY', 'UNAVAILABLE'] }) status: string;
  @ApiProperty({ type: Number, nullable: true }) verifiedBytes: number | null;
  @ApiPropertyOptional({ type: Number, maximum: 60 }) durationSeconds?: number;
  @ApiPropertyOptional({
    type: String,
    description:
      'Account-protected backend content path, present only for Ready assets.',
  })
  contentPath?: string;
}
class OwnedMediaResponseDto {
  @ApiProperty({ type: OwnedMediaDto }) data: OwnedMediaDto;
}
const streamHeaders = {
  'Cache-Control': { schema: { type: 'string', example: 'private, no-store' } },
  'X-Content-Type-Options': { schema: { type: 'string', example: 'nosniff' } },
  'Content-Type': { schema: { type: 'string' } },
  'Content-Length': { schema: { type: 'integer' } },
  'Accept-Ranges': { schema: { type: 'string', example: 'bytes' } },
};
const binary = {
  'image/jpeg': { schema: { type: 'string', format: 'binary' } },
  'image/png': { schema: { type: 'string', format: 'binary' } },
  'image/webp': { schema: { type: 'string', format: 'binary' } },
  'video/mp4': { schema: { type: 'string', format: 'binary' } },
  'video/webm': { schema: { type: 'string', format: 'binary' } },
  'audio/mpeg': { schema: { type: 'string', format: 'binary' } },
  'audio/mp4': { schema: { type: 'string', format: 'binary' } },
  'audio/ogg': { schema: { type: 'string', format: 'binary' } },
  'audio/wav': { schema: { type: 'string', format: 'binary' } },
  'audio/webm': { schema: { type: 'string', format: 'binary' } },
};

@ApiTags('media')
@ApiCookieAuth()
@ApiResponse({ status: 401, type: ErrorResponseDto })
@ApiResponse({ status: 404, type: ErrorResponseDto })
@ApiResponse({ status: 409, type: ErrorResponseDto })
@ApiResponse({ status: 503, type: ErrorResponseDto })
@Controller('media')
export class OwnerMediaController {
  constructor(
    @Inject(OwnerMedia) private readonly service: OwnerMedia,
    @Inject(IdentityPolicy) private readonly policy: IdentityPolicy,
  ) {}
  private auth(req: Request) {
    return {
      secret: accountCookie(req.headers.cookie, this.policy.cookieName),
    };
  }
  private privacy(res: Response) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.vary('Cookie');
  }
  @Get(':id')
  @ApiOperation({
    operationId: 'getOwnedMedia',
    summary: 'Read current readiness for an owned media asset.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: OwnedMediaResponseDto })
  async status(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    this.privacy(res);
    res.json({ data: await this.service.status(this.auth(req), id) });
  }
  @Get(':id/content')
  @ApiOperation({
    operationId: 'getOwnedMediaContent',
    summary:
      'Stream pinned private content after checking current owner access.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiHeader({
    name: 'Range',
    required: false,
    description: 'Single closed, open or suffix byte range.',
  })
  @ApiResponse({ status: 200, headers: streamHeaders, content: binary })
  @ApiResponse({
    status: 206,
    headers: {
      ...streamHeaders,
      'Content-Range': { schema: { type: 'string' } },
    },
    content: binary,
  })
  @ApiResponse({
    status: 416,
    headers: {
      ...streamHeaders,
      'Content-Range': { schema: { type: 'string', example: 'bytes */67' } },
    },
  })
  async content(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    await this.stream(req, res, id);
  }

  @Head(':id/content')
  @ApiOperation({
    operationId: 'headOwnedMediaContent',
    summary:
      'Read verified private content headers with the same current-access checks as GET.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiHeader({
    name: 'Range',
    required: false,
    description: 'Single byte range; returns matching headers without a body.',
  })
  @ApiResponse({ status: 200, headers: streamHeaders })
  @ApiResponse({
    status: 206,
    headers: {
      ...streamHeaders,
      'Content-Range': { schema: { type: 'string' } },
    },
  })
  @ApiResponse({
    status: 416,
    headers: { 'Content-Range': { schema: { type: 'string' } } },
  })
  async head(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    await this.stream(req, res, id);
  }

  private async stream(req: Request, res: Response, id: string) {
    this.privacy(res);
    const controller = new AbortController();
    const abort = () => controller.abort();
    req.once('aborted', abort);
    res.once('close', abort);
    try {
      const result = await this.service.content(
        this.auth(req),
        id,
        req.method === 'HEAD' ? 'HEAD' : 'GET',
        req.get('If-Range') ? undefined : req.get('Range'),
        controller.signal,
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
        await pipeline(Readable.from(result.body!), res, {
          signal: controller.signal,
        });
      } catch {
        if (!res.destroyed) res.destroy();
      }
    } finally {
      controller.abort();
      req.off('aborted', abort);
      res.off('close', abort);
    }
  }
}
