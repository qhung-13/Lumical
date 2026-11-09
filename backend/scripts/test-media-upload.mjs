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
const {
  MediaInspection,
} = require('../dist/modules/media/application/finalize-media.js');
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
    let inspections = 0;
    const verified = (binding, category = 'IMAGE') => ({
      kind: 'VERIFIED',
      facts: {
        object: {
          binding,
          storageKey: `${category === 'IMAGE' ? 'image' : 'video'}/authenticated/lumical/${binding.ownerId}/${binding.assetId}/${binding.uploadIntentId}`,
          contentVersion: '1794200000',
        },
        category,
        contentType: {
          IMAGE: 'image/png',
          VIDEO: 'video/mp4',
          AUDIO: 'audio/mpeg',
        }[category],
        bytes: 67,
        durationSeconds: category === 'IMAGE' ? null : 60,
        privateOriginal: true,
        privateDerivatives: true,
      },
    });
    let inspectResult = async (binding) => verified(binding);
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
      .overrideProvider(MediaInspection)
      .useValue({
        inspect: async (binding) => {
          inspections++;
          return inspectResult(binding);
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

      const finalize = (
        actor,
        id,
        key = randomUUID(),
        input = { uploadCompleted: true },
      ) =>
        api()
          .post(`/api/v1/media/${id}/finalize`)
          .set('Origin', origin)
          .set('Cookie', actor.cookie)
          .set('X-CSRF-Token', actor.csrf)
          .set('Idempotency-Key', key)
          .send(input);
      const fresh = async (category = 'IMAGE') =>
        (await upload(owner, randomUUID(), { ...body, category }).expect(201))
          .body.data.assetId;
      const finalId = await fresh();
      const finalKey = randomUUID();
      await finalize(other, finalId).expect(404);
      await finalize(other, randomUUID()).expect(404);
      await finalize(owner, finalId, finalKey, {
        uploadCompleted: true,
        verifiedBytes: 1,
      }).expect(422);
      await finalize({ ...owner, csrf: 'wrong' }, finalId).expect(403);
      assert.equal(
        inspections,
        0,
        'Access and input validation precede provider calls',
      );
      inspectResult = async () => ({ kind: 'PENDING' });
      const pending = await finalize(owner, finalId, finalKey)
        .expect(202)
        .expect('Cache-Control', 'no-store');
      assert.deepEqual(pending.body.data, {
        assetId: finalId,
        status: 'PENDING',
      });
      inspectResult = async () => ({ kind: 'UNAVAILABLE', retryable: true });
      await finalize(owner, finalId, finalKey).expect(503);
      assert.equal(
        (
          await db.query(
            'SELECT status FROM lumical.media_assets WHERE id=$1',
            [finalId],
          )
        ).rows[0].status,
        'PENDING',
      );
      inspectResult = async (binding) => verified(binding);
      const ready = await finalize(owner, finalId, finalKey).expect(200);
      assert.deepEqual(ready.body.data, {
        id: finalId,
        category: 'IMAGE',
        status: 'READY',
        verifiedBytes: 67,
      });
      const persisted = (
        await db.query('SELECT * FROM lumical.media_assets WHERE id=$1', [
          finalId,
        ])
      ).rows[0];
      assert.equal(persisted.content_version, 1794200000);
      assert.equal(persisted.content_type, 'image/png');
      assert.ok(persisted.verified_at);
      const oldInspections = inspections;
      assert.deepEqual(
        (await finalize(owner, finalId, finalKey).expect(200)).body,
        ready.body,
      );
      assert.equal(
        inspections,
        oldInspections,
        'Ready replay does not fetch a newer provider object',
      );
      await finalize(owner, await fresh(), finalKey).expect(409);
      assert.equal(
        JSON.stringify(ready.body).match(
          /ownerId|storageKey|storageReference|contentVersion|cloudinary|https:/,
        ),
        null,
      );

      // T23: all requests inspect concurrently, then serialize one readiness transition.
      const concurrentId = await fresh();
      let arrivals = 0;
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const timer = setTimeout(() => release(), 10000);
      inspectResult = async (binding) => {
        if (++arrivals === 4) release();
        await gate;
        return verified(binding);
      };
      try {
        const key = randomUUID();
        const results = await Promise.all(
          Array.from({ length: 4 }, () =>
            finalize(owner, concurrentId, key).expect(200),
          ),
        );
        for (const result of results)
          assert.deepEqual(result.body, results[0].body);
        assert.equal(arrivals, 4);
        assert.equal(
          (
            await db.query(
              "SELECT count(*) FROM lumical.idempotency_records WHERE operation='FINALIZE_MEDIA_UPLOAD' AND resource_id=$1",
              [concurrentId],
            )
          ).rows[0].count,
          '1',
        );
        const row = (
          await db.query('SELECT * FROM lumical.media_assets WHERE id=$1', [
            concurrentId,
          ])
        ).rows[0];
        assert.equal(row.content_version, 1794200000);
        assert.equal(row.verified_bytes, 67);
        assert.ok(row.verified_at);
      } finally {
        clearTimeout(timer);
      }

      // Different idempotency keys still finalize one immutable asset.
      inspectResult = async (binding) => verified(binding);
      const differentKeysId = await fresh();
      const differentKeys = await Promise.all(
        Array.from({ length: 3 }, () =>
          finalize(owner, differentKeysId).expect(200),
        ),
      );
      for (const result of differentKeys)
        assert.deepEqual(result.body, differentKeys[0].body);
      for (const category of ['VIDEO', 'AUDIO']) {
        inspectResult = async (binding) => verified(binding, category);
        const timed = await finalize(owner, await fresh(category)).expect(200);
        assert.equal(timed.body.data.category, category);
        assert.equal(timed.body.data.durationSeconds, 60);
      }
      const invalidCases = [
        (facts) => ({ ...facts, bytes: 10_000_001 }),
        (facts) => ({ ...facts, bytes: -1 }),
        (facts) => ({ ...facts, contentType: 'image/svg+xml' }),
        (facts) => ({ ...facts, privateOriginal: false }),
        (facts) => ({ ...facts, privateDerivatives: false }),
        (facts) => ({
          ...facts,
          object: {
            ...facts.object,
            binding: { ...facts.object.binding, ownerId: other.id },
          },
        }),
        (facts) => ({
          ...facts,
          object: { ...facts.object, contentVersion: 'bad' },
        }),
        (facts) => ({
          ...facts,
          category: 'VIDEO',
          contentType: 'video/mp4',
          durationSeconds: 61,
        }),
      ];
      for (const change of invalidCases) {
        const badId = await fresh();
        inspectResult = async (binding) => ({
          kind: 'VERIFIED',
          facts: change(verified(binding).facts),
        });
        const key = randomUUID();
        await finalize(owner, badId, key).expect(422);
        const row = (
          await db.query(
            'SELECT status,verified_at,storage_reference FROM lumical.media_assets WHERE id=$1',
            [badId],
          )
        ).rows[0];
        assert.deepEqual(row, {
          status: 'UNAVAILABLE',
          verified_at: null,
          storage_reference: null,
        });
        inspectResult = async (binding) => verified(binding);
        await finalize(owner, badId, key).expect(422);
      }
      const collisionId = await fresh();
      inspectResult = async () => ({ kind: 'REJECTED', reason: 'CONFLICT' });
      const collisionKey = randomUUID();
      await finalize(owner, collisionId, collisionKey).expect(409);
      await finalize(owner, collisionId, collisionKey).expect(409);
      for (const category of ['VIDEO', 'AUDIO']) {
        for (const patch of [
          { durationSeconds: 60.001 },
          { bytes: category === 'VIDEO' ? 100_000_001 : 20_000_001 },
        ]) {
          const badId = await fresh(category);
          inspectResult = async (binding) => ({
            kind: 'VERIFIED',
            facts: { ...verified(binding, category).facts, ...patch },
          });
          await finalize(owner, badId).expect(422);
          assert.equal(
            (
              await db.query(
                'SELECT status FROM lumical.media_assets WHERE id=$1',
                [badId],
              )
            ).rows[0].status,
            'UNAVAILABLE',
          );
        }
      }
      // A slow rejected inspection cannot demote a Ready result committed by another worker.
      const slowId = await fresh();
      let started;
      let resume;
      const slowStarted = new Promise((resolve) => {
        started = resolve;
      });
      const slowGate = new Promise((resolve) => {
        resume = resolve;
      });
      let worker = 0;
      inspectResult = async (binding) => {
        if (++worker === 1) {
          started();
          await slowGate;
          return { kind: 'REJECTED', reason: 'INVALID_CONTENT' };
        }
        return verified(binding);
      };
      const slow = finalize(owner, slowId).then((result) => result);
      const slowTimer = setTimeout(() => {
        started();
        resume();
      }, 10000);
      try {
        await slowStarted;
        const accepted = await finalize(owner, slowId).expect(200);
        resume();
        const late = await slow;
        assert.equal(late.status, 200);
        assert.deepEqual(late.body, accepted.body);
      } finally {
        resume();
        clearTimeout(slowTimer);
        await slow;
      }
      // The second authorization observes account disablement during external I/O.
      const disabledId = await fresh();
      inspectResult = async (binding) => {
        await db.query(
          "UPDATE lumical.users SET status='DISABLED' WHERE id=$1",
          [owner.id],
        );
        return verified(binding);
      };
      await finalize(owner, disabledId).expect(401);
      assert.equal(
        (
          await db.query(
            'SELECT status FROM lumical.media_assets WHERE id=$1',
            [disabledId],
          )
        ).rows[0].status,
        'PENDING',
      );
      await db.query("UPDATE lumical.users SET status='ACTIVE' WHERE id=$1", [
        owner.id,
      ]);
      console.log(
        'PASS: T23 trusted finalization, real-DB concurrent duplicate handling, limits, binding, immutable replay, provider uncertainty and account disable race.',
      );

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
