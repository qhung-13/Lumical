import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { IdentityError } from '../../modules/identity/domain/identity';

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
    const status = error instanceof IdentityError ? error.status : oversized ? 413 : parseFailure ? 422 : error instanceof HttpException ? (error.getStatus() === 400 ? 422 : error.getStatus()) : 500;
    const code = error instanceof IdentityError ? error.code : status === 404 ? 'NOT_FOUND' : status === 413 || status === 422 ? 'VALIDATION_FAILED' : 'INTERNAL_ERROR';
    const requestId = String(response.getHeader('X-Request-Id'));
    if (status >= 500 || [401, 403, 409, 412, 429].includes(status)) this.logger.warn(JSON.stringify({ requestId, code, status }));
    response.status(status).json({ error: { code, messageKey: error instanceof IdentityError ? error.messageKey : status === 404 ? 'errors.notFound' : status === 413 || status === 422 ? 'errors.validation' : 'errors.unavailable',
      requestId, retryable: status >= 500 || status === 429,
      ...(error instanceof IdentityError && error.currentVersion ? { currentVersion: error.currentVersion } : {}),
      fieldErrors: error instanceof IdentityError && error.field ? [{ path: error.field, code: 'INVALID', messageKey: `validation.${error.field}` }] : [] } });
  }
}
