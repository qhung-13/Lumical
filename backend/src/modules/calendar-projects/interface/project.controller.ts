import { parseMediaRange, resolveMediaRange } from '../../media/application/media-range';
import { OwnerARContent } from '../application/owner-ar-content';
import { streamPrivateMedia } from '../../media/interface/private-media-stream';
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, Req, Res, applyDecorators } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { IdentityPolicy } from '../../identity/application/ports';
import { accountCookie } from '../../identity/domain/identity';
import { ProjectOwnerService, type ProjectBrowserContext } from '../application/project-owner';
import { PROJECT_STATUSES, type ProjectView } from '../domain/project';
import { ARCurrentResponseDto, ARConfigResponseDto, ARWriteDto, EventWriteDto, MonthPatchDto, SpecialDateResponseDto, SpecialDatesResponseDto } from './personalization-dto';
import { ARPreviewDataDto, ARPreviewResponseDto, MonthResponseDto, ProjectCreateDto, ProjectDataDto, ProjectDeleteDto, ProjectDetailDataDto, ProjectDetailResponseDto, ProjectListResponseDto, ProjectMonthsDataDto, ProjectMonthsResponseDto, ProjectPatchDto, ProjectPreviewDataDto, ProjectPreviewResponseDto, ProjectResponseDto, ErrorResponseDto } from './dto';

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
    @Inject(OwnerARContent) private readonly arContent: OwnerARContent,
  ) {}

  // The transport owns only request/response; every rule below belongs to an
  // application command or to the domain.
  private id(value: string): string {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new BadRequestException();
    return value.toLowerCase();
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

  @Get(':id/preview') @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'getProjectPreview', summary: 'Read one owner-authorized saved Project snapshot and public readiness.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProjectPreviewResponseDto, headers: etagHeader() })
  async preview(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const view = await this.service.preview(this.id(id), this.auth(req));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('ETag', `"${view.projectVersion}"`);
    res.status(200).json({ data: ProjectPreviewDataDto.from(view) });
  }

  private revision(res: Response, status: number, data: { projectVersion: number }) {
    res.setHeader('ETag', `"${data.projectVersion}"`);
    res.status(status).json({ data });
  }

  @Get(':id/ar/config') @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'getProjectARConfig', summary: 'Read the current owner reveal configuration without granting preview readiness.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ARCurrentResponseDto, headers: etagHeader() })
  async arConfig(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    this.revision(res, 200, await this.service.arConfig(this.id(id), this.auth(req)));
  }

  @Get(':id/ar/preview') @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'getProjectARPreview', summary: 'Read the owner-authorized target and reveal fallback preview.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ARPreviewResponseDto, headers: etagHeader() })
  async arPreview(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const data = await this.service.arPreview(this.id(id), this.auth(req));
    res.setHeader('Cache-Control', 'private, no-store');
    this.revision(res, 200, ARPreviewDataDto.from(data, this.id(id)));
  }

  private arQuery(raw: Request['query'], required = true) {
    const value = raw.projectVersion;
    if (value === undefined && !required) return { version: undefined, targetId: undefined };
    if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value)))
      throw new BadRequestException();
    if (raw.targetId !== undefined && typeof raw.targetId !== 'string') throw new BadRequestException();
    return { version: Number(value), targetId: raw.targetId === undefined ? undefined : this.id(raw.targetId).toLowerCase() };
  }

  @Get(':id/ar/reveal') @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'getProjectARReveal', summary: 'Resolve the saved owner reveal; targetId binds recognition, omitted selects camera-free fallback.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'projectVersion', required: true, schema: { type: 'integer', minimum: 1 } })
  @ApiQuery({ name: 'targetId', required: false, format: 'uuid', type: String })
  @ApiResponse({ status: 200, type: ARPreviewResponseDto, headers: etagHeader() })
  async arReveal(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const query = this.arQuery(req.query);
    const view = await this.service.arReveal(this.id(id), query.version!, query.targetId, this.auth(req));
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Cookie');
    this.revision(res, 200, ARPreviewDataDto.from(view, this.id(id)));
  }

  @Get(':id/ar/reveal/content') @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'getProjectARRevealContent', summary: 'Stream the same pinned reveal with owner/project/version/target rechecks around private provider I/O.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'projectVersion', required: true, schema: { type: 'integer', minimum: 1 } })
  @ApiQuery({ name: 'targetId', required: false, format: 'uuid', type: String })
  @ApiHeader({ name: 'Range', required: false })
  @ApiResponse({ status: 200, content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 206, description: 'Verified single byte range.' })
  @ApiResponse({ status: 416, description: 'Unsatisfiable single byte range.' })
  async arRevealContent(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const query = this.arQuery(req.query);
    await streamPrivateMedia(req, res, signal => this.arContent.content(
      this.id(id), query.version!, query.targetId, this.auth(req),
      req.method === 'HEAD' ? 'HEAD' : 'GET', req.get('If-Range') ? undefined : req.get('Range'), signal,
    ));
  }

  @Get(':id/ar/targets/:targetId/artifact') @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'getProjectARTarget', summary: 'Download one current owner-authorized prepared target.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'targetId', format: 'uuid' })
  @ApiQuery({ name: 'projectVersion', required: false, schema: { type: 'integer', minimum: 1 }, description: 'Optional pinned preview revision; otherwise resolves the current target.' })
  @ApiResponse({ status: 200, content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } })
  @ApiHeader({ name: 'Range', required: false })
  @ApiResponse({ status: 206, description: 'Verified single byte range.' })
  @ApiResponse({ status: 416, description: 'Unsatisfiable single byte range.' })
  async arTarget(@Param('id') id: string, @Param('targetId') targetId: string, @Req() req: Request, @Res() res: Response) {
    const bytes = await this.service.arTarget(this.id(id), this.id(targetId).toLowerCase(), this.auth(req), this.arQuery(req.query, false).version);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.vary('Cookie');
    res.setHeader('Accept-Ranges', 'bytes');
    let selected;
    try {
      const range = req.method === 'HEAD' || req.get('If-Range') ? undefined : parseMediaRange(req.get('Range'));
      selected = range ? resolveMediaRange(range, bytes.byteLength) : undefined;
    } catch {
      res.setHeader('Content-Range', `bytes */${bytes.byteLength}`);
      res.status(416).end();
      return;
    }
    const body = selected ? bytes.subarray(selected.start, selected.end + 1) : bytes;
    if (selected) res.setHeader('Content-Range', `bytes ${selected.start}-${selected.end}/${bytes.byteLength}`);
    res.setHeader('Content-Length', body.byteLength);
    res.status(selected ? 206 : 200);
    if (req.method === 'HEAD') res.end();
    else res.send(Buffer.from(body));
  }

  private removed(res: Response, projectVersion: number) {
    res.setHeader('ETag', `"${projectVersion}"`);
    res.status(204).end();
  }

  @Put(':id/months/:number') @origin() @csrf() @preconditions() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'replaceProjectMonth', summary: 'Replace current Month content.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'number', schema: { type: 'integer', minimum: 1, maximum: 12 } })
  @ApiBody({ type: MonthPatchDto })
  @ApiResponse({ status: 200, type: MonthResponseDto, headers: etagHeader() })
  async replaceMonth(@Param('id') id: string, @Param('number') number: string, @Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const selected = /^\d+$/.test(number) ? Number(number) : NaN;
    const data = await this.service.replaceMonth(this.id(id), selected, body, req.get('If-Match'), this.auth(req));
    this.revision(res, 200, data);
  }

  @Get(':id/special-dates') @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'listProjectSpecialDates', summary: 'List the Project’s current Special Dates.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: SpecialDatesResponseDto, headers: etagHeader() })
  async specialDates(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    this.revision(res, 200, await this.service.specialDates(this.id(id), this.auth(req)));
  }

  @Post(':id/special-dates') @origin() @csrf() @preconditions() @intent() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'createProjectSpecialDate', summary: 'Add a Special Date.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: EventWriteDto })
  @ApiResponse({ status: 201, type: SpecialDateResponseDto, headers: etagHeader() })
  async createSpecialDate(@Param('id') id: string, @Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const data = await this.service.createSpecialDate(this.id(id), body, req.get('If-Match'), req.get('Idempotency-Key'), this.auth(req));
    this.revision(res, 201, data);
  }

  @Put(':id/special-dates/:eventId') @origin() @csrf() @preconditions() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'updateProjectSpecialDate', summary: 'Replace a current Special Date.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'eventId', format: 'uuid' })
  @ApiBody({ type: EventWriteDto })
  @ApiResponse({ status: 200, type: SpecialDateResponseDto, headers: etagHeader() })
  async updateSpecialDate(@Param('id') id: string, @Param('eventId') eventId: string, @Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const data = await this.service.updateSpecialDate(this.id(id), this.id(eventId), body, req.get('If-Match'), this.auth(req));
    this.revision(res, 200, data);
  }

  @Delete(':id/special-dates/:eventId') @origin() @csrf() @preconditions() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'deleteProjectSpecialDate', summary: 'Remove a current Special Date.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'eventId', format: 'uuid' })
  @ApiResponse({ status: 204, headers: etagHeader() })
  async deleteSpecialDate(@Param('id') id: string, @Param('eventId') eventId: string, @Req() req: Request, @Res() res: Response) {
    const version = await this.service.deleteSpecialDate(this.id(id), this.id(eventId), req.get('If-Match'), this.auth(req));
    this.removed(res, version);
  }

  @Put(':id/ar') @origin() @csrf() @preconditions() @intent() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'writeProjectAR', summary: 'Save one reveal configuration with preparation pending.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: ARWriteDto })
  @ApiResponse({ status: 200, type: ARConfigResponseDto, headers: etagHeader() })
  async writeAR(@Param('id') id: string, @Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const data = await this.service.saveAR(this.id(id), body, req.get('If-Match'), req.get('Idempotency-Key'), this.auth(req));
    this.revision(res, 200, data);
  }

  @Delete(':id/ar') @origin() @csrf() @preconditions() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'deleteProjectAR', summary: 'Remove the current reveal configuration.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, headers: etagHeader() })
  async deleteAR(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const version = await this.service.deleteAR(this.id(id), req.get('If-Match'), this.auth(req));
    this.removed(res, version);
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
