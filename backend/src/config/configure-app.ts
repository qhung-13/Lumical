import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { IdentityPolicy } from '../modules/identity/application/ports';
import { ApiErrors } from '../platform/http/api-errors';
import { openApiDocument } from '../platform/http/openapi';
import { SwaggerModule } from '@nestjs/swagger';
import { trustedProxy } from '../platform/http/client-address';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Request-Id', randomUUID());
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.useGlobalFilters(new ApiErrors());
  const policy = app.get(IdentityPolicy);
  app.getHttpAdapter().getInstance().set('trust proxy', trustedProxy(policy.trustedProxyIPs));
  app.enableCors({ origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, false);
    try { policy.assertOrigin(origin); callback(null, true); } catch { callback(null, false); }
  }, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key', 'If-Match'], exposedHeaders: ['ETag', 'X-Request-Id'] });
  SwaggerModule.setup('api/v1/openapi', app, openApiDocument(app), { ui: false, jsonDocumentUrl: 'api/v1/openapi.json' });
}
