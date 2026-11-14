import { Controller, Delete, Inject, Param, Req, Res } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { IdentityPolicy } from '../../identity/application/ports';
import { accountCookie } from '../../identity/domain/identity';
import { ErrorResponseDto } from '../../calendar-projects/interface/dto';
import { MediaCleanup } from '../application/media-cleanup';

class RetainedMediaDto {
  @ApiProperty({ type: Boolean, enum: [true] }) retainedForHistory: true;
}
class RetainedMediaResponseDto {
  @ApiProperty({ type: RetainedMediaDto }) data: RetainedMediaDto;
}
@ApiTags('media')
@ApiCookieAuth()
@Controller('media')
export class DeleteMediaController {
  constructor(
    @Inject(MediaCleanup) private readonly service: MediaCleanup,
    @Inject(IdentityPolicy) private readonly policy: IdentityPolicy,
  ) {}
  @Delete(':id')
  @ApiOperation({
    operationId: 'deleteOwnedMedia',
    summary:
      'Revoke unused media immediately and durably schedule safe provider cleanup.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiHeader({ name: 'Origin', required: true })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiResponse({
    status: 204,
    description:
      'Access revoked; provider cleanup runs durably after upload signatures expire. Safe repeat.',
  })
  @ApiResponse({ status: 200, type: RetainedMediaResponseDto })
  @ApiResponse({ status: 401, type: ErrorResponseDto })
  @ApiResponse({ status: 403, type: ErrorResponseDto })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  @ApiResponse({ status: 409, type: ErrorResponseDto })
  async remove(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.vary('Cookie');
    const result = await this.service.remove(
      {
        secret: accountCookie(req.headers.cookie, this.policy.cookieName),
        csrf: req.get('X-CSRF-Token'),
        origin: req.get('Origin'),
      },
      id,
    );
    if (result === 'RETAINED') res.json({ data: { retainedForHistory: true } });
    else res.status(204).end();
  }
}
