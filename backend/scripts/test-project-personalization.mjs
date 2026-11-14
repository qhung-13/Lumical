import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import request from 'supertest';
import {
  artifactFixture,
  mediaFixture,
  orderFixture,
} from '../test/database/fixtures.mjs';
import { withDisposablePostgres } from './disposable-postgres.mjs';

const require = createRequire(import.meta.url);
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module.js');
const { configureApp } = require('../dist/config/configure-app.js');
const { Clock } = require('../dist/modules/identity/application/ports.js');
const backend = fileURLToPath(new URL('..', import.meta.url));
const origin = 'https://lumical.test';
const password = 'TEST ONLY fixture passphrase';
const tags = (version) => `"${version}"`;
const date = '2028-02-29';

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

async function waitForBlockedRequests(observer, blocker, count = 1) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const {
      rows: [{ waiting }],
    } = await observer.query(
      `WITH RECURSIVE waits(pid) AS (
        SELECT $1::integer
        UNION
        SELECT a.pid FROM waits w CROSS JOIN pg_stat_activity a
        WHERE w.pid = ANY(pg_blocking_pids(a.pid))
      ) SELECT (count(*) - 1)::int AS waiting FROM waits`,
      [blocker.processID],
    );
    if (waiting >= count) return;
    await setTimeout(25);
  }
  throw new Error('The HTTP mutation did not wait for the held database lock.');
}

async function captureHistory(db, project, owner, revision, image) {
  const order = await orderFixture(db, project, owner);
  const version = randomUUID();
  const month = randomUUID();
  const reveal = randomUUID();
  const artifact = await artifactFixture(db, project, owner, 'READY');
  await db.query(
    `INSERT INTO lumical.order_calendar_versions
    (id,order_id,owner_id,project_id,source_project_revision,year,title,dedication,template_revision_id,template_name_vi,template_name_en,style_definition)
    VALUES($1,$2,$3,$4,1,2028,'Historical title','Historical dedication',$5,'Synthetic','Synthetic','{}')`,
    [version, order, owner, project, revision],
  );
  await db.query(
    `INSERT INTO lumical.order_month_snapshots (id,version_id,month_number,caption,layout)
    VALUES($1,$2,1,'Historical caption','{}')`,
    [month, version],
  );
  await db.query(
    `INSERT INTO lumical.order_special_date_snapshots (id,version_id,event_date,title,note)
    VALUES($1,$2,'2028-02-29','Historical event','Historical note')`,
    [randomUUID(), version],
  );
  await db.query(
    `INSERT INTO lumical.order_media_references
    (id,version_id,owner_id,project_id,month_id,asset_id,purpose,position,accessible_text)
    VALUES ($1,$2,$3,$4,$5,$6,'MONTH_IMAGE',0,'Historical photo'),
           ($7,$2,$3,$4,NULL,$6,'AR_REVEAL',NULL,'Historical reveal')`,
    [randomUUID(), version, owner, project, month, image, reveal],
  );
  await db.query(
    `INSERT INTO lumical.order_ar_snapshots
    (id,version_id,owner_id,project_id,target_artifact_id,reveal_reference_id,readable_text,fallback_representation)
    VALUES($1,$2,$3,$4,$5,$6,'Historical message','{}')`,
    [randomUUID(), version, owner, project, artifact, reveal],
  );
  return async () =>
    (
      await db.query(
        `SELECT
    (SELECT to_jsonb(v) FROM lumical.order_calendar_versions v WHERE id=$1) AS version,
    (SELECT to_jsonb(m) FROM lumical.order_month_snapshots m WHERE id=$2) AS month,
    (SELECT to_jsonb(e) FROM lumical.order_special_date_snapshots e WHERE version_id=$1) AS event,
    (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM lumical.order_media_references r WHERE version_id=$1) AS pins,
    (SELECT to_jsonb(a) FROM lumical.order_ar_snapshots a WHERE version_id=$1) AS ar,
    (SELECT to_jsonb(t) FROM lumical.ar_target_artifacts t WHERE id=$3) AS artifact`,
        [version, month, artifact],
      )
    ).rows[0];
}

