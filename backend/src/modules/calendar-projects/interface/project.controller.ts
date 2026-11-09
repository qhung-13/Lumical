import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, Res, applyDecorators } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { IdentityPolicy } from '../../identity/application/ports';
import { accountCookie } from '../../identity/domain/identity';
import { ProjectOwnerService, type ProjectBrowserContext } from '../application/project-owner';
import { PROJECT_STATUSES, type ProjectView } from '../domain/project';
import { ProjectCreateDto, ProjectDataDto, ProjectDeleteDto, ProjectDetailDataDto, ProjectDetailResponseDto, ProjectListResponseDto, ProjectMonthsDataDto, ProjectMonthsResponseDto, ProjectPatchDto, ProjectResponseDto, ErrorResponseDto } from './dto';

// Local copies of the identity controller's transport decorators so Project
// mutations read the same way in the generated contract as the account command.
const errors = () => applyDecorators(...[401, 403, 404, 409, 412, 422, 428, 500, 503].map((status) => ApiResponse({ status, type: ErrorResponseDto })));
const origin = () => ApiHeader({ name: 'Origin', required: true, schema: { type: 'string' } });
const csrf = () => ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } });
const intent = () => ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{16,128}$' } });
const preconditions = () => ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string' } });
const etagHeader = () => ({ ETag: { schema: { type: 'string' } } });

@ApiTags('projects')
@Controller('projects')
export class ProjectController {
  constructor(
    @Inject(ProjectOwnerService) private readonly service: ProjectOwnerService,
    @Inject(IdentityPolicy) private readonly policy: IdentityPolicy,
  ) {}

  // The transport owns only request/response; every rule below belongs to an
  // application command or to the domain.
  private id(value: string): string {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new BadRequestException();
    return value;
  }
  private auth(req: Request): ProjectBrowserContext {
    // Identity owns the cookie contract; Projects resolve the same single cookie.
    return { secret: accountCookie(req.headers.cookie, this.policy.cookieName), origin: req.get('Origin'), csrf: req.get('X-CSRF-Token') };
  }
  private send(res: Response, status: number, view: ProjectView): void {
    res.setHeader('ETag', `"${view.version}"`);
    res.status(status).json({ data: ProjectDataDto.from(view) });
  }

  @Post() @origin() @csrf() @intent() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'createProject', summary: 'Create an owned twelve-Month Project from an active published Template.' })
  @ApiBody({ type: ProjectCreateDto })
  @ApiResponse({ status: 201, type: ProjectResponseDto, headers: etagHeader() })
  async create(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const view = await this.service.create(body, req.get('Idempotency-Key'), this.auth(req));
    this.send(res, 201, view);
  }

  @Get() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'listProjects', summary: 'Cursor page of the caller\'s own Projects, newest first.' })
  @ApiQuery({ name: 'state', required: false, enum: [...PROJECT_STATUSES] })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string', maxLength: 512 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } })
  @ApiResponse({ status: 200, type: ProjectListResponseDto })
  async list(@Query() raw: Record<string, string | undefined>, @Req() req: Request, @Res() res: Response) {
    // Query strings arrive as text; the domain owns the validation and names the
    // bad field. `cursor` is forwarded verbatim so `?cursor=` is rejected rather
    // than silently serving page one.
    const digits = (value: string | undefined) => value !== undefined && /^\d+$/.test(value) ? Number(value) : value;
    const result = await this.service.list({ state: raw.state, cursor: raw.cursor, limit: digits(raw.limit) }, this.auth(req));
    res.status(200).json({ data: result.data.map(ProjectDataDto.from), meta: result.meta });
  }

  @Get(':id/months') @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'getProjectMonths', summary: 'All twelve Months of one owned Project, ordered, with its current version.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProjectMonthsResponseDto, headers: etagHeader() })
  async months(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const view = await this.service.months(this.id(id), this.auth(req));
    res.setHeader('ETag', `"${view.projectVersion}"`);
    res.status(200).json({ data: ProjectMonthsDataDto.from(view.projectVersion, view.months) });
  }

  @Get(':id') @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'getProject', summary: 'Reopen one owned Project.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProjectDetailResponseDto, headers: etagHeader() })
  async get(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const view = await this.service.get(this.id(id), this.auth(req));
    res.setHeader('ETag', `"${view.version}"`);
    res.status(200).json({ data: ProjectDetailDataDto.from(view) });
  }

  @Patch(':id') @origin() @csrf() @preconditions() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'patchProject', summary: 'Edit identity and curated style; the Project version advances.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: ProjectPatchDto })
  @ApiResponse({ status: 200, type: ProjectResponseDto, headers: etagHeader() })
  async patch(@Param('id') id: string, @Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const view = await this.service.patch(this.id(id), body, req.get('If-Match'), this.auth(req));
    this.send(res, 200, view);
  }

  @Post(':id/archive') @HttpCode(200) @origin() @csrf() @preconditions() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'archiveProject', summary: 'Archive the Project; a repeat of the desired state is safe and writes nothing.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProjectResponseDto, headers: etagHeader() })
  async archive(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const view = await this.service.archive(this.id(id), req.get('If-Match'), this.auth(req));
    this.send(res, 200, view);
  }

  @Post(':id/restore') @HttpCode(200) @origin() @csrf() @preconditions() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'restoreProject', summary: 'Restore the Project to Working; a repeat of the desired state is safe.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProjectResponseDto, headers: etagHeader() })
  async restore(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const view = await this.service.restore(this.id(id), req.get('If-Match'), this.auth(req));
    this.send(res, 200, view);
  }

  @Delete(':id') @HttpCode(204) @origin() @csrf() @preconditions() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'deleteProject', summary: 'Permanently delete a never-ordered Project after explicit confirmation.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: ProjectDeleteDto })
  @ApiResponse({ status: 204, description: 'The Project and its project-scoped rows are gone; owned media assets stay with the account.' })
  async remove(@Param('id') id: string, @Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    await this.service.remove(this.id(id), body, req.get('If-Match'), this.auth(req));
    res.status(204).send();
  }
}
