import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/config/configure-app';
import { DatabaseAvailability } from '../src/platform/database/application/database-availability';

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
