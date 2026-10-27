import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/config/configure-app';
import { DatabaseAvailability } from '../src/platform/database/application/database-availability';
import { TEMPLATE_CATALOG } from '../src/modules/templates/application/template-catalog';
import type { PublicTemplateRecord } from '../src/modules/templates/domain/template-catalog';

const publicRecord: PublicTemplateRecord = { id: '11111111-1111-4111-8111-111111111111', category: 'IMAGE', revision: {
  id: '22222222-2222-4222-8222-222222222222', templateId: '11111111-1111-4111-8111-111111111111', revision: 2,
  nameVi: 'Lịch A', nameEn: 'Calendar A', descriptionVi: 'Mô tả', descriptionEn: 'Description',
  layoutDefinition: { version: 1, monthCount: 12, imageSlotsPerMonth: 4 }, stylePresets: [{ id: 'classic', nameVi: 'Cổ điển', nameEn: 'Classic' }],
  unitPriceMinor: 1450n, currency: 'USD', publishedAt: new Date('2026-01-01T00:00:00Z'),
} };

describe('Health (e2e)', () => {
  let app: INestApplication<App>;
  let ready: boolean;

  beforeEach(async () => {
    ready = false;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseAvailability)
      .useValue({ isReady: () => Promise.resolve(ready) })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('GET /api/v1/health returns the service health', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok', service: 'lumical-backend' });
  });

  it('does not expose an unprefixed health endpoint', () => {
    return request(app.getHttpServer()).get('/health').expect(404);
  });

  it('liveness is independent of persistence', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect({ alive: true });
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503)
      .expect({ ready: false });
  });

  it('readiness uses the persistence port and has no private details', async () => {
    ready = true;
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect('Cache-Control', 'no-store')
      .expect(200)
      .expect({ ready: true });
  });

  afterEach(async () => {
    await app.close();
  });
});

describe('Public templates (e2e)', () => {
  let app: INestApplication<App>;
  const catalog = {
    list: jest.fn().mockResolvedValue([publicRecord]),
    find: jest.fn().mockResolvedValue(publicRecord),
  };

  beforeEach(async () => {
    catalog.list.mockClear(); catalog.find.mockClear();
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseAvailability).useValue({ isReady: () => Promise.resolve(true) })
      .overrideProvider(TEMPLATE_CATALOG).useValue(catalog).compile();
    app = moduleFixture.createNestApplication(); configureApp(app); await app.init();
  });

  it('returns explicit public DTO list and pagination envelope with safe integer money', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/templates?category=IMAGE&query=%20A%20').expect(200);
    expect(catalog.list).toHaveBeenCalledWith({ category: 'IMAGE', query: 'A', after: undefined, take: 21 });
    expect(response.body).toEqual({ data: [{ id: publicRecord.id, category: 'IMAGE', publishedRevision: expect.objectContaining({
      id: publicRecord.revision.id, version: 2, price: { currency: 'USD', unitPriceMinor: 1450 },
    }) }], meta: { nextCursor: null, hasMore: false } });
    expect(JSON.stringify(response.body)).not.toContain('templateId');
    expect(JSON.stringify(response.body)).not.toContain('layoutDefinition');
  });

  it('rejects invalid filters and limits, and rejects overlong input', async () => {
    await request(app.getHttpServer()).get('/api/v1/templates?category=DOCUMENT').expect(422);
    await request(app.getHttpServer()).get('/api/v1/templates?limit=51').expect(422);
    await request(app.getHttpServer()).get(`/api/v1/templates?query=${'x'.repeat(101)}`).expect(422);
    await request(app.getHttpServer()).get('/api/v1/templates?limit=50').expect(200);
    expect(catalog.list).toHaveBeenLastCalledWith({ category: undefined, query: undefined, after: undefined, take: 51 });
    await request(app.getHttpServer()).get('/api/v1/templates?query=%20%20').expect(200);
    expect(catalog.list).toHaveBeenLastCalledWith({ category: undefined, query: undefined, after: undefined, take: 21 });
    await request(app.getHttpServer()).get('/api/v1/templates?cursor=not-a-cursor').expect(422);
  });

  it('serves active detail and hides absent/inactive detail with 404', async () => {
    await request(app.getHttpServer()).get(`/api/v1/templates/${publicRecord.id}`).expect(200);
    catalog.find.mockResolvedValueOnce(null);
    await request(app.getHttpServer()).get('/api/v1/templates/33333333-3333-4333-8333-333333333333').expect(404);
  });

  afterEach(async () => { await app.close(); });
});
