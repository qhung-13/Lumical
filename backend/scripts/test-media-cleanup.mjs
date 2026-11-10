import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import request from 'supertest';
import { withDisposablePostgres } from './disposable-postgres.mjs';
import {
  mediaFixture,
  projectFixture,
  orderFixture,
} from '../test/database/fixtures.mjs';

const require = createRequire(import.meta.url);
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module.js');
const { configureApp } = require('../dist/config/configure-app.js');
const {
  MediaCleanup,
  MediaCleanupRepository,
  MediaPurge,
} = require('../dist/modules/media/application/media-cleanup.js');
const { Clock } = require('../dist/modules/identity/application/ports.js');
const {
  PrismaDatabase,
} = require('../dist/platform/database/infrastructure/prisma-database.js');
const {
  seedSynthetic,
  syntheticIds,
} = require('../dist/platform/database/infrastructure/synthetic-seed.js');
const backend = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env };
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
    const runtime = new pg.Client({
      connectionString: process.env.DATABASE_URL,
    });
    await runtime.connect();
    const now = new Date();
    let purgeCalls = 0;
    let purgeResult = { kind: 'UNAVAILABLE', retryable: true };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue({ now: () => now })
      .overrideProvider(MediaPurge)
      .useValue({
        purge: async () => {
          purgeCalls++;
          return purgeResult;
        },
      })
      .compile();
    const app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    const api = () => request(app.getHttpServer());
    const cleanup = app.get(MediaCleanup);
    const repository = app.get(MediaCleanupRepository);
    const signal = new AbortController().signal;
    const register = async (email) => {
      const response = await api()
        .post('/api/v1/auth/register')
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send({ email, password: 'TEST ONLY media cleanup passphrase' })
        .expect(201);
      return {
        id: response.body.data.id,
        cookie: response.headers['set-cookie'][0].split(';')[0],
        csrf: response.body.data.csrfToken,
      };
    };
    const remove = (actor, id) =>
      api()
        .delete(`/api/v1/media/${id}`)
        .set('Origin', origin)
        .set('Cookie', actor.cookie)
        .set('X-CSRF-Token', actor.csrf);
    const jobFor = async (id) =>
      (
        await db.query(
          'SELECT * FROM lumical.job_records WHERE operation_identity=$1',
          [`MEDIA_DELETE:${id}`],
        )
      ).rows[0];
    const due = (id) =>
      db.query('UPDATE lumical.job_records SET due_at=$2 WHERE object_id=$1', [
        id,
        now,
      ]);
    try {
      const owner = await register('cleanup-owner@example.invalid');
      const other = await register('cleanup-other@example.invalid');
      await seedSynthetic(app.get(PrismaDatabase));
      const project = await projectFixture(db, owner.id, syntheticIds.revision);
      const month = randomUUID();
      await db.query(
        'INSERT INTO lumical.calendar_months(id,project_id,month_number) VALUES($1,$2,1)',
        [month, project],
      );
      const attach = (client, id, position = 0) =>
        client.query(
          "INSERT INTO lumical.project_month_media(id,project_id,owner_id,month_id,asset_id,position,alt_text) VALUES($1,$2,$3,$4,$5,$6,'TEST ONLY')",
          [randomUUID(), project, owner.id, month, id, position],
        );
      const fresh = () => mediaFixture(db, owner.id, 'READY');

      const unused = await fresh();
      await remove(other, unused).expect(404);
      await remove(other, randomUUID()).expect(404);
      await remove({ ...owner, csrf: 'wrong' }, unused).expect(403);
      await api()
        .delete(`/api/v1/media/${unused}`)
        .set('Origin', origin)
        .expect(401);
      await remove(owner, unused)
        .expect(204)
        .expect('Cache-Control', 'private, no-store');
      await remove(owner, unused).expect(204);
      assert.equal(
        (
          await db.query(
            'SELECT status FROM lumical.media_assets WHERE id=$1',
            [unused],
          )
        ).rows[0].status,
        'UNAVAILABLE',
      );
      for (const method of ['get', 'head'])
        await api()
          [method](`/api/v1/media/${unused}/content`)
          .set('Cookie', owner.cookie)
          .set('Range', 'bytes=0-1')
          .expect(404);
      await api()
        .get(`/api/v1/media/${unused}`)
        .set('Cookie', owner.cookie)
        .expect(404);
      await api()
        .post(`/api/v1/media/${unused}/finalize`)
        .set('Origin', origin)
        .set('Cookie', owner.cookie)
        .set('X-CSRF-Token', owner.csrf)
        .set('Idempotency-Key', randomUUID())
        .send({ uploadCompleted: true })
        .expect(404);
      assert.ok(
        (await jobFor(unused)).due_at > now,
        'Wait for signed intake expiry before provider deletion',
      );
      await cleanup.runBatch(20, signal);
      assert.equal(purgeCalls, 0);
      await assert.rejects(attach(runtime, unused), { code: '23514' });
      await assert.rejects(
        runtime.query(
          "UPDATE lumical.media_assets SET status='READY' WHERE id=$1",
          [unused],
        ),
        { code: '23514' },
      );
      await assert.rejects(
        runtime.query(
          "INSERT INTO lumical.job_records(id,kind,object_id,operation_identity,condition,due_at,updated_at) VALUES($1,'MEDIA_PREPARE',$2,$3,'PENDING',now(),now())",
          [randomUUID(), unused, randomUUID()],
        ),
        { code: '23514' },
      );
      await due(unused);
      await cleanup.runBatch(20, signal);
      assert.equal((await jobFor(unused)).condition, 'PENDING');
      assert.equal(
        (await jobFor(unused)).safe_error_code,
        'PROVIDER_UNAVAILABLE',
      );
      await api()
        .get(`/api/v1/media/${unused}`)
        .set('Cookie', owner.cookie)
        .expect(404);
      const failedCalls = purgeCalls;
      await cleanup.runBatch(20, signal);
      assert.equal(purgeCalls, failedCalls, 'Respect durable backoff');
      purgeResult = { kind: 'DELETED' };
      await due(unused);
      await cleanup.runBatch(20, signal);
      assert.equal((await jobFor(unused)).condition, 'COMPLETED');
      await remove(owner, unused).expect(204);

      const current = await fresh();
      await attach(runtime, current);
      await remove(owner, current).expect(409);
      assert.equal(await jobFor(current), undefined);
      const order = await orderFixture(db, project, owner.id);
      const version = randomUUID();
      await db.query(
        "INSERT INTO lumical.order_calendar_versions(id,order_id,owner_id,project_id,source_project_revision,year,title,dedication,template_revision_id,template_name_vi,template_name_en,style_definition) VALUES($1,$2,$3,$4,1,2027,'TEST ONLY','Synthetic',$5,'Synthetic','Synthetic','{}')",
        [version, order, owner.id, project, syntheticIds.revision],
      );
      await db.query(
        "INSERT INTO lumical.order_media_references(id,version_id,owner_id,project_id,asset_id,purpose,accessible_text) VALUES($1,$2,$3,$4,$5,'AR_REVEAL','TEST ONLY')",
        [randomUUID(), version, owner.id, project, current],
      );
      await runtime.query(
        'DELETE FROM lumical.project_month_media WHERE asset_id=$1',
        [current],
      );
      assert.deepEqual((await remove(owner, current).expect(200)).body, {
        data: { retainedForHistory: true },
      });
      assert.equal(await jobFor(current), undefined);
      await api()
        .get(`/api/v1/media/${current}`)
        .set('Cookie', owner.cookie)
        .expect(404);
      assert.deepEqual((await remove(owner, current).expect(200)).body, {
        data: { retainedForHistory: true },
      });
      assert.equal(
        (
          await db.query(
            'SELECT status FROM lumical.media_assets WHERE id=$1',
            [current],
          )
        ).rows[0].status,
        'READY',
      );
      const inFlight = await fresh();
      await runtime.query(
        "INSERT INTO lumical.job_records(id,kind,object_id,operation_identity,condition,due_at,updated_at) VALUES($1,'MEDIA_PREPARE',$2,$3,'RUNNING',now(),now())",
        [randomUUID(), inFlight, randomUUID()],
      );
      await remove(owner, inFlight).expect(409);

      // T26: the reference wins a real DB race by holding the coordinated asset lock.
      const racer = await fresh();
      await runtime.query('BEGIN');
      await attach(runtime, racer, 1);
      const deletion = remove(owner, racer).then((response) => response);
      const blockingPid = (
        await runtime.query('SELECT pg_backend_pid() AS pid')
      ).rows[0].pid;
      let blocked = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const result = await db.query(
          'SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS blocked',
          [blockingPid],
        );
        if (result.rows[0].blocked) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await runtime.query('COMMIT');
      assert.equal((await deletion).status, 409);
      assert.equal(blocked, true);
      assert.equal(await jobFor(racer), undefined);

      const recover = await fresh();
      await remove(owner, recover).expect(204);
      await due(recover);
      const claims = await Promise.all([
        repository.claim(now),
        repository.claim(now),
      ]);
      assert.equal(
        claims.filter(Boolean).length,
        1,
        'Concurrent workers acquire only one lease',
      );
      const firstClaim = claims.find(Boolean);
      assert.ok(firstClaim);
      assert.equal(
        await repository.claim(now),
        null,
        'Only one lease may own an active cleanup',
      );
      await db.query(
        'UPDATE lumical.job_records SET lease_until=$2 WHERE id=$1',
        [firstClaim.id, new Date(now.getTime() - 1)],
      );
      const recovered = await repository.claim(now);
      assert.ok(recovered);
      assert.notEqual(recovered.token, firstClaim.token);
      await repository.finish(firstClaim, 'DELETED', now);
      assert.equal((await jobFor(recover)).condition, 'RUNNING');
      await repository.finish(recovered, 'DELETED', now);
      assert.equal((await jobFor(recover)).condition, 'COMPLETED');

      const exhausted = await fresh();
      await remove(owner, exhausted).expect(204);
      purgeResult = { kind: 'UNAVAILABLE', retryable: true };
      for (let i = 0; i < 5; i++) {
        await due(exhausted);
        await cleanup.runBatch(20, signal);
      }
      assert.equal((await jobFor(exhausted)).condition, 'FAILED');
      assert.equal((await jobFor(exhausted)).attempts, 5);
      await api()
        .get(`/api/v1/media/${exhausted}`)
        .set('Cookie', owner.cookie)
        .expect(404);

      const orphan = await mediaFixture(db, owner.id, 'PENDING');
      await db.query(
        'UPDATE lumical.media_assets SET created_at=$2 WHERE id=$1',
        [orphan, new Date(now.getTime() - 2 * 86_400_000)],
      );
      purgeResult = { kind: 'DELETED' };
      await cleanup.runBatch(20, signal);
      assert.equal((await jobFor(orphan)).condition, 'COMPLETED');
      assert.equal(
        (
          await db.query(
            'SELECT status FROM lumical.media_assets WHERE id=$1',
            [current],
          )
        ).rows[0].status,
        'READY',
      );
      console.log(
        'PASS: T24/T26 real-DB/API history retention, current refs/jobs, reference race, durable retry/lease fencing/exhaustion, orphan cleanup and immediate revocation.',
      );
      await promisify(execFile)(
        process.execPath,
        ['dist/worker.js', '--once'],
        { cwd: backend, env: { ...process.env }, timeout: 10000 },
      );
      console.log(
        'PASS: same-build worker CLI runs one bounded pass and exits.',
      );
    } finally {
      await runtime.query('ROLLBACK');
      await app.close();
      await runtime.end();
      await db.end();
    }
  });
} finally {
  process.env = env;
}
