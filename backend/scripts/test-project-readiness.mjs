// TEST ONLY: real PostgreSQL and real Nest composition. Synthetic artifact rows
// exercise fail-closed policy; they are never genuine preparation acceptance.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import request from 'supertest';
import { withDisposablePostgres } from './disposable-postgres.mjs';
import {
  mediaFixture,
  orderFixture,
  projectFixture,
} from '../test/database/fixtures.mjs';

const require = createRequire(import.meta.url);
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module.js');
const { configureApp } = require('../dist/config/configure-app.js');
const { Clock } = require('../dist/modules/identity/application/ports.js');
const {
  MediaContent,
} = require('../dist/modules/media/application/owner-media.js');
const {
  PrepareTarget,
  PreparationJobs,
} = require('../dist/modules/calendar-projects/application/prepare-target.js');
const {
  ProjectOwnerService,
} = require('../dist/modules/calendar-projects/application/project-owner.js');
const {
  ProjectRepository,
} = require('../dist/modules/calendar-projects/application/project-repository.js');
const {
  ReadinessRepository,
} = require('../dist/modules/calendar-projects/application/readiness-repository.js');
const {
  PrismaDatabase,
} = require('../dist/platform/database/infrastructure/prisma-database.js');
const {
  Transactions,
} = require('../dist/platform/database/application/transactions.js');
const {
  seedSynthetic,
  syntheticIds,
} = require('../dist/platform/database/infrastructure/synthetic-seed.js');
const backend = fileURLToPath(new URL('..', import.meta.url));
const origin = 'https://lumical.test';
const now = new Date('2026-11-23T00:00:00Z');
async function check(name, work) {
  await work();
  console.log(`PASS: ${name}`);
}
async function connect(connectionString) {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 2000,
  });
  await client.connect();
  return client;
}
function barrier() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

