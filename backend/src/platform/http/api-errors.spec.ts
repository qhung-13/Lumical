import { Controller, Get, Param, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { request as httpRequest } from 'node:http';
import request from 'supertest';
import { ProjectError } from '../../modules/calendar-projects/domain/project';
import { ApiErrors } from './api-errors';

@Controller()
class ParserRegressionController {
  @Post('auth/register') register() { return { data: null }; }
  @Post('auth/login') login() { return { data: null }; }
  @Get('unrelated') unrelated() { throw new Error('TEST ONLY private error details'); }
  @Get('lookalike') lookalike() {
    throw Object.assign(new Error('TEST ONLY not a parser error'), { type: 'entity.too.large', status: 413, statusCode: 413 });
  }
}

@Controller()
class ProjectErrorController {
  // The transport decides status and message key; the domain only names the code.
  @Get('project/:code') project(@Param('code') code: string) {
    if (code === 'VERSION_CONFLICT') throw new ProjectError('VERSION_CONFLICT', undefined, 7);
    if (code === 'VALIDATION_FAILED') throw new ProjectError('VALIDATION_FAILED', 'title');
    throw new ProjectError(code as ProjectError['code']);
  }
}

describe('HTTP parser error boundary', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [ParserRegressionController] }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalFilters(new ApiErrors());
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => { await app.close(); });
  const oversized = JSON.stringify({ email: 'parser@example.invalid', password: 'TEST ONLY private oversized body ' + 'x'.repeat(120000) });
  it.each(['register', 'login'])('rejects oversized %s JSON with safe, non-retryable 413', async endpoint => {
    const response = await request(app.getHttpServer()).post(`/auth/${endpoint}`).set('Content-Type', 'application/json').send(oversized).expect(413);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED', messageKey: 'errors.validation', retryable: false, fieldErrors: [] });
    expect(Object.keys(response.body.error).sort()).toEqual(['code', 'fieldErrors', 'messageKey', 'requestId', 'retryable']);
    expect(JSON.stringify(response.body)).not.toMatch(/private oversized|entity\.too\.large|stack|limit/);
  });
  it('also recognizes the real streamed/chunked size-limit error', async () => {
    const port = (app.getHttpServer().address() as { port: number }).port;
    const result = await new Promise<{ status?: number; text: string }>((resolve, reject) => {
      const operation = httpRequest({ host: '127.0.0.1', port, path: '/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, response => {
        let text = ''; response.on('data', chunk => { text += String(chunk); });
        response.on('end', () => resolve({ status: response.statusCode, text }));
      });
      operation.on('error', reject); operation.write(oversized.slice(0, 60000)); operation.end(oversized.slice(60000));
    });
    expect(result.status).toBe(413);
    expect(JSON.parse(result.text).error).toMatchObject({ code: 'VALIDATION_FAILED', retryable: false });
  });
  it('keeps malformed JSON as the existing non-retryable 422', async () => {
    const response = await request(app.getHttpServer()).post('/auth/login').set('Content-Type', 'application/json').send('{"private":"TEST ONLY"').expect(422);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED', retryable: false });
  });
  it.each(['unrelated', 'lookalike'])('keeps %s exceptions as safe 500', async endpoint => {
    const response = await request(app.getHttpServer()).get(`/${endpoint}`).expect(500);
    expect(response.body.error).toMatchObject({ code: 'INTERNAL_ERROR', retryable: true });
    expect(JSON.stringify(response.body)).not.toContain('TEST ONLY');
  });
});

describe('Project error contract', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [ProjectErrorController] }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalFilters(new ApiErrors());
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => { await app.close(); });

  it.each([
    ['UNAUTHENTICATED', 401, 'errors.unauthenticated'],
    ['NOT_FOUND', 404, 'errors.notFound'],
    ['IDEMPOTENCY_CONFLICT', 409, 'errors.idempotencyConflict'],
    ['PROJECT_HAS_ORDERS', 409, 'errors.projectHasOrders'],
    ['INVALID_TRANSITION', 409, 'errors.invalidTransition'],
    ['TEMPLATE_UNAVAILABLE', 409, 'errors.templateUnavailable'],
    ['PRECONDITION_REQUIRED', 428, 'errors.preconditionRequired'],
  ])('maps %s to %i with %s', async (code, status, messageKey) => {
    const response = await request(app.getHttpServer()).get(`/project/${code}`).expect(status);
    expect(response.body.error).toMatchObject({ code, messageKey, retryable: false, fieldErrors: [] });
    expect(Object.keys(response.body.error).sort()).toEqual(['code', 'fieldErrors', 'messageKey', 'requestId', 'retryable']);
  });

  it('carries the safe current version on a 412 conflict', async () => {
    const response = await request(app.getHttpServer()).get('/project/VERSION_CONFLICT').expect(412);
    expect(response.body.error).toMatchObject({ code: 'VERSION_CONFLICT', messageKey: 'errors.versionConflict', currentVersion: 7, retryable: false });
    expect(Object.keys(response.body.error).sort()).toEqual(['code', 'currentVersion', 'fieldErrors', 'messageKey', 'requestId', 'retryable']);
  });

  it('names the offending field on a 422 validation failure', async () => {
    const response = await request(app.getHttpServer()).get('/project/VALIDATION_FAILED').expect(422);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED', messageKey: 'errors.validation', retryable: false });
    expect(response.body.error.fieldErrors).toEqual([{ path: 'title', code: 'INVALID', messageKey: 'validation.title' }]);
  });
});
