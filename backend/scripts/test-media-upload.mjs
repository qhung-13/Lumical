import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import request from 'supertest';
import { withDisposablePostgres } from './disposable-postgres.mjs';

const require = createRequire(import.meta.url);
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module.js');
const { configureApp } = require('../dist/config/configure-app.js');
const {
  UploadAuthorization,
} = require('../dist/modules/media/application/upload-intake.js');
const backend = fileURLToPath(new URL('..', import.meta.url));
const originalEnv = { ...process.env };
const origin = 'https://lumical.test';
try {
  await withDisposablePostgres(async ({ url }) => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      IDENTITY_COOKIE_MODE: 'https',
      IDENTITY_SECRET_KEY: randomBytes(32).toString('hex'),
      IDENTITY_ALLOWED_ORIGINS: origin,
      IDENTITY_AUTH_ATTEMPTS: '1000',
      IDENTITY_TRUSTED_PROXY_IPS: '',
      DATABASE_URL: url('runtime', 'lumical_i01_blank'),
    });
    await promisify(execFile)(
      process.execPath,
      ['scripts/prisma.mjs', 'migrate', 'deploy'],
      {
        cwd: backend,
        env: {
          ...process.env,
          MIGRATION_DATABASE_URL: url('migration', 'lumical_i01_blank'),
        },
      },
    );
    const db = new pg.Client({
      connectionString: url('migration', 'lumical_i01_blank'),
    });
    await db.connect();
    let failing = false;
    let calls = 0;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UploadAuthorization)
      .useValue({
        authorizeUpload: async (input) => {
          calls++;
          if (failing) return { kind: 'UNAVAILABLE', retryable: true };
          return {
            kind: 'AUTHORIZED',
            intent: {
              ...input,
              uploadEndpoint: 'https://upload.invalid',
              fields: { signature: 'synthetic', overwrite: 'false' },
            },
          };
        },
      })
      .compile();
    const app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    const api = () => request(app.getHttpServer());
    const account = async (email) => {
      const auth = await api()
        .post('/api/v1/auth/register')
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send({ email, password: 'TEST ONLY strong passphrase 123' })
        .expect(201);
      return {
        cookie: auth.headers['set-cookie'][0].split(';')[0],
        csrf: auth.body.data.csrfToken,
        id: auth.body.data.id,
      };
    };
    const body = {
      category: 'IMAGE',
      fileName: 'synthetic.png',
      declaredBytes: 67,
    };
    const upload = (actor, key, input = body) =>
      api()
        .post('/api/v1/media/uploads')
        .set('Origin', origin)
        .set('Cookie', actor.cookie)
        .set('X-CSRF-Token', actor.csrf)
        .set('Idempotency-Key', key)
        .send(input);
    try {
      const owner = await account('upload-owner@example.invalid');
      const other = await account('upload-other@example.invalid');
      await api()
        .post('/api/v1/media/uploads')
        .set('Origin', origin)
        .send(body)
        .expect(401);
      await upload({ ...owner, csrf: 'wrong' }, randomUUID()).expect(403);
      await upload(owner, randomUUID(), { ...body, ownerId: other.id }).expect(
        422,
      );
      await upload(owner, randomUUID(), {
        ...body,
        declaredBytes: 10_000_001,
      }).expect(422);
      assert.equal(calls, 0);
      const key = randomUUID();
      const first = await upload(owner, key)
        .expect(201)
        .expect('Cache-Control', 'no-store');
      const repeated = await Promise.all(
        Array.from({ length: 4 }, () => upload(owner, key).expect(201)),
      );
      for (const result of repeated) assert.deepEqual(result.body, first.body);
      const assetId = first.body.data.assetId;
      const asset = (
        await db.query('SELECT * FROM lumical.media_assets WHERE id=$1', [
          assetId,
        ])
      ).rows[0];
      assert.equal(asset.owner_id, owner.id);
      assert.equal(asset.status, 'PENDING');
      assert.equal(asset.verified_bytes, null);
      await upload(owner, key, { ...body, declaredBytes: 68 }).expect(409);
      const separate = await upload(other, key).expect(201);
      assert.notEqual(separate.body.data.assetId, assetId);
      await db.query(
        "UPDATE lumical.media_assets SET status='READY', storage_reference=$2, verified_bytes=67, content_type='image/png', verified_at=now() WHERE id=$1",
        [assetId, `synthetic/${assetId}`],
      );
      const readyCalls = calls;
      await upload(owner, key).expect(409);
      assert.equal(
        calls,
        readyCalls,
        'Ready objects cannot receive another upload signature',
      );
      // Concurrent first use: transaction/uniqueness retries leave exactly one asset.
      const concurrentKey = randomUUID();
      const concurrent = await Promise.all(
        Array.from({ length: 4 }, () =>
          upload(owner, concurrentKey).expect(201),
        ),
      );
      assert.equal(
        new Set(concurrent.map((result) => result.body.data.assetId)).size,
        1,
      );
      assert.equal(
        (
          await db.query(
            'SELECT count(*) FROM lumical.media_assets WHERE owner_id=$1',
            [owner.id],
          )
        ).rows[0].count,
        '2',
      );
      failing = true;
      const retryKey = randomUUID();
      await upload(owner, retryKey).expect(503);
      const failed = (
        await db.query(
          'SELECT resource_id FROM lumical.idempotency_records WHERE actor_id=$1 AND key=$2',
          [owner.id, retryKey],
        )
      ).rows[0];
      failing = false;
      const retried = await upload(owner, retryKey).expect(201);
      assert.equal(retried.body.data.assetId, failed.resource_id);
      await db.query(
        "UPDATE lumical.media_assets SET created_at=created_at-interval '2 hours' WHERE id=$1",
        [failed.resource_id],
      );
      await upload(owner, retryKey).expect(409);
      await db.query("UPDATE lumical.users SET status='DISABLED' WHERE id=$1", [
        owner.id,
      ]);
      const previousCalls = calls;
      await upload(owner, key).expect(401);
      assert.equal(calls, previousCalls);
      console.log(
        'PASS: media upload API ownership/CSRF/limits, changed intent, replay/concurrency, provider retry and expiry (real DB, fake provider).',
      );
    } finally {
      await app.close();
      await db.end();
    }
  });
} finally {
  process.env = originalEnv;
}
