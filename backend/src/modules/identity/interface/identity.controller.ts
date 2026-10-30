import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Req, Res, applyDecorators } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { IdentityService, type AuthResult, type BrowserContext } from '../application/identity-service';
import { IdentityPolicy } from '../application/ports';
import { accountCookie, invalid } from '../domain/identity';
import { AccountStatusChangeDto, AccountStatusResponseDto, AuthResponseDto, CredentialsDto, ErrorResponseDto, PrincipalResponseDto, SessionResponseDto } from './dto';

const errors = () => applyDecorators(...[401,403,404,409,412,413,422,428,429,500,503].map((status) => ApiResponse({ status, type: ErrorResponseDto })));
const origin = () => ApiHeader({ name: 'Origin', required: true, schema: { type: 'string' } });
const csrf = () => ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } });
const intent = () => ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{16,128}$' } });

@ApiTags('identity')
@Controller()
export class IdentityController {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService, @Inject(IdentityPolicy) private readonly policy: IdentityPolicy) {}
  private browser(req: Request, res: Response): BrowserContext {
    return { secret: accountCookie(req.headers.cookie, this.policy.cookieName), origin: req.get('Origin'),
      csrf: req.get('X-CSRF-Token'), ip: req.ip ?? req.socket.remoteAddress ?? 'unknown', requestId: String(res.getHeader('X-Request-Id')) };
  }
  private cookie(res: Response, secret: string | null, expiresAt?: Date): void {
    res.cookie(this.policy.cookieName, secret ?? '', { httpOnly: true, secure: this.policy.secure, sameSite: 'lax', path: '/',
      ...(secret ? { expires: expiresAt } : { expires: new Date(0), maxAge: 0 }) });
  }
  private auth(res: Response, result: AuthResult) {
    this.cookie(res, result.secret, result.cookieExpiresAt);
    return { data: { ...result.principal, csrfToken: result.csrfToken } };
  }
  private identifier(id: string): string {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) invalid();
    return id;
  }
  @Post('auth/register') @origin() @intent() @errors()
  @ApiOperation({ operationId: 'registerAccount' })
  @ApiBody({ type: CredentialsDto }) @ApiResponse({ status: 201, type: AuthResponseDto, headers: { 'Set-Cookie': { schema: { type: 'string' } } } })
  async register(@Body() body: CredentialsDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth(res, await this.identity.register(body, req.get('Idempotency-Key'), this.browser(req, res)));
  }
  @Post('auth/login') @HttpCode(200) @origin() @errors()
  @ApiOperation({ operationId: 'login' })
  @ApiBody({ type: CredentialsDto }) @ApiResponse({ status: 200, type: AuthResponseDto, headers: { 'Set-Cookie': { schema: { type: 'string' } } } })
  async login(@Body() body: CredentialsDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth(res, await this.identity.login(body, this.browser(req, res)));
  }
  @Get('auth/session') @errors()
  @ApiOperation({ operationId: 'bootstrapSession', security: [{}, { cookie: [] }] }) @ApiResponse({ status: 200, type: SessionResponseDto })
  async session(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return { data: await this.identity.bootstrap(this.browser(req, res)) };
  }
  @Delete('auth/session') @HttpCode(204) @origin() @csrf() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'logout' }) @ApiResponse({ status: 204, description: 'Current session revoked; cookie expired. Already logged out repeats require Origin only.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const body: unknown = req.body;
    if (body !== undefined && (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0)) invalid();
    await this.identity.logout(this.browser(req, res)); this.cookie(res, null);
  }
  @Get('account/me') @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'getOwnAccount' }) @ApiResponse({ status: 200, type: PrincipalResponseDto })
  async ownAccount(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return { data: await this.identity.ownAccount(this.browser(req, res)) };
  }
  @Get('admin/users/:id/account-status') @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'getAccountStatus' }) @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: AccountStatusResponseDto, headers: { ETag: { schema: { type: 'string' } } } })
  async accountStatus(@Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const data = await this.identity.accountStatus(this.identifier(id), this.browser(req, res));
    res.setHeader('ETag', `"${data.version}"`); return { data };
  }
  @Put('admin/users/:id/account-status') @origin() @csrf() @intent() @ApiCookieAuth() @errors()
  @ApiOperation({ operationId: 'changeAccountStatus' }) @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: AccountStatusChangeDto }) @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string' } })
  @ApiResponse({ status: 200, type: AccountStatusResponseDto, headers: { ETag: { schema: { type: 'string' } } } })
  async changeStatus(@Param('id') id: string, @Body() body: AccountStatusChangeDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const data = await this.identity.changeAccountStatus(this.identifier(id), body, req.get('Idempotency-Key'), req.get('If-Match'), this.browser(req, res));
    res.setHeader('ETag', `"${data.version}"`); return { data };
  }
}
