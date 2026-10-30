import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Put, Req, Res, applyDecorators } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { TemplateAdminService } from '../application/template-admin';
import { IdentityPolicy } from '../../identity/application/ports';
import { accountCookie } from '../../identity/domain/identity';
import { TEMPLATE_AVAILABILITIES, type TemplateAdminView } from '../domain/template-admin';
import { TemplateAdminDataDto, TemplateAdminListResponseDto, TemplateAdminResponseDto, ErrorResponseDto, TemplateAvailabilityDto, TemplateCreateDto, TemplatePublishDto } from './dto';

// Local copies of the identity controller's transport decorators so Admin mutations read the same
// way in the generated contract as the account-status command does.
const errors = () => applyDecorators(...[401, 403, 404, 409, 412, 422, 428, 500, 503].map((status) => ApiResponse({ status, type: ErrorResponseDto })));
const origin = () => ApiHeader({ name: 'Origin', required: true, schema: { type: 'string' } });
const csrf = () => ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } });
const intent = () => ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{16,128}$' } });
const preconditions = () => ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string' } });
const etagHeader = () => ({ ETag: { schema: { type: 'string' } } });

@ApiTags('admin-templates')
@Controller('admin/templates')
export class AdminTemplateController {
  constructor(@Inject(TemplateAdminService) private readonly service: TemplateAdminService,
    @Inject(IdentityPolicy) private readonly policy: IdentityPolicy) {}

  // The transport owns only request/response; every rule below belongs to the application command.
  private id(value: string): string {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new BadRequestException();
    return value;
  }
  private context(req: Request, res: Response) {
    // Identity owns the cookie contract; Templates only resolves the same single account cookie.
    return { secret: accountCookie(req.headers.cookie, this.policy.cookieName), origin: req.get('Origin'), csrf: req.get('X-CSRF-Token'),
      requestId: String(res.getHeader('X-Request-Id')) };
  }
  private send(res: Response, status: number, view: TemplateAdminView): void {
    res.setHeader('ETag', `"${view.version}"`);
    res.status(status).json({ data: TemplateAdminDataDto.from(view) });
  }

  @Post() @origin() @csrf() @intent() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'createTemplate', summary: 'Create an inactive Template carrying its first immutable revision.' })
  @ApiBody({ type: TemplateCreateDto })
  @ApiResponse({ status: 201, type: TemplateAdminResponseDto, headers: etagHeader() })
  async create(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const view = await this.service.create(body, req.get('Idempotency-Key'), this.context(req, res));
    this.send(res, 201, view);
  }

  @Get() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'listAdminTemplates', summary: 'Operational Admin catalog view, filtered by availability state.' })
  @ApiQuery({ name: 'state', required: false, enum: [...TEMPLATE_AVAILABILITIES] })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string', maxLength: 512 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } })
  @ApiResponse({ status: 200, type: TemplateAdminListResponseDto })
  async list(@Query() raw: Record<string, string | undefined>, @Req() req: Request, @Res() res: Response) {
    // Query strings arrive as text; the domain owns the real validation and names the bad field.
    const digits = (value: string | undefined) => value !== undefined && /^\d+$/.test(value) ? Number(value) : value;
    const result = await this.service.list({ state: raw.state, cursor: raw.cursor || undefined, limit: digits(raw.limit) },
      this.context(req, res));
    res.status(200).json({ data: result.data.map(TemplateAdminDataDto.from), meta: result.meta });
  }

  @Post(':id/revisions') @HttpCode(201) @origin() @csrf() @intent() @preconditions() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'publishTemplateRevision', summary: 'Publish a new immutable revision; the previous row is never rewritten.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: TemplatePublishDto })
  @ApiResponse({ status: 201, type: TemplateAdminResponseDto, headers: etagHeader() })
  async publish(@Param('id') id: string, @Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const view = await this.service.publish(this.id(id), body, req.get('Idempotency-Key'), req.get('If-Match'), this.context(req, res));
    this.send(res, 201, view);
  }

  @Put(':id/availability') @HttpCode(200) @origin() @csrf() @intent() @preconditions() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'setTemplateAvailability', summary: 'Activate, deactivate or archive with a required operational reason.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: TemplateAvailabilityDto })
  @ApiResponse({ status: 200, type: TemplateAdminResponseDto, headers: etagHeader() })
  async availability(@Param('id') id: string, @Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const view = await this.service.availability(this.id(id), body, req.get('Idempotency-Key'), req.get('If-Match'), this.context(req, res));
    this.send(res, 200, view);
  }
}
