import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { withDisposablePostgres } from './disposable-postgres.mjs';
import { mediaFixture, orderFixture } from '../test/database/fixtures.mjs';

const require = createRequire(import.meta.url);
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module.js');
const { configureApp } = require('../dist/config/configure-app.js');
const { Clock } = require('../dist/modules/identity/application/ports.js');
const backend = fileURLToPath(new URL('..', import.meta.url));
const originalEnv = { ...process.env };
const password = '  TEST ONLY memory passphrase  ';
const origin = 'https://lumical.test';
const logs = [];

async function check(name, work) { await work(); console.log(`PASS: ${name}`); }
function cookie(response) { return response.headers['set-cookie'][0].split(';')[0]; }
async function connect(url) { const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 }); await client.connect(); return client; }

// The public contract of a revision: bilingual copy, frozen layout, approved presets, USD minor units.
const revision = (over = {}) => ({
  name: { vi: 'Lịch mùa xuân', en: 'Spring calendar' },
  description: { vi: 'Mô tả', en: 'Description' },
  layout: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 },
  presets: [
    { id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } },
    { id: 'minimal', name: { vi: 'Tối giản', en: 'Minimal' } },
  ],
  price: { currency: 'USD', unitPriceMinor: 1450 },
  ...over,
});

try {
  await withDisposablePostgres(async ({ url }) => {
    process.env.NODE_ENV = 'production';
    process.env.IDENTITY_COOKIE_MODE = 'https';
    process.env.IDENTITY_SECRET_KEY = randomBytes(32).toString('hex');
    process.env.IDENTITY_ALLOWED_ORIGINS = origin;
    process.env.IDENTITY_AUTH_ATTEMPTS = '1000';
    process.env.IDENTITY_AUTH_BUCKETS = '10000';
    process.env.IDENTITY_TRUSTED_PROXY_IPS = '';
    process.env.CALENDAR_TIME_ZONE = 'Asia/Ho_Chi_Minh';
    process.env.DATABASE_URL = url('runtime', 'lumical_i01_blank');
    await promisify(execFile)(process.execPath, ['scripts/prisma.mjs', 'migrate', 'deploy'], {
      cwd: backend, env: { ...process.env, MIGRATION_DATABASE_URL: url('migration', 'lumical_i01_blank') }, maxBuffer: 2 * 1024 * 1024,
    });
    const runtime = await connect(process.env.DATABASE_URL);
    const migration = await connect(url('migration', 'lumical_i01_blank'));
    let app;
    let now = new Date('2026-11-09T05:00:00.000Z');
    const start = async () => {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(Clock).useValue({ now: () => now }).compile();
      const record = value => logs.push(String(value));
      app = module.createNestApplication({ logger: { log: record, warn: record, error: record, debug: record, verbose: record } });
      configureApp(app); await app.init();
    };
    const api = () => request(app.getHttpServer());
    const register = email => api().post('/api/v1/auth/register').set('Origin', origin).set('Idempotency-Key', randomUUID()).send({ email, password });
    const login = email => api().post('/api/v1/auth/login').set('Origin', origin).send({ email, password });
    const session = async email => {
      const response = await login(email).expect(200);
      return { cookie: cookie(response), csrf: response.body.data.csrfToken, id: response.body.data.id };
    };

    // Owner transport: reads carry the session, mutations add Origin, CSRF and the precondition.
    const createProject = (actor, body, key = randomUUID()) => api().post('/api/v1/projects')
      .set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf).set('Idempotency-Key', key).send(body);
    const listProjects = (actor, query = '') => api().get(`/api/v1/projects${query}`).set('Cookie', actor.cookie);
    const getProject = (actor, id) => api().get(`/api/v1/projects/${id}`).set('Cookie', actor.cookie);
    const monthsOf = (actor, id) => api().get(`/api/v1/projects/${id}/months`).set('Cookie', actor.cookie);
    const patchProject = (actor, id, body, etag) => api().patch(`/api/v1/projects/${id}`)
      .set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf).set('If-Match', etag).send(body);
    const archiveProject = (actor, id, etag) => api().post(`/api/v1/projects/${id}/archive`)
      .set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf).set('If-Match', etag);
    const restoreProject = (actor, id, etag) => api().post(`/api/v1/projects/${id}/restore`)
      .set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf).set('If-Match', etag);
    const deleteProject = (actor, id, body, etag) => api().delete(`/api/v1/projects/${id}`)
      .set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf).set('If-Match', etag).send(body);

    const year = now.getUTCFullYear() + 1;
    const projectBody = (over = {}) => ({ templateId: templateId ?? randomUUID(), title: 'A year of memories', year,
      recipientName: 'Bà ngoại', stylePresetId: 'classic', ...over });
    let templateId;
    let owner;
    let other;
    let project;
    let replayed;

    try {
      await start();

      // A published Template is the creation precondition; an Admin account supplies it.
      const adminAuth = await register('admin@example.invalid').expect(201);
      await migration.query("UPDATE lumical.users SET role='ADMIN' WHERE id=$1", [adminAuth.body.data.id]);
      const admin = await session('admin@example.invalid');
      const created = await api().post('/api/v1/admin/templates').set('Origin', origin).set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrf).set('Idempotency-Key', randomUUID())
        .send({ category: 'GENERAL', revision: revision() }).expect(201);
      templateId = created.body.data.id;
      await api().put(`/api/v1/admin/templates/${templateId}/availability`).set('Origin', origin).set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrf).set('Idempotency-Key', randomUUID())
        .set('If-Match', '"1"').send({ availability: 'ACTIVE', reason: 'TEST ONLY publish' }).expect(200);

      await register('owner@example.invalid').expect(201);
      owner = await session('owner@example.invalid');
      await register('other@example.invalid').expect(201);
      other = await session('other@example.invalid');
      const ownerId = owner.id;
      const ownerProjects = async () => (await runtime.query('SELECT count(*) FROM lumical.calendar_projects WHERE owner_id=$1', [ownerId])).rows[0].count;

      await check('POST /projects persists the baseline, twelve Months and a safe Project body', async () => {
        const response = await createProject(owner, projectBody()).expect(201).expect('ETag', '"1"');
        project = response.body.data;
        assert.deepEqual(Object.keys(project).sort(),
          ['baseline', 'createdAt', 'id', 'recipientName', 'status', 'stylePresetId', 'title', 'updatedAt', 'version', 'year']);
        assert.deepEqual({ status: project.status, version: project.version, year: project.year, stylePresetId: project.stylePresetId },
          { status: 'WORKING', version: 1, year, stylePresetId: 'classic' });
        assert.deepEqual(project.baseline, {
          name: { vi: 'Lịch mùa xuân', en: 'Spring calendar' },
          layout: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 },
        });
        // §16/§9: no owner, revision, price or raw baseline column ever leaves the server.
        assert.equal(JSON.stringify(response.body).match(/ownerId|templateRevisionId|unitPriceMinor|currency|baselineStyle/), null);
        assert.equal(response.headers['cache-control'], 'no-store');
        const months = (await runtime.query('SELECT month_number FROM lumical.calendar_months WHERE project_id=$1 ORDER BY month_number', [project.id])).rows;
        assert.deepEqual(months.map(row => row.month_number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        const row = (await runtime.query('SELECT owner_id,status,version,style_preset_id FROM lumical.calendar_projects WHERE id=$1', [project.id])).rows[0];
        assert.deepEqual({ owner_id: row.owner_id, status: row.status, version: row.version, style_preset_id: row.style_preset_id },
          { owner_id: ownerId, status: 'WORKING', version: 1, style_preset_id: 'classic' });
      });

      await check('creation validation, session guards and duplicate intents are refused safely', async () => {
        await api().options('/api/v1/projects').set('Origin', origin)
          .set('Access-Control-Request-Method', 'PATCH')
          .set('Access-Control-Request-Headers', 'x-csrf-token,if-match')
          .expect(204).expect('Access-Control-Allow-Methods', /\bPATCH\b/);
        const before = await ownerProjects();
        // Origin, CSRF and session are checked before any write (§10).
        await api().post('/api/v1/projects').set('Cookie', owner.cookie).set('X-CSRF-Token', owner.csrf)
          .set('Idempotency-Key', randomUUID()).send(projectBody()).expect(403);
        await api().post('/api/v1/projects').set('Origin', origin).set('Cookie', owner.cookie)
          .set('Idempotency-Key', randomUUID()).send(projectBody()).expect(403);
        await api().post('/api/v1/projects').set('Origin', origin)
          .set('Idempotency-Key', randomUUID()).send(projectBody()).expect(401);
        // The Idempotency-Key is required and well formed (§11).
        await api().post('/api/v1/projects').set('Origin', origin).set('Cookie', owner.cookie)
          .set('X-CSRF-Token', owner.csrf).send(projectBody()).expect(422);
        await createProject(owner, projectBody(), 'short').expect(422);
        // P02's canonical request needs every ProjectCreate key present...
        const incomplete = await createProject(owner, { templateId, year, recipientName: 'Bà ngoại', stylePresetId: 'classic' }).expect(422);
        assert.equal(incomplete.body.error.code, 'VALIDATION_FAILED');
        assert.deepEqual(incomplete.body.error.fieldErrors, []);
        // ...and each value is validated with the field §9 reports back.
        for (const [body, path] of [
          [{ ...projectBody(), title: 123 }, 'title'],
          [{ ...projectBody(), title: '' }, 'title'],
          [{ ...projectBody(), stylePresetId: 'vibrant' }, 'stylePresetId'],
          [{ ...projectBody(), year: year + 5 }, 'year'],
        ]) {
          const rejected = await createProject(owner, body).expect(422);
          assert.equal(rejected.body.error.code, 'VALIDATION_FAILED');
          assert.deepEqual(rejected.body.error.fieldErrors.map(field => field.path), [path]);
        }
        await createProject(owner, { ...projectBody(), templateId: randomUUID() }).expect(409);
        await createProject(owner, { ...projectBody(), extra: true }).expect(422);
        assert.equal(await ownerProjects(), before, 'a refused creation must not write a Project');

        const key = randomUUID();
        const first = await createProject(owner, projectBody(), key).expect(201);
        replayed = first.body.data;
        const retry = await createProject(owner, projectBody(), key).expect(201);
        assert.equal(retry.body.data.id, first.body.data.id, 'the same intent replays one outcome');
        assert.equal(retry.headers.etag, first.headers.etag);
        assert.equal(Number(await ownerProjects()), Number(before) + 1, 'a replay must not create a second Project');
        const changed = await createProject(owner, projectBody({ title: 'Changed under the same key' }), key).expect(409);
        assert.equal(changed.body.error.code, 'IDEMPOTENCY_CONFLICT');
        assert.equal(changed.body.error.retryable, false);
        assert.equal(Number(await ownerProjects()), Number(before) + 1);
      });

      await check('the owner list is a cursor page scoped before the filter', async () => {
        const page = await listProjects(owner).expect(200);
        assert.deepEqual(page.body.data.map(item => item.id).sort(), [project.id, replayed.id].sort());
        assert.deepEqual(page.body.meta, { nextCursor: null, hasMore: false });
        // §13: another owner sees an empty page, never someone else's row.
        const foreign = await listProjects(other).expect(200);
        assert.deepEqual(foreign.body.data, []);
        assert.deepEqual(foreign.body.meta, { nextCursor: null, hasMore: false });
        assert.deepEqual((await listProjects(owner, '?state=ARCHIVED')).body.data, []);
        assert.deepEqual((await listProjects(other, '?state=WORKING')).body.data, []);

        const second = (await createProject(owner, projectBody({ title: 'Second calendar' })).expect(201)).body.data;
        const seen = [];
        let cursor;
        for (let page_number = 0; page_number < 6; page_number += 1) {
          const response = await listProjects(owner, cursor ? `?limit=1&cursor=${encodeURIComponent(cursor)}` : '?limit=1').expect(200);
          assert.equal(response.body.data.length, 1, 'a limit of one returns one row');
          seen.push(response.body.data[0].id);
          cursor = response.body.meta.nextCursor;
          if (!cursor) { assert.equal(response.body.meta.hasMore, false, 'the final page carries no cursor'); break; }
          assert.equal(response.body.meta.hasMore, true);
        }
        assert.equal(new Set(seen).size, seen.length, 'a cursor must never repeat a row');
        assert.deepEqual([...seen].sort(), [project.id, replayed.id, second.id].sort(),
          'paging must cover every Project exactly once');
        for (const item of (await listProjects(owner, '?limit=50')).body.data) {
          assert.deepEqual(Object.keys(item).sort(),
            ['baseline', 'createdAt', 'id', 'recipientName', 'status', 'stylePresetId', 'title', 'updatedAt', 'version', 'year']);
        }
        // The filter is validated in the domain and names the bad field (§9).
        for (const [query, path] of [['?limit=0', 'limit'], ['?limit=51', 'limit'], ['?limit=1.5', 'limit'],
          ['?limit=many', 'limit'], ['?state=DELETED', 'state'], ['?state=working', 'state'],
          ['?cursor=', 'cursor'], ['?cursor=not-a-cursor', 'cursor']]) {
          const rejected = await listProjects(owner, query).expect(422);
          assert.equal(rejected.body.error.code, 'VALIDATION_FAILED');
          assert.equal(rejected.body.error.fieldErrors[0].path, path, query);
        }
        await api().get('/api/v1/projects').expect(401);
        assert.equal(await ownerProjects(), '3');
      });

      await check('read, preconditions and owner isolation behave per the contract', async () => {
        const read = await getProject(owner, project.id).expect(200).expect('ETag', '"1"');
        assert.deepEqual(read.body.data, { ...project, deletionEligible: true }, 'the detail projection includes authoritative never-ordered eligibility');
        await api().get(`/api/v1/projects/${project.id}`).expect(401);
        await getProject(owner, 'not-a-uuid').expect(422);
        // §13: a foreign id is the same as a missing one — 404, never 403.
        await getProject(other, project.id).expect(404);
        await monthsOf(other, project.id).expect(404);
        await patchProject(other, project.id, { title: 'Hijack' }, '"1"').expect(404);
        await archiveProject(other, project.id, '"1"').expect(404);
        await restoreProject(other, project.id, '"1"').expect(404);
        await deleteProject(other, project.id, { confirmed: true }, '"1"').expect(404);

        // §12: missing precondition is 428, malformed is 422, stale is 412 with the safe version.
        await api().patch(`/api/v1/projects/${project.id}`).set('Origin', origin).set('Cookie', owner.cookie)
          .set('X-CSRF-Token', owner.csrf).send({ title: 'No precondition' }).expect(428);
        const malformed = await patchProject(owner, project.id, { title: 'Unquoted' }, '1').expect(422);
        assert.equal(malformed.body.error.code, 'VALIDATION_FAILED');
        const stale = await patchProject(owner, project.id, { title: 'Stale' }, '"9"').expect(412);
        assert.deepEqual({ code: stale.body.error.code, currentVersion: stale.body.error.currentVersion, retryable: stale.body.error.retryable },
          { code: 'VERSION_CONFLICT', currentVersion: 1, retryable: false });
        // A refused edit changes nothing.
        assert.equal((await runtime.query('SELECT title,version FROM lumical.calendar_projects WHERE id=$1', [project.id])).rows[0].title, 'A year of memories');

        const patched = await patchProject(owner, project.id, { title: 'Nhớ mãi' }, '"1"').expect(200).expect('ETag', '"2"');
        assert.deepEqual({ title: patched.body.data.title, version: patched.body.data.version }, { title: 'Nhớ mãi', version: 2 });
        const styled = await patchProject(owner, project.id, { stylePresetId: 'minimal' }, '"2"').expect(200).expect('ETag', '"3"');
        assert.equal(styled.body.data.stylePresetId, 'minimal');
        // BR-PRJ-003: only presets the captured revision approved, and no year change workflow.
        const badPreset = await patchProject(owner, project.id, { stylePresetId: 'vibrant' }, '"3"').expect(422);
        assert.equal(badPreset.body.error.fieldErrors[0].path, 'stylePresetId');
        await patchProject(owner, project.id, {}, '"3"').expect(422);
        const yearEdit = await patchProject(owner, project.id, { year: year + 1 }, '"3"').expect(422);
        assert.equal(yearEdit.body.error.code, 'VALIDATION_FAILED');
        assert.equal((await runtime.query('SELECT year,version FROM lumical.calendar_projects WHERE id=$1', [project.id])).rows[0].version, 3);
      });

      await check('archive and restore follow the lifecycle and repeats stay safe', async () => {
        const archived = await archiveProject(owner, project.id, '"3"').expect(200).expect('ETag', '"4"');
        assert.deepEqual({ status: archived.body.data.status, version: archived.body.data.version }, { status: 'ARCHIVED', version: 4 });
        // §17: a repeat of the desired state answers 200 and writes nothing.
        const repeat = await archiveProject(owner, project.id, '"4"').expect(200).expect('ETag', '"4"');
        assert.deepEqual({ status: repeat.body.data.status, version: repeat.body.data.version }, { status: 'ARCHIVED', version: 4 });
        // BR-PRJ-005: Archived is read-only but still readable.
        const refused = await patchProject(owner, project.id, { title: 'Archived edit' }, '"4"').expect(409);
        assert.deepEqual({ code: refused.body.error.code, messageKey: refused.body.error.messageKey },
          { code: 'INVALID_TRANSITION', messageKey: 'errors.invalidTransition' });
        assert.equal((await getProject(owner, project.id).expect(200)).body.data.status, 'ARCHIVED');
        assert.deepEqual((await listProjects(owner, '?state=ARCHIVED')).body.data.map(item => item.id), [project.id]);
        assert.deepEqual((await listProjects(owner, '?state=WORKING')).body.data.map(item => item.id).includes(project.id), false);
        const stale = await archiveProject(owner, project.id, '"1"').expect(412);
        assert.equal(stale.body.error.currentVersion, 4);

        const restored = await restoreProject(owner, project.id, '"4"').expect(200).expect('ETag', '"5"');
        assert.deepEqual({ status: restored.body.data.status, version: restored.body.data.version }, { status: 'WORKING', version: 5 });
        const restoreRepeat = await restoreProject(owner, project.id, '"5"').expect(200).expect('ETag', '"5"');
        assert.deepEqual({ status: restoreRepeat.body.data.status, version: restoreRepeat.body.data.version }, { status: 'WORKING', version: 5 });
        // No automatic share or Order work happens on either transition.
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.recipient_shares')).rows[0].count, '0');
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.orders')).rows[0].count, '0');
        await restoreProject(owner, project.id, '"9"').expect(412);
      });

      await check('GET months returns all twelve in order with the Project version', async () => {
        const response = await monthsOf(owner, project.id).expect(200).expect('ETag', '"5"');
        assert.deepEqual(Object.keys(response.body.data).sort(), ['months', 'projectVersion']);
        assert.equal(response.body.data.projectVersion, 5);
        assert.deepEqual(response.body.data.months.map(month => month.monthNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        assert.equal(response.body.data.months.length, 12);
        for (const month of response.body.data.months) assert.deepEqual(Object.keys(month).sort(), ['caption', 'images', 'monthNumber']);
        assert.equal(response.body.data.months[0].caption, null, 'an untouched Month carries no caption');
        assert.ok(response.body.data.months.every(month => month.images.length === 0));
        await api().get(`/api/v1/projects/${project.id}/months`).expect(401);
        await monthsOf(owner, 'not-a-uuid').expect(422);
      });

      await check('a replayed creation answers with the outcome it originally bound', async () => {
        // §11: the replay returns the bound outcome, not the row as it is now.
        const editedKey = randomUUID();
        const edited = (await createProject(owner, projectBody({ title: 'Replay before edit' }), editedKey).expect(201)).body.data;
        await patchProject(owner, edited.id, { title: 'Đã sửa sau khi tạo' }, '"1"').expect(200).expect('ETag', '"2"');
        const afterEdit = await createProject(owner, projectBody({ title: 'Replay before edit' }), editedKey).expect(201).expect('ETag', '"1"');
        assert.deepEqual(afterEdit.body.data, edited, 'an edit after creation must not change the replayed body');
        assert.equal((await runtime.query('SELECT title,version FROM lumical.calendar_projects WHERE id=$1', [edited.id])).rows[0].version, 2,
          'the replay writes nothing');

        const archivedKey = randomUUID();
        const archived = (await createProject(owner, projectBody({ title: 'Replay before archive' }), archivedKey).expect(201)).body.data;
        await archiveProject(owner, archived.id, '"1"').expect(200);
        const afterArchive = await createProject(owner, projectBody({ title: 'Replay before archive' }), archivedKey).expect(201).expect('ETag', '"1"');
        assert.deepEqual(afterArchive.body.data, archived, 'archive must not change the replayed body');
        assert.equal((await runtime.query('SELECT status FROM lumical.calendar_projects WHERE id=$1', [archived.id])).rows[0].status, 'ARCHIVED');

        const deletedKey = randomUUID();
        const doomedReplay = (await createProject(owner, projectBody({ title: 'Replay after delete' }), deletedKey).expect(201)).body.data;
        await deleteProject(owner, doomedReplay.id, { confirmed: true }, '"1"').expect(204);
        const afterDelete = await createProject(owner, projectBody({ title: 'Replay after delete' }), deletedKey).expect(201).expect('ETag', '"1"');
        assert.deepEqual(afterDelete.body.data, doomedReplay, 'a deleted Project still replays its original answer');
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.calendar_projects WHERE id=$1', [doomedReplay.id])).rows[0].count, '0',
          'the replay must not resurrect the deleted Project');
      });

      await check('two concurrent mutations on one version commit exactly once', async () => {
        const racing = (await createProject(owner, projectBody({ title: 'Race calendar' })).expect(201)).body.data;
        assert.equal(racing.version, 1);

        // Two writers carry the same precondition; the row lock serializes them.
        const [left, right] = await Promise.all([
          patchProject(owner, racing.id, { title: 'Race A' }, '"1"'),
          patchProject(owner, racing.id, { title: 'Race B' }, '"1"'),
        ]);
        assert.deepEqual([left.status, right.status].sort((a, b) => a - b), [200, 412],
          'exactly one writer commits and the other sees a version conflict');
        const loser = left.status === 200 ? right : left;
        assert.deepEqual({ code: loser.body.error.code, currentVersion: loser.body.error.currentVersion, retryable: loser.body.error.retryable },
          { code: 'VERSION_CONFLICT', currentVersion: 2, retryable: false });
        const stored = (await runtime.query('SELECT title,version FROM lumical.calendar_projects WHERE id=$1', [racing.id])).rows[0];
        assert.equal(stored.version, 2, 'the version advances exactly once');
        assert.equal(stored.title, (left.status === 200 ? left : right).body.data.title, 'no lost update: the row is the winner');

        // A second race across mutation kinds on the next version.
        const etag = left.status === 200 ? left.headers.etag : right.headers.etag;
        const [patched, archived] = await Promise.all([
          patchProject(owner, racing.id, { title: 'Race C' }, etag),
          archiveProject(owner, racing.id, etag),
        ]);
        assert.deepEqual([patched.status, archived.status].sort((a, b) => a - b), [200, 412]);
        assert.equal(archived.status === 200 ? patched.status : archived.status, 412);
        const row = (await runtime.query('SELECT title,status,version FROM lumical.calendar_projects WHERE id=$1', [racing.id])).rows[0];
        assert.equal(row.version, 3, 'the second race also advances the version once');
        if (patched.status === 200)
          assert.deepEqual({ title: row.title, status: row.status }, { title: 'Race C', status: 'WORKING' });
        else
          assert.deepEqual({ title: row.title, status: row.status }, { title: stored.title, status: 'ARCHIVED' });
        const survivor = patched.status === 200 ? patched : archived;
        assert.equal(survivor.body.data.version, 3);
      });

      await check('future-year creation does not advance an existing calendar or share its Months', async () => {
        const following = (await createProject(owner, projectBody({ year: year + 1, title: 'Following year' })).expect(201)).body.data;
        assert.equal(following.year, year + 1);
        assert.notEqual(following.id, project.id);
        const current = await getProject(owner, project.id).expect(200);
        assert.equal(current.body.data.year, year, 'the prior year never changes');
        const rows = (await runtime.query(`SELECT project_id, count(*)::int AS total,
          count(DISTINCT month_number)::int AS unique_months, min(month_number) AS first_month,
          max(month_number) AS last_month FROM lumical.calendar_months
          WHERE project_id IN ($1,$2) GROUP BY project_id`, [project.id, following.id])).rows;
        assert.equal(rows.length, 2);
        for (const row of rows) {
          assert.deepEqual({ total: row.total, unique: row.unique_months, first: row.first_month, last: row.last_month },
            { total: 12, unique: 12, first: 1, last: 12 });
        }
        await getProject(other, following.id).expect(404);
        await monthsOf(other, following.id).expect(404);
      });

      await check('delete needs confirmation, refuses Order history and cleans project rows only', async () => {
        const doomed = (await createProject(owner, projectBody({ title: 'Doomed calendar' })).expect(201)).body.data;
        const ordered = (await createProject(owner, projectBody({ title: 'Ordered calendar' })).expect(201)).body.data;
        const assetId = await mediaFixture(runtime, ownerId);
        const monthRow = (await runtime.query('SELECT id FROM lumical.calendar_months WHERE project_id=$1 AND month_number=1', [doomed.id])).rows[0];
        await runtime.query(
          `INSERT INTO lumical.project_month_media (id,project_id,owner_id,month_id,asset_id,position,alt_text)
           VALUES ($1,$2,$3,$4,$5,1,'TEST ONLY')`, [randomUUID(), doomed.id, ownerId, monthRow.id, assetId]);
        const orderId = await orderFixture(runtime, ordered.id, ownerId);
        await runtime.query("UPDATE lumical.orders SET status='CANCELLED' WHERE id=$1", [orderId]);
        const historyBefore = (await runtime.query('SELECT * FROM lumical.orders WHERE id=$1', [orderId])).rows;
        const before = await ownerProjects();

        // BR-PRJ-006: explicit confirmation first, then the precondition, then history.
        const unconfirmed = await deleteProject(owner, doomed.id, {}, '"1"').expect(422);
        assert.deepEqual(unconfirmed.body.error.fieldErrors.map(field => field.path), ['confirmed']);
        await deleteProject(owner, doomed.id, { confirmed: false }, '"1"').expect(422);
        await deleteProject(other, doomed.id, { confirmed: true }, '"1"').expect(404);
        const stale = await deleteProject(owner, doomed.id, { confirmed: true }, '"9"').expect(412);
        assert.equal(stale.body.error.currentVersion, 1);
        const ordered_refusal = await deleteProject(owner, ordered.id, { confirmed: true }, '"1"').expect(409);
        assert.deepEqual({ code: ordered_refusal.body.error.code, messageKey: ordered_refusal.body.error.messageKey, retryable: ordered_refusal.body.error.retryable },
          { code: 'PROJECT_HAS_ORDERS', messageKey: 'errors.projectHasOrders', retryable: false });
        assert.equal((await getProject(owner, ordered.id).expect(200)).body.data.deletionEligible, false,
          'detail eligibility reflects trusted order history, including non-deletable Projects');
        const orderedEdit = await patchProject(owner, ordered.id, { title: 'Working remains editable after cancelled Order' }, '"1"').expect(200);
        assert.equal(orderedEdit.body.data.version, 2);
        await deleteProject(owner, ordered.id, { confirmed: true }, '"2"').expect(409);
        assert.deepEqual((await runtime.query('SELECT * FROM lumical.orders WHERE id=$1', [orderId])).rows, historyBefore,
          'edits and refused deletion must preserve cancelled financial history');
        assert.equal(await ownerProjects(), before, 'a refused deletion must not remove a Project');
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.orders WHERE project_id=$1', [ordered.id])).rows[0].count, '1');

        await deleteProject(owner, doomed.id, { confirmed: true }, '"1"').expect(204);
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.calendar_projects WHERE id=$1', [doomed.id])).rows[0].count, '0');
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.calendar_months WHERE project_id=$1', [doomed.id])).rows[0].count, '0',
          'the twelve Months go with their Project');
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.project_month_media WHERE project_id=$1', [doomed.id])).rows[0].count, '0',
          'project-scoped media links go too');
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.media_assets WHERE id=$1', [assetId])).rows[0].count, '1',
          'the owned media asset belongs to the account, not to the Project');
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.calendar_projects WHERE id=$1', [ordered.id])).rows[0].count, '1');
        // Financial history is never app-deleted: the Order's checkout intent stays.
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.checkout_intents WHERE project_id=$1', [ordered.id])).rows[0].count, '1');
        await getProject(owner, doomed.id).expect(404);
        await monthsOf(owner, doomed.id).expect(404);
        const remaining = await listProjects(owner).expect(200);
        assert.equal(remaining.body.data.some(item => item.id === doomed.id), false);
        assert.equal(remaining.body.data.some(item => item.id === ordered.id), true);
        // Deleting twice is a safe 404, not a second write.
        await deleteProject(owner, doomed.id, { confirmed: true }, '"1"').expect(404);
      });

      await check('inactive Template blocks new Projects while captured owner baseline survives', async () => {
        const before = (await getProject(owner, project.id).expect(200)).body.data;
        const templateState = (await runtime.query('SELECT version FROM lumical.templates WHERE id=$1', [templateId])).rows[0];
        const availability = (value, version) => api().put(`/api/v1/admin/templates/${templateId}/availability`)
          .set('Origin', origin).set('Cookie', admin.cookie).set('X-CSRF-Token', admin.csrf)
          .set('Idempotency-Key', randomUUID()).set('If-Match', `"${version}"`)
          .send({ availability: value, reason: 'TEST ONLY I05-P06 baseline survival' });
        await availability('INACTIVE', templateState.version).expect(200);
        try {
          const refused = await createProject(owner, projectBody({ title: 'Must not create' })).expect(409);
          assert.equal(refused.body.error.code, 'TEMPLATE_UNAVAILABLE');
          const existing = (await getProject(owner, project.id).expect(200)).body.data;
          assert.deepEqual(existing.baseline, before.baseline);
          assert.equal(existing.version, before.version);
          const months = await monthsOf(owner, project.id).expect(200);
          assert.deepEqual(months.body.data.months.map(month => month.monthNumber),
            Array.from({ length: 12 }, (_, index) => index + 1));
          const revised = await patchProject(owner, project.id, { title: 'Available despite retired template' }, `"${before.version}"`).expect(200);
          assert.equal(revised.body.data.version, before.version + 1);
          assert.deepEqual(revised.body.data.baseline, before.baseline);
        } finally {
          const current = (await runtime.query('SELECT version FROM lumical.templates WHERE id=$1', [templateId])).rows[0];
          await availability('ACTIVE', current.version).expect(200);
        }
      });

      if (process.env.LUMICAL_I05_LIVE_UI === '1' || process.env.LUMICAL_I05_MANUAL_UI === '1') {
        const uiCheck = process.env.LUMICAL_I05_MANUAL_UI === '1'
          ? 'I05 disposable manual fixture cleanup only; manual acceptance recorded separately'
          : 'I05 live Chromium through Next.js, Nest and disposable PostgreSQL';
        await check(uiCheck, async () => {
          const beforeUiNow = now;
          // Product zone has entered 2027 while America/Los_Angeles is in 2026.
          now = new Date('2026-12-31T17:00:00.000Z');
          await app.close();
          process.env.NODE_ENV = 'development';
          process.env.IDENTITY_COOKIE_MODE = 'loopback';
          process.env.IDENTITY_ALLOWED_ORIGINS = 'http://127.0.0.1:3211';
          await start();
          await app.listen(0, '127.0.0.1');
          // I09 is absent: this is explicitly a schema-history fixture, never an Order API claim.
          // Supertest mutations above use the HTTPS Origin, so seed this one root via
          // the same real application with the live Origin rather than a database shortcut.
          const liveOrigin = 'http://127.0.0.1:3211';
          const loginResponse = await api().post('/api/v1/auth/login').set('Origin', liveOrigin)
            .send({ email: 'owner@example.invalid', password }).expect(200);
          owner = { cookie: cookie(loginResponse), csrf: loginResponse.body.data.csrfToken, id: loginResponse.body.data.id };
          const fixture = await api().post('/api/v1/projects').set('Origin', liveOrigin).set('Cookie', owner.cookie)
            .set('X-CSRF-Token', owner.csrf).set('Idempotency-Key', randomUUID())
            .send(projectBody({ title: 'I05 live ordered fixture' })).expect(201);
          const orderedId = fixture.body.data.id;
          const orderId = await orderFixture(runtime, orderedId, ownerId);
          await runtime.query("UPDATE lumical.orders SET status='CANCELLED' WHERE id=$1", [orderId]);
          const frontend = fileURLToPath(new URL('../../frontend/', import.meta.url));
          const env = { ...originalEnv, NODE_ENV: 'test', LUMICAL_I05_LIVE_BACKEND: await app.getUrl(),
            LUMICAL_I05_TEMPLATE_ID: templateId, LUMICAL_I05_ORDERED_ID: orderedId,
            LUMICAL_I05_CALENDAR_YEAR: '2027', LUMICAL_I05_BOUNDARY_TIME: now.toISOString() };
          delete env.DATABASE_URL; delete env.MIGRATION_DATABASE_URL;
          try {
            if (process.env.LUMICAL_I05_MANUAL_UI === '1') {
              const directory = new URL('../../.cache/i05-hardening/', import.meta.url);
              await mkdir(directory, { recursive: true });
              const stopFile = fileURLToPath(new URL(`manual-${randomUUID()}.stop`, directory));
              const manual = execFile(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3211'], {
                cwd: frontend, env: { ...env, NODE_ENV: 'development', ACCOUNT_COOKIE_NAME: 'lumical_session_dev', BACKEND_URL: await app.getUrl() },
              });
              manual.stdout.on('data', chunk => process.stdout.write(chunk));
              manual.stderr.on('data', chunk => process.stderr.write(chunk));
              manual.on('error', () => { /* Exit/readiness is checked below. */ });
              try {
                const session = { origin: liveOrigin, projectUrl: `${liveOrigin}/projects/${orderedId}`, templateId, stopFile,
                  ownerEmail: 'owner@example.invalid', fixtureOnly: true };
                await writeFile(new URL('manual-session.json', directory), JSON.stringify(session, null, 2));
                console.log(`MANUAL: disposable fixture ready; session metadata is in .cache/i05-hardening/manual-session.json`);
                const deadline = Date.now() + 15 * 60_000;
                for (;;) {
                  if (await access(stopFile).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; })) break;
                  if (Date.now() > deadline || manual.exitCode !== null) throw new Error('Manual fixture expired or frontend exited.');
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              } finally {
                if (manual.exitCode === null) {
                  if (process.platform === 'win32') await promisify(execFile)('taskkill', ['/PID', String(manual.pid), '/T', '/F']);
                  else manual.kill('SIGTERM');
                }
              }
              console.log('PASS: manual fixture session completed and its frontend stopped (manual outcomes recorded separately).');
            } else {
              const browserRun = promisify(execFile)(process.execPath,
                ['node_modules/@playwright/test/cli.js', 'test', '--project=i05-live-chromium', '--workers=1'],
                { cwd: frontend, env, timeout: 240_000, maxBuffer: 4 * 1024 * 1024 });
              browserRun.child.stdout.on('data', chunk => process.stdout.write(chunk));
              browserRun.child.stderr.on('data', chunk => process.stderr.write(chunk));
              await browserRun;
            }
          } catch (error) {
            throw new Error(`I05 live Chromium failed (${error.code ?? 'runner error'}).`);
          } finally {
            await app.close();
            now = beforeUiNow;
            process.env.NODE_ENV = 'production'; process.env.IDENTITY_COOKIE_MODE = 'https';
            process.env.IDENTITY_ALLOWED_ORIGINS = origin;
            await start(); owner = await session('owner@example.invalid');
          }
        });
      }

      await check('controlled Clock advances a year: old Projects stay readable/editable and creation replay stays original', async () => {
        const body = projectBody({ year: 2026, title: 'Created before year advance' });
        const key = randomUUID();
        const original = (await createProject(owner, body, key).expect(201)).body.data;
        now = new Date('2027-01-01T05:00:00.000Z');
        // Renew the genuinely expired session; project validity is independent of session lifetime.
        owner = await session('owner@example.invalid');
        assert.equal((await getProject(owner, original.id).expect(200)).body.data.year, 2026);
        assert.equal((await monthsOf(owner, original.id).expect(200)).body.data.months.length, 12);
        await patchProject(owner, original.id, { title: 'Still editable in 2027' }, '"1"').expect(200);
        assert.deepEqual((await createProject(owner, body, key).expect(201)).body.data, original);
        const refused = await createProject(owner, body).expect(422);
        assert.equal(refused.body.error.fieldErrors[0].path, 'year');
      });

      await check('legacy P02 intent without a safe body fails closed and never duplicates or reconstructs a changed Project', async () => {
        const body = projectBody({ title: 'Legacy replay characterization' });
        const key = randomUUID();
        const created = (await createProject(owner, body, key).expect(201)).body.data;
        await patchProject(owner, created.id, { title: 'Changed since the legacy creation' }, '"1"').expect(200);
        await runtime.query("UPDATE lumical.idempotency_records SET safe_result=NULL WHERE actor_id=$1 AND operation='PROJECT_CREATE' AND key=$2", [ownerId, key]);
        const before = await ownerProjects();
        const replay = await createProject(owner, body, key).expect(500);
        assert.equal(replay.body.error.code, 'INTERNAL_ERROR');
        assert.equal(await ownerProjects(), before);
        const unchanged = (await getProject(owner, created.id).expect(200)).body.data;
        assert.equal(unchanged.version, 2);
        assert.equal(unchanged.title, 'Changed since the legacy creation');
        // Characterization of a migration/rollout gap, NOT a claim that legacy replay meets §11.
      });

      await check('D02 read-only inventory classifies the legacy fixture without changing replay records', async () => {
        const fingerprint = async () => (await runtime.query(`SELECT count(*) AS count,
          md5(string_agg(id::text || condition || coalesce(safe_result::text, 'SQL_NULL'), '|' ORDER BY id)) AS digest
          FROM lumical.idempotency_records WHERE operation='PROJECT_CREATE'`)).rows[0];
        const before = await fingerprint();
        const sql = await readFile(new URL('./inventory-project-replay.sql', import.meta.url), 'utf8');
        const results = await runtime.query(sql);
        const snapshot = results.find(result => result.fields.some(field => field.name === 'transaction_read_only')).rows[0];
        assert.equal(snapshot.transaction_read_only, 'on');
        const counts = results.find(result => result.fields.some(field => field.name === 'sql_null_records')).rows[0];
        assert.equal(Number(counts.sql_null_records), 1, 'only this run\'s explicit legacy fixture has SQL NULL');
        assert.ok(Number(counts.object_records) > 0);
        const groups = results.find(result => result.fields.some(field => field.name === 'payload_class')).rows;
        assert.ok(groups.some(row => row.payload_class === 'SQL_NULL' && row.resource_class === 'ROOT_CHANGED'));
        assert.deepEqual(await fingerprint(), before);
        assert.equal((await runtime.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'off');
        console.log(JSON.stringify({ inventoryScope: 'DISPOSABLE_FIXTURE_ONLY', sqlNullRecords: Number(counts.sql_null_records),
          objectRecords: Number(counts.object_records), totalRecords: Number(counts.total_records), readOnly: true, unchanged: true }));
        // This is disposable fixture evidence, never inventory of a deployed environment.
      });
    } finally {
      if (app) await app.close();
      await runtime.end();
      await migration.end();
    }
  });
} finally {
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
}
