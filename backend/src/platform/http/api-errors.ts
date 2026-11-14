import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ProjectError } from '../../modules/calendar-projects/domain/project';
import { IdentityError } from '../../modules/identity/domain/identity';
import { TemplateAdminError } from '../../modules/templates/domain/template-admin';

// ProjectError names only its code, so the transport owns the mapping to the
// status and stable message key of API contract §9.
const PROJECT_ERROR = {
  UNAUTHENTICATED: { status: 401, messageKey: 'errors.unauthenticated' },
  NOT_FOUND: { status: 404, messageKey: 'errors.notFound' },
  MEDIA_UNAVAILABLE: { status: 409, messageKey: 'errors.mediaUnavailable' },
  CONFLICT: { status: 409, messageKey: 'errors.conflict' },
  IDEMPOTENCY_CONFLICT: { status: 409, messageKey: 'errors.idempotencyConflict' },
  PROJECT_HAS_ORDERS: { status: 409, messageKey: 'errors.projectHasOrders' },
  INVALID_TRANSITION: { status: 409, messageKey: 'errors.invalidTransition' },
  TEMPLATE_UNAVAILABLE: { status: 409, messageKey: 'errors.templateUnavailable' },
  VERSION_CONFLICT: { status: 412, messageKey: 'errors.versionConflict' },
  VALIDATION_FAILED: { status: 422, messageKey: 'errors.validation' },
  PRECONDITION_REQUIRED: { status: 428, messageKey: 'errors.preconditionRequired' },
} as const satisfies Record<string, { status: number; messageKey: string }>;

@Catch()
export class ApiErrors implements ExceptionFilter {
  private readonly logger = new Logger('Api');
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    // Preserve frozen operational-health bodies and I00 compatibility.
    if (error instanceof HttpException) {
      const body = error.getResponse();
      if (body && typeof body === 'object' && 'ready' in body && body.ready === false) {
        response.status(error.getStatus()).json({ ready: false }); return;
      }
    }
    const parseFailure = error && typeof error === 'object' && 'type' in error && error.type === 'entity.parse.failed';
    const oversized = error instanceof Error && 'type' in error && error.type === 'entity.too.large' &&
      'status' in error && error.status === 413 && 'statusCode' in error && error.statusCode === 413 &&
      'limit' in error && typeof error.limit === 'number' && Number.isSafeInteger(error.limit) && error.limit > 0 &&
      (('length' in error && typeof error.length === 'number' && Number.isSafeInteger(error.length) && error.length > error.limit) ||
        ('received' in error && typeof error.received === 'number' && Number.isSafeInteger(error.received) && error.received > error.limit));
    // Both error vocabularies describe safe, non-retryable operational outcomes and must keep
    // their status instead of degrading to a 500.
    const project = error instanceof ProjectError ? error : undefined;
    const legacy = error instanceof IdentityError || error instanceof TemplateAdminError ? error : undefined;
    const managed = project ?? legacy;
    const status = project ? PROJECT_ERROR[project.code].status : legacy ? legacy.status : oversized ? 413 : parseFailure ? 422 : error instanceof HttpException ? (error.getStatus() === 400 ? 422 : error.getStatus()) : 500;
    const code = project ? project.code : legacy ? legacy.code : status === 404 ? 'NOT_FOUND' : status === 413 || status === 422 ? 'VALIDATION_FAILED' : 'INTERNAL_ERROR';
    const messageKey = project ? PROJECT_ERROR[project.code].messageKey : legacy ? legacy.messageKey : status === 404 ? 'errors.notFound' : status === 413 || status === 422 ? 'errors.validation' : 'errors.unavailable';
    const requestId = String(response.getHeader('X-Request-Id'));
    if (status >= 500 || [401, 403, 409, 412, 429].includes(status)) this.logger.warn(JSON.stringify({ requestId, code, status }));
    if (status === 429 && error instanceof IdentityError && error.retryAfterSeconds !== undefined)
      response.setHeader('Retry-After', String(error.retryAfterSeconds));
    response.status(status).json({ error: { code, messageKey,
      requestId, retryable: status >= 500 || status === 429,
      ...(managed?.currentVersion ? { currentVersion: managed.currentVersion } : {}),
      fieldErrors: managed?.field ? [{ path: managed.field, code: 'INVALID', messageKey: `validation.${managed.field}` }] : [] } });
  }
}
