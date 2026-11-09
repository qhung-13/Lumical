import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
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
import { IdentityPolicy } from '../../identity/application/ports';
import { accountCookie } from '../../identity/domain/identity';
import { ErrorResponseDto } from '../../calendar-projects/interface/dto';
import { FinalizeMedia } from '../application/finalize-media';

class MediaFinalizeDto {
  @ApiProperty({
    type: Boolean,
    enum: [true],
    description:
      'Upload completion hint only; all facts are verified independently.',
  })
  uploadCompleted: true;
}
class FinalizedMediaDto {
  @ApiProperty({ type: String, format: 'uuid' }) id: string;
  @ApiProperty({ enum: ['IMAGE', 'VIDEO', 'AUDIO'] }) category: string;
  @ApiProperty({ enum: ['READY'] }) status: string;
  @ApiProperty({ type: Number, minimum: 1 }) verifiedBytes: number;
  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 60 })
  durationSeconds?: number;
}
class FinalizedMediaResponseDto {
  @ApiProperty({ type: FinalizedMediaDto }) data: FinalizedMediaDto;
}
class PendingMediaDto {
  @ApiProperty({ type: String, format: 'uuid' }) assetId: string;
  @ApiProperty({ enum: ['PENDING'] }) status: string;
}
class PendingMediaResponseDto {
  @ApiProperty({ type: PendingMediaDto }) data: PendingMediaDto;
}

@ApiTags('media')
@Controller('media')
export class FinalizeController {
  constructor(
    @Inject(FinalizeMedia) private readonly service: FinalizeMedia,
    @Inject(IdentityPolicy) private readonly policy: IdentityPolicy,
  ) {}
  @Post(':id/finalize')
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'finalizeMediaUpload',
    summary:
      'Independently verify an owned upload and pin immutable Ready media.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiHeader({ name: 'Origin', required: true })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{16,128}$' },
  })
  @ApiBody({ type: MediaFinalizeDto })
  @ApiResponse({ status: 200, type: FinalizedMediaResponseDto })
  @ApiResponse({ status: 202, type: PendingMediaResponseDto })
  @ApiResponse({ status: 401, type: ErrorResponseDto })
  @ApiResponse({ status: 403, type: ErrorResponseDto })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  @ApiResponse({ status: 409, type: ErrorResponseDto })
  @ApiResponse({ status: 422, type: ErrorResponseDto })
  @ApiResponse({ status: 503, type: ErrorResponseDto })
  async finalize(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    const result = await this.service.execute(
      {
        secret: accountCookie(req.headers.cookie, this.policy.cookieName),
        origin: req.get('Origin'),
        csrf: req.get('X-CSRF-Token'),
      },
      id,
      input,
      req.get('Idempotency-Key'),
    );
    res.status(result.status).json({ data: result.data });
  }
}
