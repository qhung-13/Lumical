import { Controller, Get, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { request as httpRequest } from 'node:http';
import request from 'supertest';
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