await withDisposablePostgres(async ({ url }) => {
  Object.assign(process.env, {
    NODE_ENV: 'production',
    IDENTITY_COOKIE_MODE: 'https',
    IDENTITY_SECRET_KEY: randomBytes(32).toString('hex'),
    IDENTITY_ALLOWED_ORIGINS: origin,
    IDENTITY_AUTH_ATTEMPTS: '1000',
    IDENTITY_TRUSTED_PROXY_IPS: '',
    CALENDAR_TIME_ZONE: 'Asia/Ho_Chi_Minh',
    DATABASE_URL: url('runtime', 'lumical_i01_blank'),
    MIGRATION_DATABASE_URL: url('migration', 'lumical_i01_blank'),
  });
  await promisify(execFile)(
    process.execPath,
    ['scripts/prisma.mjs', 'migrate', 'deploy'],
    { cwd: backend },
  );
  const db = await connect(process.env.DATABASE_URL);
  const migration = await connect(process.env.MIGRATION_DATABASE_URL);
  const blocker = await connect(process.env.DATABASE_URL);
  let app;
  let now = new Date('2026-11-14T00:00:00Z');
  try {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue({ now: () => now })
      .compile();
    app = fixture.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    const api = request(app.getHttpServer());

    const register = async (name) => {
      const {
        headers,
        body: { data },
      } = await api
        .post('/api/v1/auth/register')
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send({ email: `${name}@example.invalid`, password })
        .expect(201);
      return {
        id: data.id,
        csrf: data.csrfToken,
        cookie: headers['set-cookie'][0].split(';')[0],
      };
    };
    const send = (method, path, account, version, key) => {
      const req = api[method](path).set('Origin', origin);
      if (account)
        req.set('Cookie', account.cookie).set('X-CSRF-Token', account.csrf);
      if (version !== undefined) req.set('If-Match', tags(version));
      if (key) req.set('Idempotency-Key', key);
      return req;
    };
    const admin = await register('admin');
    await migration.query("UPDATE lumical.users SET role='ADMIN' WHERE id=$1", [
      admin.id,
    ]);
    const login = await send('post', '/api/v1/auth/login')
      .send({ email: 'admin@example.invalid', password })
      .expect(200);
    admin.cookie = login.headers['set-cookie'][0].split(';')[0];
    admin.csrf = login.body.data.csrfToken;

    const template = (
      await send(
        'post',
        '/api/v1/admin/templates',
        admin,
        undefined,
        randomUUID(),
      )
        .send({
          category: 'GENERAL',
          revision: {
            name: { vi: 'Synthetic VI', en: 'Synthetic EN' },
            description: { vi: 'Fixture VI', en: 'Fixture EN' },
            layout: {
              version: 1,
              type: 'PHOTO_FOCUS',
              monthCount: 12,
              maxImagesPerMonth: 4,
            },
            presets: ['classic', 'minimal'].map((id) => ({
              id,
              name: { vi: id, en: id },
            })),
            price: { currency: 'USD', unitPriceMinor: 1450 },
          },
        })
        .expect(201)
    ).body.data.id;
    await send(
      'put',
      `/api/v1/admin/templates/${template}/availability`,
      admin,
      1,
      randomUUID(),
    )
      .send({ availability: 'ACTIVE', reason: 'Test publication' })
      .expect(200);

    const owner = await register('owner');
    const other = await register('other');
    const createProject = async (account) =>
      (
        await send('post', '/api/v1/projects', account, undefined, randomUUID())
          .send({
            templateId: template,
            title: 'Synthetic calendar',
            year: 2028,
            recipientName: 'Fixture',
            stylePresetId: 'classic',
          })
          .expect(201)
      ).body.data.id;
    const project = await createProject(owner);
    const foreign = await createProject(other);
    const sameOwner = await createProject(owner);
    const base = `/api/v1/projects/${project}`;
    const months = base + '/months';
    const events = base + '/special-dates';
    const ar = base + '/ar';
    const media = await mediaFixture(db, owner.id, 'READY');
    const second = await mediaFixture(db, owner.id, 'READY');
    const pending = await mediaFixture(db, owner.id);
    const unavailable = await mediaFixture(db, owner.id, 'UNAVAILABLE');
    const foreignAsset = await mediaFixture(db, other.id, 'READY');
    const video = randomUUID();
    await db.query(
      `INSERT INTO lumical.media_assets
      (id,owner_id,category,status,upload_intent_id,storage_reference,verified_bytes,duration_ms,content_type,verified_at)
      VALUES($1,$2,'VIDEO','READY',$3,$4,42,200,'video/mp4',now())`,
      [video, owner.id, randomUUID(), 'test-only:' + video],
    );
    const image = (assetId) => ({
      assetId,
      altText: 'Fixture photo',
      crop: null,
    });
    const event = { date, title: 'Leap day' };
    const reveal = {
      monthNumber: 1,
      revealAssetId: media,
      readableText: 'Fixture reveal',
    };
    const root = async () =>
      (
        await db.query(
          `SELECT version,style_preset_id,template_revision_id,unit_price_minor
      FROM lumical.calendar_projects WHERE id=$1`,
          [project],
        )
      ).rows[0];
    const initial = await root();
    const history = await captureHistory(
      db,
      project,
      owner.id,
      initial.template_revision_id,
      media,
    );
    const snapshot = await history();

    await check(
      'authentication, origin, CSRF, owner scope and preconditions have safe error envelopes',
      async () => {
        await send('get', events).expect(401);
        await send('put', months + '/1', owner, 1)
          .set('Origin', 'https://wrong.invalid')
          .send({ images: [] })
          .expect(403);
        await send('put', months + '/1', owner, 1)
          .set('X-CSRF-Token', 'bad')
          .send({ images: [] })
          .expect(403);
        const foreignRead = await send('get', events, other).expect(404);
        const unknownRead = await send(
          'get',
          `/api/v1/projects/${randomUUID()}/special-dates`,
          other,
        ).expect(404);
        const safeError = (response) => {
          const { requestId, ...error } = response.body.error;
          assert.equal(requestId, response.headers['x-request-id']);
          return error;
        };
        assert.deepEqual(safeError(foreignRead), safeError(unknownRead));
        await send('put', months + '/1', other, 1)
          .send({ images: [] })
          .expect(404);
        assert.equal(
          safeError(
            await send('put', months + '/1', owner)
              .send({ images: [] })
              .expect(428),
          ).code,
          'PRECONDITION_REQUIRED',
        );
        assert.equal(
          safeError(
            await send('put', months + '/1', owner, 2)
              .send({ images: [] })
              .expect(412),
          ).currentVersion,
          1,
        );
        await send('post', events, owner, 1).send(event).expect(422);
        await send('put', ar, owner, 1).send(reveal).expect(422);
        await send('put', months + '/13', owner, 1)
          .send({ images: [] })
          .expect(422);
        await send('post', events, owner, 1, randomUUID())
          .send({ ...event, date: '2028-02-30' })
          .expect(422);
        await send('put', ar, owner, 1, randomUUID())
          .send({ ...reveal, readableText: ' ' })
          .expect(422);
        assert.deepEqual(await root(), initial);
      },
    );

    await check(
      'Month replacement enforces ownership/readiness, preserves order and allows reuse',
      async () => {
        const body = {
          caption: '👩🏽‍💻'.repeat(300),
          images: [image(second), image(media)],
        };
        const saved = await send('put', months + '/1', owner, 1)
          .send(body)
          .expect(200)
          .expect('ETag', tags(2))
          .expect('Cache-Control', 'no-store');
        assert.deepEqual(saved.body, {
          data: { ...body, monthNumber: 1, projectVersion: 2 },
        });
        for (const [asset, status] of [
          [pending, 409],
          [unavailable, 409],
          [foreignAsset, 404],
          [video, 409],
        ]) {
          await send('put', months + '/1', owner, 2)
            .send({ images: [image(media), image(asset)] })
            .expect(status);
        }
        const read = await send('get', months, owner)
          .expect(200)
          .expect('ETag', tags(2));
        assert.deepEqual(read.body.data.months[0], { ...body, monthNumber: 1 });
        assert.equal(JSON.stringify(read.body).includes('test-only:'), false);
        await send('put', months + '/12', owner, 2)
          .send({ images: [image(media)] })
          .expect(200)
          .expect('ETag', tags(3));
      },
    );

    await check(
      'blocked concurrent Month and PATCH mutations cannot both save the same Project version',
      async () => {
        await blocker.query('BEGIN');
        const attempts = [];
        try {
          await blocker.query(
            'SELECT id FROM lumical.calendar_projects WHERE id=$1 FOR UPDATE',
            [project],
          );
          attempts.push(
            send('put', months + '/1', owner, 3)
              .send({ images: [] })
              .then((response) => response),
          );
          await waitForBlockedRequests(db, blocker);
          attempts.push(
            send('patch', base, owner, 3)
              .send({ stylePresetId: 'minimal' })
              .then((response) => response),
          );
          await waitForBlockedRequests(db, blocker, 2);
        } finally {
          await blocker.query('ROLLBACK');
        }
        const results = await Promise.all(attempts);
        assert.deepEqual(
          results.map((result) => result.status).sort(),
          [200, 412],
        );
        assert.equal(
          results.find((result) => result.status === 412).body.error
            .currentVersion,
          4,
        );
        assert.equal((await root()).version, 4);
        const monthWon = results[0].status === 200;
        const current = (await send('get', months, owner).expect(200)).body.data
          .months[0];
        assert.equal(current.images.length, monthWon ? 0 : 2);
        assert.equal(
          (await root()).style_preset_id,
          monthWon ? 'classic' : 'minimal',
        );
        await send('patch', base, owner, 4)
          .send({ stylePresetId: 'foreign-preset' })
          .expect(422);
        await send('patch', base, owner, 4)
          .send({ stylePresetId: 'minimal' })
          .expect(200)
          .expect('ETag', tags(5));
        assert.deepEqual(await root(), {
          ...initial,
          version: 5,
          style_preset_id: 'minimal',
        });
      },
    );

    let eventId;
    const eventKey = randomUUID();
    await check(
      'concurrent identical Special Date intent returns one original 201 outcome',
      async () => {
        await blocker.query('BEGIN');
        const attempts = [];
        try {
          await blocker.query(
            'SELECT id FROM lumical.calendar_projects WHERE id=$1 FOR UPDATE',
            [project],
          );
          for (let index = 0; index < 2; index += 1) {
            attempts.push(
              send('post', events, owner, 5, eventKey)
                .send(event)
                .then((response) => response),
            );
            await waitForBlockedRequests(db, blocker, index + 1);
          }
        } finally {
          await blocker.query('ROLLBACK');
        }
        const [left, right] = await Promise.all(attempts);
        assert.equal(left.status, 201);
        assert.equal(right.status, 201);
        assert.deepEqual(left.body, right.body);
        eventId = left.body.data.id;
        assert.equal(left.headers.etag, tags(6));
        assert.deepEqual(
          (await send('get', events, owner).expect(200)).body.data.events,
          [{ ...event, note: null, id: eventId }],
        );
        await send('post', events, owner, 5, eventKey)
          .send({ ...event, title: 'Changed' })
          .expect(409);
        await send('post', events, owner, 6, eventKey).send(event).expect(409);
      },
    );

    await check(
      'Special Dates keep the Project year, allow shared dates, and scope edit/delete to the parent',
      async () => {
        await send('put', events + '/' + eventId, other, 6)
          .send(event)
          .expect(404);
        await send(
          'delete',
          `/api/v1/projects/${foreign}/special-dates/${eventId}`,
          other,
          1,
        ).expect(404);
        await send(
          'delete',
          `/api/v1/projects/${sameOwner}/special-dates/${eventId}`,
          owner,
          1,
        ).expect(404);
        await send('post', events, owner, 6, randomUUID())
          .send({ ...event, title: 'Same day' })
          .expect(201);
        const text = '👩🏽‍💻';
        const changed = {
          date,
          title: text.repeat(80),
          note: text.repeat(300),
        };
        await send('put', events + '/' + eventId, owner, 7)
          .send(changed)
          .expect(200)
          .expect('ETag', tags(8));
        let response = await send('get', events, owner).expect(200);
        assert.equal(response.body.data.events.length, 2);
        assert.deepEqual(
          response.body.data.events.find((row) => row.id === eventId),
          { id: eventId, ...changed },
        );
        await send('delete', events + '/' + eventId, owner, 8)
          .expect(204)
          .expect('ETag', tags(9));
        response = await send('post', events, owner, 5, eventKey)
          .send(event)
          .expect(201)
          .expect('ETag', tags(6));
        assert.equal(response.body.data.id, eventId);
        assert.equal((await root()).version, 9);
      },
    );

    await check(
      'an attach versus Media deletion race gives cleanup priority once the asset is tombstoned',
      async () => {
        const asset = await mediaFixture(db, owner.id, 'READY');
        await blocker.query('BEGIN');
        let response;
        try {
          await blocker.query(
            "UPDATE lumical.media_assets SET status='UNAVAILABLE', deleted_at=now() WHERE id=$1",
            [asset],
          );
          response = send('put', months + '/12', owner, 9)
            .send({ images: [image(asset)] })
            .then((result) => result);
          await waitForBlockedRequests(db, blocker);
          await blocker.query('COMMIT');
        } finally {
          await blocker.query('ROLLBACK');
        }
        assert.equal((await response).status, 404);
        assert.equal((await root()).version, 9);
      },
    );

    await check(
      'AR revision handoff and idempotency commit together, replacement/removal preserves history',
      async () => {
        const key = randomUUID();
        await send('put', ar, owner, 9, randomUUID())
          .send({ ...reveal, revealAssetId: foreignAsset })
          .expect(404);
        await send('put', ar, owner, 9, randomUUID())
          .send({ ...reveal, revealAssetId: pending })
          .expect(409);
        const saved = await send('put', ar, owner, 9, key)
          .send(reveal)
          .expect(200)
          .expect('ETag', tags(10));
        assert.deepEqual(saved.body, {
          data: { ...reveal, status: 'PREPARING', projectVersion: 10 },
        });
        const replaced = {
          ...reveal,
          revealAssetId: video,
          readableText: 'Fixture transcript',
        };
        await send('put', ar, owner, 10, randomUUID())
          .send(replaced)
          .expect(200)
          .expect('ETag', tags(11));
        assert.deepEqual(
          (await send('put', ar, owner, 9, key).send(reveal).expect(200)).body,
          saved.body,
        );
        const config = (
          await db.query(
            `SELECT source_revision,preparation_status,target_artifact_id,reveal_asset_id
        FROM lumical.project_ar_experiences WHERE project_id=$1`,
            [project],
          )
        ).rows;
        assert.deepEqual(config, [
          {
            source_revision: 11,
            preparation_status: 'PREPARING',
            target_artifact_id: null,
            reveal_asset_id: video,
          },
        ]);
        await send('delete', ar, owner, 11)
          .expect(204)
          .expect('ETag', tags(12));
        assert.equal(
          (
            await db.query(
              'SELECT id FROM lumical.project_ar_experiences WHERE project_id=$1',
              [project],
            )
          ).rowCount,
          0,
        );
        const jobs = (
          await db.query(
            "SELECT operation_identity,condition FROM lumical.job_records WHERE kind='AR_PREPARE' AND object_id=$1 ORDER BY operation_identity",
            [project],
          )
        ).rows;
        assert.deepEqual(
          jobs,
          [10, 11].map((version) => ({
            operation_identity: `AR_PREPARE:${project}:${version}`,
            condition: 'CANCELLED',
          })),
        );
        assert.deepEqual(await history(), snapshot);
      },
    );

    await check(
      'database failures roll back both child data and root version',
      async () => {
        const trigger = 'test_i07_reject';
        await migration.query(`CREATE FUNCTION lumical.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Synthetic rollback fault' USING ERRCODE='23514'; END $$`);
        await migration.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON lumical.job_records
        FOR EACH ROW WHEN (NEW.kind='AR_PREPARE') EXECUTE FUNCTION lumical.${trigger}()`);
        try {
          const key = randomUUID();
          await send('put', ar, owner, 12, key).send(reveal).expect(500);
          assert.equal((await root()).version, 12);
          assert.equal(
            (
              await db.query(
                'SELECT id FROM lumical.project_ar_experiences WHERE project_id=$1',
                [project],
              )
            ).rowCount,
            0,
          );
          assert.equal(
            (
              await db.query(
                'SELECT id FROM lumical.idempotency_records WHERE actor_id=$1 AND key=$2',
                [owner.id, key],
              )
            ).rowCount,
            0,
          );
          assert.deepEqual(await history(), snapshot);
        } finally {
          await migration.query(
            `DROP TRIGGER ${trigger} ON lumical.job_records; DROP FUNCTION lumical.${trigger}()`,
          );
        }
      },
    );

    await check(
      'Archived child writes fail and an existing Project still uses its own civil year',
      async () => {
        await send('post', base + '/archive', owner, 12)
          .expect(200)
          .expect('ETag', tags(13));
        await send('put', months + '/1', owner, 13)
          .send({ images: [] })
          .expect(409);
        await send('post', events, owner, 13, randomUUID())
          .send(event)
          .expect(409);
        await send('put', ar, owner, 13, randomUUID()).send(reveal).expect(409);
        await send('delete', ar, owner, 13).expect(409);
        await send('get', events, owner).expect(200);
        await send('post', base + '/restore', owner, 13).expect(200);
        now = new Date('2032-01-01T00:00:00Z');
        // Renew the session after the test clock advances past token expiry.
        const login = await send('post', '/api/v1/auth/login')
          .send({ email: 'owner@example.invalid', password })
          .expect(200);
        owner.cookie = login.headers['set-cookie'][0].split(';')[0];
        owner.csrf = login.body.data.csrfToken;
        await send('post', events, owner, 14, randomUUID())
          .send(event)
          .expect(201)
          .expect('ETag', tags(15));
        assert.deepEqual(await history(), snapshot);
      },
    );

    await check(
      'published OpenAPI describes child version and idempotency headers and response shapes',
      async () => {
        const spec = (await api.get('/api/v1/openapi.json').expect(200)).body;
        for (const [path, method, status, intent] of [
          ['months/{number}', 'put', '200', false],
          ['special-dates', 'post', '201', true],
          ['special-dates/{eventId}', 'put', '200', false],
          ['special-dates/{eventId}', 'delete', '204', false],
          ['ar', 'put', '200', true],
          ['ar', 'delete', '204', false],
        ]) {
          const operation = spec.paths[`/api/v1/projects/{id}/${path}`][method];
          assert.ok(
            operation.parameters.some(
              (p) => p.name === 'If-Match' && p.required,
            ),
          );
          assert.equal(
            operation.parameters.some(
              (p) => p.name === 'Idempotency-Key' && p.required,
            ),
            intent,
          );
          assert.ok(operation.responses[status].headers.ETag);
          assert.ok(
            operation.responses['412'].content['application/json'].schema.$ref,
          );
        }
      },
    );
  } finally {
    await Promise.all([app?.close(), db.end(), migration.end(), blocker.end()]);
  }
});
