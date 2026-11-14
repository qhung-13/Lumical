import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { get as getHttp } from 'node:http';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import request from 'supertest';
import { withDisposablePostgres } from './disposable-postgres.mjs';
import { Clock } from '../dist/modules/identity/application/ports.js';

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
const {
  MediaContent,
} = require('../dist/modules/media/application/owner-media.js');
const {
  resolveMediaRange,
} = require('../dist/modules/media/application/media-range.js');
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
      MEDIA_UPLOAD_INTENTS_PER_10_MINUTES: '5',
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
    let fetches = 0;
    let fetchResult;
    let lastFetch;
    let now = new Date();
    const privateBytes = Buffer.alloc(67, 42);
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
      .overrideProvider(Clock)
      .useValue({ now: () => now })
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
      .overrideProvider(MediaContent)
      .useValue({
        fetch: async (input, signal) => {
          fetches++;
          lastFetch = input;
          if (fetchResult) return fetchResult(input, signal);
          const range = input.range
            ? resolveMediaRange(input.range, privateBytes.length)
            : undefined;
          const bytes = range
            ? privateBytes.subarray(range.start, range.end + 1)
            : privateBytes;
          return {
            kind: 'CONTENT',
            status: range ? 206 : 200,
            contentType: 'image/png',
            contentLength: bytes.length,
            totalBytes: privateBytes.length,
            ...(range ? { contentRange: range } : {}),
            ...(input.method === 'HEAD'
              ? {}
              : {
                  body: (async function* () {
                    yield bytes;
                  })(),
                }),
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
      const limited = await account('quota-owner@example.invalid');
      const firstKey = randomUUID();
      const firstIntent = await upload(limited, firstKey).expect(201);
      for (let count = 0; count < 3; count++) await upload(limited, randomUUID()).expect(201);
      const atQuotaBoundary = await Promise.all([upload(limited, randomUUID()), upload(limited, randomUUID())]);
      assert.deepEqual(atQuotaBoundary.map(result => result.status).sort(), [201, 429]);
      const blocked = atQuotaBoundary.find(result => result.status === 429);
      assert.equal(blocked.headers['retry-after'], '600');
      assert.equal(blocked.body.error.code, 'RATE_LIMITED');
      assert.equal(blocked.body.error.retryable, true);
      assert.equal((await db.query(
        'SELECT count(*) FROM lumical.media_assets WHERE owner_id=$1', [limited.id],
      )).rows[0].count, '5');
      assert.equal((await db.query(
        "SELECT count(*) FROM lumical.idempotency_records WHERE actor_id=$1 AND operation='INITIATE_MEDIA_UPLOAD'", [limited.id],
      )).rows[0].count, '5');
      const replayed = await upload(limited, firstKey).expect(201);
      assert.deepEqual(replayed.body, firstIntent.body);
      await upload(limited, firstKey, { ...body, declaredBytes: 68 }).expect(409);
      const callsAtLimit = calls;
      await upload(limited, randomUUID()).expect(429);
      assert.equal(calls, callsAtLimit, 'Quota denial must not authorize an upload at the provider');
      now = new Date(now.getTime() + 600_000);
      await upload(limited, randomUUID()).expect(201);
      calls = 0;

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
      const fresh = async (category = 'IMAGE') => {
        // This fixture tests independent finalization cases across successive windows.
        now = new Date(now.getTime() + 600_000);
        return (await upload(owner, randomUUID(), { ...body, category }).expect(201)).body.data.assetId;
      };
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

      const statusOf = (actor, id) =>
        api().get(`/api/v1/media/${id}`).set('Cookie', actor.cookie);
      const contentOf = (actor, id, method = 'get', range) => {
        const req = api()
          [method](`/api/v1/media/${id}/content`)
          .set('Cookie', actor.cookie);
        return range === undefined ? req : req.set('Range', range);
      };
      const status = await statusOf(owner, finalId)
        .expect(200)
        .expect('Cache-Control', 'private, no-store');
      assert.deepEqual(status.body.data, {
        ...ready.body.data,
        contentPath: `/api/v1/media/${finalId}/content`,
      });
      const pendingId = await fresh();
      assert.equal(
        (await statusOf(owner, pendingId).expect(200)).body.data.contentPath,
        undefined,
      );
      await contentOf(owner, pendingId).expect(409);
      const beforeDenied = fetches;
      await api().get(`/api/v1/media/${finalId}/content`).expect(401);
      await statusOf(other, finalId).expect(404);
      for (const method of ['get', 'head']) {
        await contentOf(other, finalId, method, 'bytes=0-1')
          .expect(404)
          .expect('Cache-Control', 'private, no-store');
        await contentOf(other, randomUUID(), method, 'bytes=0-1').expect(404);
        await contentOf(other, finalId, method, 'bytes=999-').expect(404);
      }
      assert.equal(
        fetches,
        beforeDenied,
        'GET/HEAD/range denial must precede storage access',
      );
      const original = await contentOf(owner, finalId)
        .expect(200)
        .expect('Content-Type', 'image/png')
        .expect('Content-Length', '67')
        .expect('Cache-Control', 'private, no-store')
        .expect('X-Content-Type-Options', 'nosniff')
        .expect('Accept-Ranges', 'bytes');
      assert.deepEqual(original.body, privateBytes);
      assert.equal(original.headers.location, undefined);
      assert.equal(original.headers.etag, undefined);
      assert.deepEqual(lastFetch.access, {
        kind: 'OWNER',
        actorId: owner.id,
        ownerId: owner.id,
      });
      for (const [range, start, end] of [
        ['Bytes=0-3', 0, 3],
        ['bytes=63-', 63, 66],
        ['bytes=-4', 63, 66],
        ['bytes=65-100', 65, 66],
        ['bytes=2-9007199254740992', 2, 66],
        ['bytes=-9007199254740992', 0, 66],
      ]) {
        const partial = await contentOf(owner, finalId, 'get', range)
          .expect(206)
          .expect('Content-Range', `bytes ${start}-${end}/67`)
          .expect('Content-Length', String(end - start + 1));
        assert.deepEqual(partial.body, privateBytes.subarray(start, end + 1));
      }
      const head = await contentOf(owner, finalId, 'head')
        .expect(200)
        .expect('Content-Length', '67');
      assert.equal(head.text, undefined);
      const rangedHead = await contentOf(owner, finalId, 'head', 'bytes=0-3')
        .expect(200)
        .expect('Content-Length', '67');
      assert.equal(rangedHead.headers['content-range'], undefined);
      assert.equal(rangedHead.text, undefined);
      const unknownRange = await contentOf(owner, finalId, 'get', 'items=0-3')
        .expect(200);
      assert.deepEqual(unknownRange.body, privateBytes);
      const beforeInvalidRange = fetches;
      await contentOf(owner, finalId, 'get', 'bytes=0-3')
        .set('If-Range', '"unknown-validator"')
        .expect(200)
        .expect('Content-Length', '67');
      const beforeMalformedRange = fetches;
      for (const range of [
        'bytes=67-',
        'bytes=0-1,3-4',
        'bytes=-0',
        'bytes=9007199254740992-',
        `bytes=0-${'9'.repeat(256)}`,
      ])
        await contentOf(owner, finalId, 'get', range)
          .expect(416)
          .expect('Content-Range', 'bytes */67');
      assert.equal(fetches, beforeMalformedRange);
      assert.equal(beforeMalformedRange, beforeInvalidRange + 1);
      fetchResult = async () => ({ kind: 'UNAVAILABLE', retryable: true });
      await contentOf(owner, finalId).expect(503);
      fetchResult = async () => ({ kind: 'NOT_FOUND' });
      await contentOf(owner, finalId).expect(409);
      fetchResult = async () => ({
        kind: 'CONTENT',
        status: 200,
        contentType: 'text/html',
        contentLength: 67,
        totalBytes: 67,
        body: (async function* () {
          yield privateBytes;
        })(),
      });
      await contentOf(owner, finalId).expect(503);
      fetchResult = async () => {
        await db.query(
          "UPDATE lumical.users SET status='DISABLED' WHERE id=$1",
          [owner.id],
        );
        return {
          kind: 'CONTENT',
          status: 200,
          contentType: 'image/png',
          contentLength: 67,
          totalBytes: 67,
          body: (async function* () {
            yield privateBytes;
          })(),
        };
      };
      await contentOf(owner, finalId).expect(401);
      await db.query("UPDATE lumical.users SET status='ACTIVE' WHERE id=$1", [
        owner.id,
      ]);
      fetchResult = undefined;
      // Logout revokes the same cookie for each new full/ranged/HEAD request.
      const revoked = await account('stream-revoked@example.invalid');
      const revokedId = (await upload(revoked, randomUUID()).expect(201)).body
        .data.assetId;
      await finalize(revoked, revokedId).expect(200);
      await api()
        .delete('/api/v1/auth/session')
        .set('Origin', origin)
        .set('Cookie', revoked.cookie)
        .set('X-CSRF-Token', revoked.csrf)
        .expect(204);
      const beforeRevoked = fetches;
      for (const method of ['get', 'head'])
        await contentOf(revoked, revokedId, method, 'bytes=0-1').expect(401);
      assert.equal(fetches, beforeRevoked);
      await app.listen(0, '127.0.0.1');
      const address = app.getHttpServer().address();
      const contentUrl = `http://127.0.0.1:${address.port}/api/v1/media/${finalId}/content`;
      const clientOptions = { headers: { Cookie: owner.cookie } };

      // Disconnect during the provider call, before Nest sends headers.
      let beforeHeaders;
      const providerCancelled = new Promise((resolve) => { beforeHeaders = resolve; });
      fetchResult = (_input, signal) => new Promise((resolve) => {
        signal.addEventListener('abort', () => {
          resolve({ kind: 'UNAVAILABLE', retryable: true });
          beforeHeaders();
        }, { once: true });
        waitingClient.destroy();
      });
      const waitingClient = getHttp(contentUrl, clientOptions, () => assert.fail('Unexpected response before disconnect'));
      waitingClient.on('error', () => {});
      let beforeHeadersTimeout;
      try {
        await Promise.race([providerCancelled, new Promise((_, reject) => {
          beforeHeadersTimeout = setTimeout(() => reject(new Error('Provider did not cancel before headers')), 5000);
        })]);
      } finally {
        clearTimeout(beforeHeadersTimeout);
        waitingClient.destroy();
      }

      // A client disconnect must abort upstream work and return its iterator.
      let abortSeen = false;
      let stopped;
      const upstreamStopped = new Promise((resolve) => {
        stopped = resolve;
      });
      fetchResult = async (_input, signal) => {
        const aborted = new Promise((resolve) =>
          signal.addEventListener(
            'abort',
            () => {
              abortSeen = true;
              resolve();
            },
            { once: true },
          ),
        );
        return {
          kind: 'CONTENT',
          status: 200,
          contentType: 'image/png',
          contentLength: 67,
          totalBytes: 67,
          body: (async function* () {
            try {
              yield privateBytes.subarray(0, 1);
              await aborted;
            } finally {
              stopped();
            }
          })(),
        };
      };
      const client = getHttp(
        contentUrl,
        clientOptions,
        (response) => {
          response.once('data', () => response.destroy());
          response.on('error', () => {});
        },
      );
      client.on('error', () => {});
      let abortTimeout;
      try {
        await Promise.race([
          upstreamStopped,
          new Promise((_, reject) => {
            abortTimeout = setTimeout(
              () => reject(new Error('Upstream did not stop after disconnect')),
              5000,
            );
          }),
        ]);
        assert.equal(abortSeen, true);
      } finally {
        clearTimeout(abortTimeout);
        client.destroy();
        fetchResult = undefined;
      }
      console.log(
        'PASS: P04 owner status and Supertest private GET/HEAD/ranges, no-store/nosniff, safe denial, provider validation and revocation.',
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

      // One Pending inspection returns stale facts after another key pins Ready.
      const competingId = await fresh();
      const competingKey = randomUUID();
      let enterCompeting;
      let releaseCompeting;
      const enteredCompeting = new Promise(resolve => { enterCompeting = resolve; });
      const competingBarrier = new Promise(resolve => { releaseCompeting = resolve; });
      inspectResult = async (binding) => {
        enterCompeting();
        await competingBarrier;
        const result = verified(binding);
        return { ...result, facts: { ...result.facts, object: { ...result.facts.object, contentVersion: '1794200001' } } };
      };
      const competing = finalize(owner, competingId, competingKey).then(result => result);
      try {
        await Promise.race([
          enteredCompeting,
          competing.then(result => { throw new Error(`Competing request stopped before inspection (${result.status})`); }),
        ]);
        inspectResult = async (binding) => verified(binding);
        await finalize(owner, competingId).expect(200);
      } finally {
        releaseCompeting();
      }
      assert.equal((await competing).status, 409);
      await finalize(owner, competingId, competingKey).expect(409);
      const conflictRecord = await db.query(
        "SELECT condition, safe_result FROM lumical.idempotency_records WHERE operation='FINALIZE_MEDIA_UPLOAD' AND resource_id=$1 AND key=$2",
        [competingId, competingKey],
      );
      assert.deepEqual(conflictRecord.rows, [{ condition: 'COMPLETED', safe_result: { error: 'CONFLICT' } }]);
      await finalize(owner, competingId).expect(200);

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
