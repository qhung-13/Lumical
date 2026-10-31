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
  name: { vi: over.nameVi ?? 'Lịch mùa xuân', en: over.nameEn ?? 'Spring calendar' },
  description: { vi: 'Mô tả', en: 'Description' },
  layout: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 },
  presets: [{ id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } }],
  price: { currency: 'USD', unitPriceMinor: 1450 },
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
    process.env.DATABASE_URL = url('runtime', 'lumical_i01_blank');
    await promisify(execFile)(process.execPath, ['scripts/prisma.mjs', 'migrate', 'deploy'], {
      cwd: backend, env: { ...process.env, MIGRATION_DATABASE_URL: url('migration', 'lumical_i01_blank') }, maxBuffer: 2 * 1024 * 1024,
    });
    const runtime = await connect(process.env.DATABASE_URL);
    const migration = await connect(url('migration', 'lumical_i01_blank'));
    let app;
    const start = async () => {
      const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const record = value => logs.push(String(value));
      app = module.createNestApplication({ logger: { log: record, warn: record, error: record, debug: record, verbose: record } });
      configureApp(app); await app.init();
    };
    const api = () => request(app.getHttpServer());
    const register = email => api().post('/api/v1/auth/register').set('Origin', origin).set('Idempotency-Key', randomUUID()).send({ email, password });
    const login = email => api().post('/api/v1/auth/login').set('Origin', origin).send({ email, password });
    const create = (actor, body, key = randomUUID()) => api().post('/api/v1/admin/templates')
      .set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf).set('Idempotency-Key', key).send(body);
    const list = (actor, query = '') => api().get(`/api/v1/admin/templates${query}`).set('Cookie', actor.cookie);
    const publish = (actor, id, body, etag, key = randomUUID()) => api().post(`/api/v1/admin/templates/${id}/revisions`)
      .set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf)
      .set('Idempotency-Key', key).set('If-Match', etag).send(body);
    const availability = (actor, id, body, etag, key = randomUUID()) => api().put(`/api/v1/admin/templates/${id}/availability`)
      .set('Origin', origin).set('Cookie', actor.cookie).set('X-CSRF-Token', actor.csrf)
      .set('Idempotency-Key', key).set('If-Match', etag).send(body);
    const catalog = () => api().get('/api/v1/templates').set('Origin', origin);
    const listed = async id => (await catalog().expect(200)).body.data.some(item => item.id === id);
    const auditCount = async (action, id) => (await runtime.query(
      'SELECT count(*) FROM lumical.admin_audit_events WHERE action=$1 AND target_id=$2', [action, id])).rows[0].count;

    try {
      await start();
      const operatorAuth = await register('operator@example.invalid').expect(201);
      const operatorId = operatorAuth.body.data.id;
      await migration.query("UPDATE lumical.users SET role='ADMIN' WHERE id=$1", [operatorId]);
      const operatorSession = await login('operator@example.invalid').expect(200);
      const operator = { cookie: cookie(operatorSession), csrf: operatorSession.body.data.csrfToken };
      await register('member@example.invalid').expect(201);
      const memberSession = await login('member@example.invalid').expect(200);
      const member = { cookie: cookie(memberSession), csrf: memberSession.body.data.csrfToken };
      let id;
      const createKey = randomUUID();

      await check('create persists an INACTIVE template, its first immutable revision and a flat preset row', async () => {
        const response = await create(operator, { category: 'GENERAL', revision: revision() }, createKey).expect(201).expect('ETag', '"1"');
        id = response.body.data.id;
        const data = response.body.data;
        assert.deepEqual({ category: data.category, availability: data.availability, version: data.version, publishedRevision: data.publishedRevision },
          { category: 'GENERAL', availability: 'INACTIVE', version: 1, publishedRevision: 1 });
        assert.equal(typeof data.currentPublishedRevisionId, 'string');
        const row = (await runtime.query('SELECT category,availability,version,current_published_revision_id FROM lumical.templates WHERE id=$1', [id])).rows[0];
        assert.deepEqual({ category: row.category, availability: row.availability, version: row.version },
          { category: 'GENERAL', availability: 'INACTIVE', version: 1 });
        assert.equal(row.current_published_revision_id, data.currentPublishedRevisionId);
        const revisions = (await runtime.query('SELECT revision,style_presets FROM lumical.template_revisions WHERE template_id=$1 ORDER BY revision', [id])).rows;
        assert.equal(revisions.length, 1);
        assert.equal(revisions[0].revision, 1);
        // Regression: a nested { id, name: { vi, en } } pair is invisible to P01's SQL filter.
        assert.deepEqual(revisions[0].style_presets, [{ id: 'classic', nameVi: 'Cổ điển', nameEn: 'Classic' }]);
        assert.equal(await listed(id), false, 'an INACTIVE template must not be servable');
        assert.equal((await runtime.query("SELECT count(*) FROM lumical.admin_audit_events WHERE action='TEMPLATE_CREATED' AND target_id=$1", [id])).rows[0].count, '1');
      });

      await check('unauthenticated, non-Admin, CSRF-less and cross-Origin mutations are refused without a write', async () => {
        const before = (await runtime.query('SELECT count(*) FROM lumical.templates')).rows[0].count;
        await api().get('/api/v1/admin/templates').expect(401);
        await api().post('/api/v1/admin/templates').set('Origin', origin).set('Idempotency-Key', randomUUID())
          .send({ category: 'GENERAL', revision: revision() }).expect(401);
        // The operational list is an Admin-only read: a Member sees the safe 403, not a partial page.
        await list(member).expect(403);
        await create(member, { category: 'GENERAL', revision: revision() }).expect(403);
        await api().post('/api/v1/admin/templates').set('Origin', origin).set('Cookie', operator.cookie)
          .set('Idempotency-Key', randomUUID()).send({ category: 'GENERAL', revision: revision() }).expect(403);
        await api().put(`/api/v1/admin/templates/${id}/availability`).set('Origin', 'https://lumical.test.evil')
          .set('Cookie', operator.cookie).set('X-CSRF-Token', operator.csrf).set('Idempotency-Key', randomUUID())
          .set('If-Match', '"1"').send({ availability: 'ACTIVE', reason: 'TEST ONLY' }).expect(403);
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.templates')).rows[0].count, before);
        assert.equal((await runtime.query("SELECT count(*) FROM lumical.admin_audit_events WHERE target_id=$1", [id])).rows[0].count, '1');
      });

      await check('If-Match is required, must be well formed, and a stale value reports the current version', async () => {
        await api().put(`/api/v1/admin/templates/${id}/availability`).set('Origin', origin).set('Cookie', operator.cookie)
          .set('X-CSRF-Token', operator.csrf).set('Idempotency-Key', randomUUID())
          .send({ availability: 'ACTIVE', reason: 'TEST ONLY' }).expect(428);
        await availability(operator, id, { availability: 'ACTIVE', reason: 'TEST ONLY' }, '1').expect(422);
        const stale = await availability(operator, id, { availability: 'ACTIVE', reason: 'TEST ONLY' }, '"9"').expect(412);
        assert.equal(stale.body.error.code, 'VERSION_CONFLICT');
        assert.equal(stale.body.error.currentVersion, 1);
        assert.equal(stale.body.error.retryable, false);
        const malformed = await create(operator, { category: 'GENERAL', revision: revision() }, 'short').expect(422);
        assert.equal(malformed.body.error.code, 'VALIDATION_FAILED');
        assert.equal(await listed(id), false);
      });

      await check('state transitions follow the table and only an ACTIVE complete template reaches P01 read path', async () => {
        const active = await availability(operator, id, { availability: 'ACTIVE', reason: 'Đã kiểm tra e\u0301' }, '"1"').expect(200).expect('ETag', '"2"');
        assert.equal(active.body.data.availability, 'ACTIVE');
        assert.equal(await listed(id), true, 'an ACTIVE complete template must be servable');
        assert.equal((await runtime.query('SELECT availability,version FROM lumical.templates WHERE id=$1', [id])).rows[0].version, 2);
        assert.equal((await runtime.query("SELECT purpose FROM lumical.admin_audit_events WHERE action='TEMPLATE_ACTIVE' AND target_id=$1", [id])).rows[0].purpose,
          'Đã kiểm tra e\u0301');
        const archived = await availability(operator, id, { availability: 'ARCHIVED', reason: 'TEST ONLY retirement' }, '"2"').expect(200).expect('ETag', '"3"');
        assert.equal(archived.body.data.availability, 'ARCHIVED');
        assert.equal(await listed(id), false, 'ARCHIVED leaves the catalog');
        // ARCHIVED is a state, not a terminal one: the authority never declared it irreversible.
        const restored = await availability(operator, id, { availability: 'ACTIVE', reason: 'TEST ONLY restore' }, '"3"').expect(200).expect('ETag', '"4"');
        assert.equal(restored.body.data.availability, 'ACTIVE');
        assert.equal(await listed(id), true);
        const noop = await availability(operator, id, { availability: 'ACTIVE', reason: 'TEST ONLY repeat' }, '"4"').expect(409);
        assert.equal(noop.body.error.code, 'INVALID_TRANSITION');
        assert.equal((await runtime.query('SELECT availability,version FROM lumical.templates WHERE id=$1', [id])).rows[0].version, 4);
      });

      await check('the Admin list is an operational cursor page filtered by state and writes no audit row', async () => {
        const second = (await create(operator, { category: 'GENERAL', revision: revision() })).body.data.id;
        // BR-ADM-001: the list is an operational view, so reading it records nothing.
        const auditsBefore = (await runtime.query('SELECT count(*) FROM lumical.admin_audit_events')).rows[0].count;
        const active = await list(operator, '?state=ACTIVE').expect(200);
        assert.deepEqual(active.body.data.map(item => item.id), [id], 'the state filter is allowlisted and exact');
        assert.deepEqual(active.body.meta, { nextCursor: null, hasMore: false });
        const inactive = await list(operator, '?state=INACTIVE').expect(200);
        assert.deepEqual(inactive.body.data.map(item => item.id), [second]);
        // API contract §7: walk the whole list one row at a time; the cursor must advance
        // without repeating or skipping a row.
        const seen = [];
        let cursor;
        for (let page = 0; page < 5; page += 1) {
          const response = await list(operator, cursor ? `?limit=1&cursor=${encodeURIComponent(cursor)}` : '?limit=1').expect(200);
          assert.equal(response.body.data.length, 1, 'a limit of one returns one row');
          seen.push(response.body.data[0].id);
          cursor = response.body.meta.nextCursor;
          if (!cursor) { assert.equal(response.body.meta.hasMore, false, 'the final page carries no cursor'); break; }
          assert.equal(response.body.meta.hasMore, true);
        }
        assert.equal(new Set(seen).size, seen.length, 'a cursor must never repeat a row');
        assert.deepEqual([...seen].sort(), [id, second].sort(), 'paging must cover every template exactly once');
        // The projection exposes availability only — no ordering column and no raw revision payload.
        for (const item of active.body.data.concat(inactive.body.data)) {
          assert.deepEqual(Object.keys(item).sort(),
            ['availability', 'category', 'currentPublishedRevisionId', 'id', 'publishedRevision', 'version']);
        }
        // Limit and state are validated in the domain, not silently clamped.
        for (const query of ['?limit=0', '?limit=51', '?limit=1.5', '?limit=many', '?state=PAUSED', '?state=active',
          '?cursor=not-a-cursor', '?cursor=']) {
          const rejected = await list(operator, query).expect(422);
          assert.equal(rejected.body.error.code, 'VALIDATION_FAILED');
          assert.equal(rejected.body.error.retryable, false);
        }
        // Regression: `?cursor=` used to be collapsed into "absent" and silently served page one.
        assert.equal((await list(operator, '?cursor=')).body.error.fieldErrors[0].path, 'cursor');
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.admin_audit_events')).rows[0].count, auditsBefore,
          'an operational read must not append to the audit trail');
      });

      await check('a corrupt stored publication blocks activation with the contract conflict until it is repaired', async () => {
        const fragile = (await create(operator, { category: 'GENERAL', revision: revision() })).body.data.id;
        // The create above is the only intent so far; the refusal below must add nothing to either log.
        const auditsBefore = (await runtime.query('SELECT count(*) FROM lumical.admin_audit_events WHERE target_id=$1', [fragile])).rows[0].count;
        const replaysBefore = (await runtime.query('SELECT count(*) FROM lumical.idempotency_records WHERE resource_id=$1', [fragile])).rows[0].count;
        // Corrupt the stored preset shape behind the application's back. The copy CHECK constraint
        // refuses a blank name at the database, so the JSONB preset row is the shape a bad write
        // can actually reach — and the exact one P01's projector cannot read (regression bug 1).
        await migration.query(
          `UPDATE lumical.template_revisions SET style_presets='[{"id":"classic","name":{"vi":"Cổ điển","en":"Classic"}}]'::jsonb
           WHERE template_id=$1`, [fragile]);
        const refused = await availability(operator, fragile, { availability: 'ACTIVE', reason: 'TEST ONLY corrupt' }, '"1"').expect(409);
        assert.equal(refused.body.error.code, 'INCOMPLETE_PUBLICATION');
        assert.equal(refused.body.error.messageKey, 'errors.incompletePublication');
        assert.equal(refused.body.error.retryable, false);
        // §9: a conflict with stored state changes nothing and records nothing.
        assert.deepEqual((await runtime.query('SELECT availability,version FROM lumical.templates WHERE id=$1', [fragile])).rows[0],
          { availability: 'INACTIVE', version: 1 });
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.admin_audit_events WHERE target_id=$1', [fragile])).rows[0].count,
          auditsBefore, 'the refused activation must not append an audit row');
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.idempotency_records WHERE resource_id=$1', [fragile])).rows[0].count,
          replaysBefore, 'nor an idempotency record that would replay a change that never happened');
        assert.equal(await listed(fragile), false, 'an unpublished template is invisible to the public catalog');
        // Repairing the stored row is what unblocks it: the refusal was about state, not the request body.
        await migration.query(
          `UPDATE lumical.template_revisions SET style_presets='[{"id":"classic","nameVi":"Cổ điển","nameEn":"Classic"}]'::jsonb
           WHERE template_id=$1`, [fragile]);
        const activated = await availability(operator, fragile, { availability: 'ACTIVE', reason: 'TEST ONLY repaired' }, '"1"').expect(200);
        assert.equal(activated.body.data.availability, 'ACTIVE');
        assert.equal(await listed(fragile), true);
      });

      await check('publishing adds an immutable numbered revision, moves the pointer and never rewrites history', async () => {
        const before = (await runtime.query('SELECT id,revision,name_en,style_presets FROM lumical.template_revisions WHERE template_id=$1', [id])).rows;
        const published = await publish(operator, id, { revision: revision({ nameVi: 'Lịch mùa hạ', nameEn: 'Summer calendar' }) }, '"4"').expect(201).expect('ETag', '"5"');
        assert.deepEqual({ version: published.body.data.version, publishedRevision: published.body.data.publishedRevision },
          { version: 5, publishedRevision: 2 });
        const after = (await runtime.query('SELECT id,revision,name_en,style_presets FROM lumical.template_revisions WHERE template_id=$1 ORDER BY revision', [id])).rows;
        assert.equal(after.length, 2);
        assert.deepEqual(after[0], before[0], 'the previously published row must be untouched');
        assert.equal(after[1].revision, 2);
        assert.equal(after[1].name_en, 'Summer calendar');
        assert.equal((await runtime.query('SELECT current_published_revision_id,version FROM lumical.templates WHERE id=$1', [id])).rows[0].current_published_revision_id,
          published.body.data.currentPublishedRevisionId);
        assert.equal((await auditCount('TEMPLATE_PUBLISHED', id)), '1');
        const served = (await catalog().expect(200)).body.data.find(item => item.id === id);
        assert.equal(served.publishedRevision.version, 2, 'the read side must serve the newest revision');
      });

      await check('a reused key replays one outcome; a changed body under that key is refused; one audit row', async () => {
        const publishKey = randomUUID();
        const auditsBefore = await auditCount('TEMPLATE_PUBLISHED', id);
        const first = await publish(operator, id, { revision: revision() }, '"5"', publishKey).expect(201);
        assert.equal(first.body.data.version, 6);
        assert.equal(await auditCount('TEMPLATE_PUBLISHED', id), String(Number(auditsBefore) + 1));
        const retry = await publish(operator, id, { revision: revision() }, '"5"', publishKey).expect(201);
        assert.deepEqual(retry.body, first.body);
        assert.equal(retry.headers.etag, first.headers.etag);
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.template_revisions WHERE template_id=$1', [id])).rows[0].count, '3',
          'a replay must not create a second revision');
        assert.equal(await auditCount('TEMPLATE_PUBLISHED', id), String(Number(auditsBefore) + 1),
          'a replay must not add an audit row');
        const changed = await publish(operator, id, { revision: revision({ nameEn: 'Different' }) }, '"5"', publishKey).expect(409);
        assert.equal(changed.body.error.code, 'IDEMPOTENCY_CONFLICT');
        const fresh = await publish(operator, id, { revision: revision() }, '"5"', randomUUID()).expect(412);
        assert.equal(fresh.body.error.currentVersion, 6);
        const replay = (await runtime.query('SELECT request_digest,safe_result,encrypted_replay,replay_expires_at FROM lumical.idempotency_records WHERE key=$1', [publishKey])).rows;
        assert.equal(replay.length, 1);
        assert.equal(replay[0].encrypted_replay, null, 'the safe body carries no secret to encrypt');
        assert.equal(replay[0].replay_expires_at, null, 'availability outcomes are deduplicated permanently');
        assert.equal(JSON.stringify(replay[0].safe_result).includes(password), false);
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.templates WHERE id=$1', [id])).rows[0].count, '1');
      });

      await check('two concurrent requests sharing one Idempotency-Key commit exactly one mutation', async () => {
        const key = randomUUID();
        const payload = { category: 'GENERAL', revision: revision() };
        const before = {
          templates: Number((await runtime.query('SELECT count(*) FROM lumical.templates')).rows[0].count),
          audits: Number((await runtime.query('SELECT count(*) FROM lumical.admin_audit_events')).rows[0].count),
        };
        // Without a barrier these two calls simply run one after the other and the second one just
        // replays — which proves nothing. Holding an ACCESS EXCLUSIVE lock on the table both must
        // insert into parks both transactions mid-flight, after the replay check and before the
        // idempotency record exists. Releasing it releases them together, so they genuinely race.
        //
        // The barrier is verified by observing that neither call has settled while the lock is
        // held. Reading wait_event_type from pg_stat_activity cannot do this: the migration role
        // cannot see another backend's wait state, so that query reports zero no matter what.
        const left = create(operator, payload, key);
        const right = create(operator, payload, key);
        const settled = { left: false, right: false };
        left.then(() => { settled.left = true; }, () => { settled.left = true; });
        right.then(() => { settled.right = true; }, () => { settled.right = true; });
        await migration.query('BEGIN');
        try {
          await migration.query('LOCK TABLE lumical.templates IN ACCESS EXCLUSIVE MODE');
          await new Promise((resolve) => setTimeout(resolve, 1200));
          assert.deepEqual(settled, { left: false, right: false },
            'both requests must still be in flight while the barrier is held');
        } finally {
          await migration.query('COMMIT');
        }
        const responses = await Promise.all([left, right]);
        const statuses = responses.map((response) => response.status).sort((a, b) => a - b);
        const after = {
          templates: Number((await runtime.query('SELECT count(*) FROM lumical.templates')).rows[0].count),
          audits: Number((await runtime.query('SELECT count(*) FROM lumical.admin_audit_events')).rows[0].count),
        };
        // The invariant that must hold however the race lands: one mutation, not two.
        assert.equal(after.templates - before.templates, 1, 'exactly one template may be created');
        assert.equal(after.audits - before.audits, 1, 'exactly one audit row may be written');
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.idempotency_records WHERE key=$1', [key])).rows[0].count, '1',
          'exactly one idempotency record may exist');
        assert.ok(statuses.includes(201), 'the winning request must report 201');
        const winner = responses.find((response) => response.status === 201);
        const loser = responses.find((response) => response !== winner);
        console.log(`      ↳ kết quả đua thật: ${statuses.join(' + ')} · người thua: ${loser.status} ${loser.body?.error?.code ?? '(trả bản lưu)'}`);
        // A caller that lost the write must still be served the winner's stored outcome — never a
        // bare conflict that makes it retry a mutation that already happened.
        assert.equal(loser.status, 201, 'the loser must be served the stored outcome, not an error');
        assert.deepEqual(loser.body, winner.body, 'a replayed request must return the stored body');
      });

      await check('audit insertion failure rolls back the availability change and its idempotency record', async () => {
        const key = randomUUID();
        const before = (await runtime.query('SELECT availability,version FROM lumical.templates WHERE id=$1', [id])).rows[0];
        const audits = (await runtime.query('SELECT count(*) FROM lumical.admin_audit_events WHERE target_id=$1', [id])).rows[0].count;
        await migration.query('REVOKE INSERT ON lumical.admin_audit_events FROM lumical_runtime');
        try { await availability(operator, id, { availability: 'ARCHIVED', reason: 'TEST ONLY rollback' }, '"6"', key).expect(503); }
        finally { await migration.query('GRANT INSERT ON lumical.admin_audit_events TO lumical_runtime'); }
        assert.deepEqual((await runtime.query('SELECT availability,version FROM lumical.templates WHERE id=$1', [id])).rows[0], before,
          'a failed audit must leave no orphaned state change');
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.idempotency_records WHERE key=$1', [key])).rows[0].count, '0');
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.admin_audit_events WHERE target_id=$1', [id])).rows[0].count, audits);
        assert.equal(await listed(id), true);
      });

      await check('only the current revision pointer survives and the audit trail records every operator intent', async () => {
        const rows = (await runtime.query(
          'SELECT action,outcome,purpose,target_type FROM lumical.admin_audit_events WHERE target_id=$1 ORDER BY created_at,id', [id])).rows;
        assert.deepEqual(rows.map(row => row.action),
          ['TEMPLATE_CREATED', 'TEMPLATE_ACTIVE', 'TEMPLATE_ARCHIVED', 'TEMPLATE_ACTIVE', 'TEMPLATE_PUBLISHED', 'TEMPLATE_PUBLISHED']);
        for (const row of rows) {
          assert.equal(row.outcome, 'SUCCEEDED');
          assert.equal(row.target_type, 'TEMPLATE');
          assert.ok(row.purpose.trim().length > 0, 'every mutation records why it happened');
        }
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.admin_audit_events WHERE target_id=$1 AND actor_id<>$2', [id, operatorId])).rows[0].count, '0');
        assert.equal((await runtime.query("SELECT count(*) FROM lumical.users WHERE id=$1 AND role='ADMIN'", [operatorId])).rows[0].count, '1');
      });
    } finally { await app?.close(); await runtime.end(); await migration.end(); }
  });
  console.log('PASS: I04-P02 real PostgreSQL audited publication/availability gate.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  if (error.code === 'ERR_ASSERTION') console.error(error.stack);
  const failures = logs.filter(line => /error|exception|prisma/i.test(line)).slice(-12);
  if (failures.length) console.error(`LOGS:\n${failures.join('\n')}`);
  process.exitCode = 1;
} finally { process.env = originalEnv; }
