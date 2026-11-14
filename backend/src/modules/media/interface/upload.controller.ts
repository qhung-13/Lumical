import { Body, Controller, Inject, Post, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { IdentityPolicy } from '../../identity/application/ports';
import { accountCookie } from '../../identity/domain/identity';
import { ErrorResponseDto } from '../../calendar-projects/interface/dto';
import { UploadIntake } from '../application/upload-intake';

class UploadCreateDto {
  @ApiProperty({ enum: ['IMAGE', 'VIDEO', 'AUDIO'] }) category: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 255 }) fileName: string;
  @ApiProperty({
    type: Number,
    minimum: 1,
    maximum: 100_000_000,
    description:
      'Declared bytes: image <=10 MB, video <=100 MB, audio <=20 MB. Trusted verification follows at finalization.',
  })
  declaredBytes: number;
  @ApiPropertyOptional({
    type: Number,
    exclusiveMinimum: true,
    minimum: 0,
    maximum: 60,
  })
  declaredDurationSeconds?: number;
}
class UploadFieldsDto {
  @ApiProperty({
    type: String,
    format: 'uri',
    description:
      'Exact private Cloudinary upload endpoint; never a delivery URL.',
  })
  url: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  fields: Record<string, string>;
  @ApiProperty({ type: String, format: 'date-time' }) expiresAt: string;
}
class UploadIntentDto {
  @ApiProperty({ type: String, format: 'uuid' }) assetId: string;
  @ApiProperty({ type: UploadFieldsDto }) upload: UploadFieldsDto;
}
class UploadResponseDto {
  @ApiProperty({ type: UploadIntentDto }) data: UploadIntentDto;
}

@ApiTags('media')
@Controller('media/uploads')
export class UploadController {
  constructor(
    @Inject(UploadIntake) private readonly intake: UploadIntake,
    @Inject(IdentityPolicy) private readonly policy: IdentityPolicy,
  ) {}
  @Post()
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'initiateMediaUpload',
    summary:
      'Reserve one owned Pending asset and authorize a non-overwriting private upload.',
  })
  @ApiHeader({ name: 'Origin', required: true })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{16,128}$' },
  })
  @ApiBody({ type: UploadCreateDto })
  @ApiResponse({ status: 201, type: UploadResponseDto })
  @ApiResponse({ status: 401, type: ErrorResponseDto })
  @ApiResponse({ status: 403, type: ErrorResponseDto })
  @ApiResponse({ status: 409, type: ErrorResponseDto })
  @ApiResponse({ status: 422, type: ErrorResponseDto })
  @ApiResponse({
    status: 429,
    type: ErrorResponseDto,
    headers: { 'Retry-After': { description: 'Seconds until a new intent can be attempted.', schema: { type: 'integer', minimum: 1 } } },
  })
  @ApiResponse({ status: 503, type: ErrorResponseDto })
  async create(@Req() req: Request, @Body() input: unknown) {
    const data = await this.intake.execute(
      {
        secret: accountCookie(req.headers.cookie, this.policy.cookieName),
        origin: req.get('Origin'),
        csrf: req.get('X-CSRF-Token'),
      },
      input,
      req.get('Idempotency-Key'),
    );
    return { data };
  }
}