await withDisposablePostgres(async ({ url }) => {
  Object.assign(process.env, {
    NODE_ENV: 'production',
    IDENTITY_COOKIE_MODE: 'https',
    IDENTITY_SECRET_KEY: randomBytes(32).toString('hex'),
    IDENTITY_ALLOWED_ORIGINS: origin,
    IDENTITY_AUTH_ATTEMPTS: '1000',
    IDENTITY_TRUSTED_PROXY_IPS: '',
    DATABASE_URL: url('runtime', 'lumical_i01_blank'),
    MIGRATION_DATABASE_URL: url('migration', 'lumical_i01_blank'),
  });
  await promisify(execFile)(
    process.execPath,
    ['scripts/prisma.mjs', 'migrate', 'deploy'],
    { cwd: backend },
  );
  const db = await connect(process.env.DATABASE_URL);
  const targetImage = await readFile(
    new URL('../../spikes/ar/fixtures/targets/version-a.png', import.meta.url),
  );
  let fetchBarrier;
  let failFetch = false;
  let app;
  try {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue({ now: () => now })
      .overrideProvider(MediaContent)
      .useValue({
        async fetch() {
          if (failFetch) return { kind: 'UNAVAILABLE', retryable: true };
          if (fetchBarrier) {
            fetchBarrier.entered.release();
            await fetchBarrier.resume.promise;
          }
          return {
            kind: 'CONTENT',
            status: 200,
            contentType: 'image/png',
            contentLength: targetImage.length,
            totalBytes: targetImage.length,
            body: [targetImage],
          };
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    await seedSynthetic(app.get(PrismaDatabase));
    const api = request(app.getHttpServer());
    const register = async (name) => {
      const response = await api
        .post('/api/v1/auth/register')
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send({
          email: `${name}@example.invalid`,
          password: 'TEST ONLY memory passphrase',
        })
        .expect(201);
      const cookie = response.headers['set-cookie'][0].split(';')[0];
      return {
        id: response.body.data.id,
        csrf: response.body.data.csrfToken,
        cookie,
        browser: { secret: cookie.slice(cookie.indexOf('=') + 1) },
      };
    };
    const owner = await register('readiness-owner');
    const other = await register('readiness-other');
    const project = await projectFixture(db, owner.id, syntheticIds.revision, {
      nameVi: 'Mẫu', nameEn: 'Synthetic', presetId: 'synthetic-neutral', unitPriceMinor: 1450,
      style: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 },
    });
    await db.query(
      `INSERT INTO lumical.calendar_months (id,project_id,month_number)
      SELECT gen_random_uuid(),$1,n FROM generate_series(1,12) n`,
      [project],
    );
    const service = app.get(ProjectOwnerService);
    const repository = app.get(ProjectRepository);
    const readiness = app.get(ReadinessRepository);
    const transactions = app.get(Transactions);
    const evaluate = () => service.readiness(project, owner.browser);
    const base = `/api/v1/projects/${project}`;

    await check(
      'DB01: twelve empty Months/zero dates are previewable at saved revision 1',
      async () => {
        const result = await evaluate();
        assert.equal(result.projectVersion, 1);
        assert.equal(result.preview.ready, true);
        assert.equal(result.ar.ready, false);
        assert.equal(result.finalization.ready, false);
        assert.deepEqual(result.ar.issues, ['AR_NOT_CONFIGURED']);
        assert.deepEqual(await evaluate(), result);
      },
    );
    await check(
      'DB02: real active-session query safely denies foreign/missing/anonymous/disabled reads',
      async () => {
        for (const [id, browser, code] of [
          [project, other.browser, 'NOT_FOUND'],
          [randomUUID(), owner.browser, 'NOT_FOUND'],
          [project, {}, 'UNAUTHENTICATED'],
        ])
          await assert.rejects(
            service.readiness(id, browser),
            (error) => error.code === code,
          );
        await db.query(
          "UPDATE lumical.users SET status='DISABLED' WHERE id=$1",
          [other.id],
        );
        await assert.rejects(
          service.readiness(project, other.browser),
          (error) => error.code === 'UNAUTHENTICATED',
        );
      },
    );
    await check(
      'API01: existing owner reads remain private/no-store and cross-owner reads stay 404',
      async () => {
        const response = await api
          .get(`${base}/ar/config`)
          .set('Cookie', owner.cookie)
          .expect(200);
        assert.match(response.headers['cache-control'], /no-store/);
        assert.deepEqual(response.body.data, {
          config: null,
          projectVersion: 1,
        });
        await api
          .get(`${base}/ar/config`)
          .set('Cookie', other.cookie)
          .expect(401);
        const third = await register('readiness-third');
        const preview = await api
          .get(`${base}/preview`)
          .set('Cookie', owner.cookie);
        assert.equal(preview.status, 200, JSON.stringify(preview.body));
        assert.match(preview.headers['cache-control'], /private/);
        assert.match(preview.headers['cache-control'], /no-store/);
        assert.equal(preview.headers.etag, '"1"');
        assert.equal(preview.body.data.projectVersion, 1);
        assert.equal(preview.body.data.project.version, 1);
        assert.equal(preview.body.data.months.length, 12);
        assert.deepEqual(preview.body.data.months.map((month) => month.monthNumber), Array.from({ length: 12 }, (_, index) => index + 1));
        assert(preview.body.data.months.every((month) => month.images.length === 0 && month.caption === null));
        assert.deepEqual(preview.body.data.specialDates, []);
        assert.deepEqual(preview.body.data.readiness, {
          previewReady: true,
          arReady: false,
          orderReady: false,
          issues: { preview: [], ar: ['AR_SETUP_REQUIRED'], order: ['CALENDAR_IMAGE_REQUIRED', 'AR_REQUIREMENTS_INCOMPLETE', 'PROJECT_REVIEW_REQUIRED'] },
        });
        assert.equal(JSON.stringify(preview.body).includes('AR_NOT_CONFIGURED'), false);
        assert.equal(JSON.stringify(preview.body).includes('FINALIZATION_'), false);
        await api
          .get(`${base}/preview`)
          .set('Cookie', third.cookie)
          .expect(404);
        await api
          .get(`/api/v1/projects/${randomUUID()}/preview`)
          .set('Cookie', owner.cookie)
          .expect(404);
        await api
          .get(`${base}/ar/config`)
          .set('Cookie', third.cookie)
          .expect(404);
        await api
          .get(`/api/v1/projects/${randomUUID()}/ar/config`)
          .set('Cookie', owner.cookie)
          .expect(404);
        // Readiness remains an internal P01 query; only mapped issues are public on Preview.
        await api
          .get(`${base}/readiness`)
          .set('Cookie', owner.cookie)
          .expect(404);
      },
    );

    const image = await mediaFixture(db, owner.id, 'READY');
    await api
      .put(`${base}/months/1`)
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .set('X-CSRF-Token', owner.csrf)
      .set('If-Match', '"1"')
      .send({ images: [{ assetId: image, altText: 'A family photograph' }] })
      .expect(200);
    const writeAR = (version) =>
      api
        .put(`${base}/ar`)
        .set('Cookie', owner.cookie)
        .set('Origin', origin)
        .set('X-CSRF-Token', owner.csrf)
        .set('If-Match', `"${version}"`)
        .set('Idempotency-Key', randomUUID())
        .send({
          monthNumber: 1,
          revealAssetId: image,
          readableText: 'A meaningful memory',
        })
        .expect(200);
    await writeAR(2);
    await check(
      'DB03: one owned Ready image satisfies image gate; actual I07 write is pending, never AR Ready',
      async () => {
        const result = await evaluate();
        assert.equal(result.projectVersion, 3);
        assert.equal(
          result.finalization.issues.includes(
            'FINALIZATION_PERSONAL_IMAGE_REQUIRED',
          ),
          false,
        );
        assert.equal(result.ar.preparation, 'PENDING');
        assert.equal(result.ar.ready, false);
      },
    );
    const artifact = randomUUID();
    await db.query(
      `INSERT INTO lumical.ar_target_artifacts
      (id,project_id,owner_id,source_revision,target_id,status,artifact_reference,prepared_at,adapter_metadata)
      VALUES($1,$2,$3,3,$4,'READY',$5,now(),'{"testOnly":true,"mockSuccess":true}')`,
      [artifact, project, owner.id, randomUUID(), `test-only:${artifact}`],
    );
    await db.query(
      `UPDATE lumical.project_ar_experiences SET preparation_status='READY',target_artifact_id=$2 WHERE project_id=$1`,
      [project, artifact],
    );
    await check(
      'DB04: READY artifact row/reference/timestamp/mock metadata is unverified, not genuine proof',
      async () => {
        const result = await evaluate();
        assert.equal(result.ar.preparation, 'UNVERIFIED');
        assert.equal(result.ar.ready, false);
        assert.equal(result.finalization.ready, false);
        assert(result.ar.issues.includes('AR_PREPARATION_UNVERIFIED'));
        assert(
          result.finalization.issues.includes('FINALIZATION_REVIEW_REQUIRED'),
        );
        assert.doesNotMatch(
          JSON.stringify(result),
          /test-only|mockSuccess|artifactReference|readableText|ownerId|targetId/,
        );
      },
    );
    await check(
      'DB05: AR Unavailable/missing artifact are explicit negative preparation states',
      async () => {
        await db.query(
          "UPDATE lumical.project_ar_experiences SET preparation_status='UNAVAILABLE' WHERE project_id=$1",
          [project],
        );
        assert.equal((await evaluate()).ar.preparation, 'UNAVAILABLE');
        await db.query(
          "UPDATE lumical.project_ar_experiences SET preparation_status='READY',target_artifact_id=NULL WHERE project_id=$1",
          [project],
        );
        assert.equal((await evaluate()).ar.preparation, 'MISSING');
        await db.query(
          'UPDATE lumical.project_ar_experiences SET target_artifact_id=$2 WHERE project_id=$1',
          [project, artifact],
        );
      },
    );

    // All content tables used by the query plus jobs/history. Auth may refresh
    // session activity under the established Identity contract; content cannot change.
    const fingerprint = async () =>
      (
        await db.query(
          `SELECT jsonb_build_object(
      'project',(SELECT to_jsonb(p) FROM lumical.calendar_projects p WHERE id=$1),
      'months',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM lumical.calendar_months m WHERE project_id=$1),
      'images',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM lumical.project_month_media m WHERE project_id=$1),
      'dates',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM lumical.special_dates d WHERE project_id=$1),
      'ar',(SELECT to_jsonb(a) FROM lumical.project_ar_experiences a WHERE project_id=$1),
      'targets',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM lumical.ar_target_artifacts t WHERE project_id=$1),
      'media',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM lumical.media_assets m WHERE owner_id=$2),
      'jobs',(SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM lumical.job_records j)
    ) AS facts`,
          [project, owner.id],
        )
      ).rows[0].facts;
    await check(
      'DB06: repeated query leaves all Project/media/AR/artifact/job content unchanged',
      async () => {
        const before = await fingerprint();
        await evaluate();
        await evaluate();
        assert.deepEqual(await fingerprint(), before);
      },
    );
    await check(
      'DB07: existing Order and Payment-attempt state cannot change Project readiness',
      async () => {
        const before = await evaluate();
        const order = await orderFixture(db, project, owner.id);
        const attempt = randomUUID();
        await db.query(
          `INSERT INTO lumical.payment_attempts (id,order_id,status,provider,environment,updated_at)
        VALUES($1,$2,'INITIATED','PAYPAL','SANDBOX',now())`,
          [attempt, order],
        );
        assert.deepEqual(await evaluate(), before);
        await db.query(
          "UPDATE lumical.payment_attempts SET status='FAILED',updated_at=now() WHERE id=$1",
          [attempt],
        );
        assert.deepEqual(await evaluate(), before);
      },
    );

    await check(
      'DB08: barrier edit between root and children reads cannot mix N with N+1',
      async () => {
        const entered = barrier();
        const resume = barrier();
        const original = readiness.read.bind(readiness);
        let first = true;
        readiness.read = async (...args) => {
          if (first) {
            first = false;
            entered.release();
            await resume.promise;
          }
          return original(...args);
        };
        const reading = evaluate();
        try {
          await Promise.race([
            entered.promise,
            reading.then(() => {
              throw new Error('Readiness query completed before the barrier.');
            }),
          ]);
          // Actual I07 root/child repository path in a separate serializable tx;
          // bypass only Identity's same-account lock to force an observable interleave.
          await transactions.run(async (context) => {
            const root = await repository.lock(owner.id, project, context);
            await repository.replaceMonth(
              root,
              1,
              { caption: 'Edited after root read', images: [] },
              context,
            );
            await repository.advanceVersion(root, now, context);
          });
        } finally {
          resume.release();
          readiness.read = original;
        }
        const during = await reading;
        assert.equal(during.projectVersion, 3);
        assert.equal(
          during.finalization.issues.includes(
            'FINALIZATION_PERSONAL_IMAGE_REQUIRED',
          ),
          false,
        );
        const after = await evaluate();
        assert.equal(after.projectVersion, 4);
        assert(
          after.finalization.issues.includes(
            'FINALIZATION_PERSONAL_IMAGE_REQUIRED',
          ),
        );
        assert.equal(after.ar.preparation, 'STALE');
      },
    );

    await check(
      'DB09: AR edit plus late old READY artifact cannot promote current revision',
      async () => {
        await writeAR(4);
        await db.query(
          "UPDATE lumical.project_ar_experiences SET preparation_status='READY',target_artifact_id=$2 WHERE project_id=$1",
          [project, artifact],
        );
        const result = await evaluate();
        assert.equal(result.projectVersion, 5);
        assert.equal(result.ar.preparation, 'STALE');
        assert.equal(result.ar.ready, false);
        assert.equal(result.finalization.ready, false);
      },
    );
    await check(
      'DB10: cleanup refuses referenced purge; owner-removed media cannot reveal',
      async () => {
        await assert.rejects(
          db.query(
            `INSERT INTO lumical.job_records (id,kind,object_id,operation_identity,condition,due_at,updated_at)
        VALUES($1,'MEDIA_DELETE',$2,$3,'PENDING',now(),now())`,
            [randomUUID(), image, `MEDIA_DELETE:${image}`],
          ),
          (error) => error.code === '23514',
        );
        await db.query(
          'UPDATE lumical.media_assets SET deleted_at=now() WHERE id=$1',
          [image],
        );
        assert((await evaluate()).ar.issues.includes('AR_REVEAL_UNAVAILABLE'));
      },
    );
    await check(
      'DB11: Archived remains previewable and cannot finalize',
      async () => {
        await db.query(
          "UPDATE lumical.calendar_projects SET status='ARCHIVED',version=version+1,updated_at=now() WHERE id=$1",
          [project],
        );
        const result = await evaluate();
        assert.equal(result.preview.ready, true);
        assert(result.finalization.issues.includes('FINALIZATION_NOT_WORKING'));
        const preview = await api.get(`${base}/preview`).set('Cookie', owner.cookie).expect(200);
        assert.equal(preview.body.data.project.status, 'ARCHIVED');
        assert.equal(preview.body.data.projectVersion, result.projectVersion);
        assert.equal(preview.body.data.readiness.previewReady, true);
        assert.equal(preview.body.data.readiness.orderReady, false);
        assert(preview.body.data.readiness.issues.order.includes('PROJECT_ARCHIVED'));
      },
    );
    await check(
      'DB12: one worker claims a revision and late compilation cannot replace current or historical bytes',
      async () => {
        const currentProject = await projectFixture(
          db,
          owner.id,
          syntheticIds.revision,
        );
        const asset = await mediaFixture(db, owner.id, 'READY', {
          contentType: 'image/png',
          verifiedBytes: targetImage.length,
        });
        await db.query(
          `INSERT INTO lumical.calendar_months (id,project_id,month_number)
         VALUES (gen_random_uuid(),$1,1)`,
          [currentProject],
        );
        const mutate = async (work) =>
          transactions.run(async (context) =>
            work(
              await repository.lock(owner.id, currentProject, context),
              context,
            ),
          );
        const save = () =>
          mutate((root, context) =>
            repository.saveAR(
              root,
              {
                monthNumber: 1,
                revealAssetId: asset,
                readableText: 'Synthetic target memory',
              },
              now,
              context,
            ),
          );
        await mutate((root, context) =>
          repository.replaceMonth(
            root,
            1,
            {
              caption: null,
              images: [{ assetId: asset, altText: 'Synthetic calendar image' }],
            },
            context,
          ),
        );
        const jobs = app.get(PreparationJobs);
        const worker = app.get(PrepareTarget);
        const signal = new AbortController().signal;
        // Drain stale intents created by the preceding scenarios.
        while (await worker.runBatch(1, signal)) {
          // All remaining intents from the earlier scenarios are stale.
        }
        const revision = (await save()).projectVersion;
        failFetch = true;
        await worker.runBatch(1, signal);
        failFetch = false;
        const jobState = async (version) =>
          (
            await db.query(
              'SELECT condition,attempts,safe_error_code FROM lumical.job_records WHERE operation_identity=$1',
              [`AR_PREPARE:${currentProject}:${version}`],
            )
          ).rows[0];
        assert.deepEqual(await jobState(revision), {
          condition: 'PENDING',
          attempts: 1,
          safe_error_code: 'AR_PREPARATION_RETRY',
        });
        await db.query(
          'UPDATE lumical.job_records SET due_at=now() WHERE operation_identity=$1',
          [`AR_PREPARE:${currentProject}:${revision}`],
        );

        const entered = barrier();
        const resume = barrier();
        fetchBarrier = { entered, resume };
        const processing = worker.runBatch(1, signal);
        try {
          await Promise.race([
            entered.promise,
            processing.then(() => {
              throw new Error('Worker finished before reading source.');
            }),
          ]);
          assert.equal(await jobs.claim(), null);
          // Invalidate the source while compilation is outside the transaction.
          // The Project revision remains current, so this must become UNAVAILABLE.
          await db.query(
            "UPDATE lumical.media_assets SET status='UNAVAILABLE',deleted_at=now() WHERE id=$1",
            [asset],
          );
        } finally {
          fetchBarrier = undefined;
          resume.release();
          await processing;
        }
        assert.deepEqual(await jobState(revision), {
          condition: 'FAILED',
          attempts: 2,
          safe_error_code: 'AR_PREPARATION_UNAVAILABLE',
        });
        const invalidConfig = await db.query(
          'SELECT preparation_status,target_artifact_id FROM lumical.project_ar_experiences WHERE project_id=$1',
          [currentProject],
        );
        assert.deepEqual(invalidConfig.rows, [
          { preparation_status: 'UNAVAILABLE', target_artifact_id: null },
        ]);
        const artifacts = async () =>
          (
            await db.query(
              'SELECT id,source_revision,artifact_reference,artifact_bytes,adapter_metadata FROM lumical.ar_target_artifacts WHERE project_id=$1 ORDER BY source_revision',
              [currentProject],
            )
          ).rows;
        assert.deepEqual(await artifacts(), []);
      },
    );
  } finally {
    if (app) await app.close();
    await db.end();
  }
});
