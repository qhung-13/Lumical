import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import request from 'supertest';
import { createServer, request as httpRequest } from 'node:http';
import { createGateway } from '../../infra/proxy.mjs';
import { withDisposablePostgres } from './disposable-postgres.mjs';
import { projectFixture, orderFixture } from '../test/database/fixtures.mjs';
const require = createRequire(import.meta.url);
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module.js');
const { configureApp } = require('../dist/config/configure-app.js');
const { ActiveAccounts, AuthAttempts, Clock, PasswordHash, IdentityRepository } = require('../dist/modules/identity/application/ports.js');
const { Transactions } = require('../dist/platform/database/application/transactions.js');
const { ScryptPasswordHash } = require('../dist/modules/identity/infrastructure/security.js');
const { DatabaseAvailability } = require('../dist/platform/database/application/database-availability.js');
const { seedSynthetic, syntheticIds } = require('../dist/platform/database/infrastructure/synthetic-seed.js');
const backend = fileURLToPath(new URL('..', import.meta.url));
const originalEnv = { ...process.env };
const password = '  TEST ONLY memory passphrase  ';
const origin = 'https://lumical.test';
const logs = [];
let instant = Date.parse('2026-10-13T00:00:00Z');
const clock = { now: () => new Date(instant) };
const advance = (ms) => { instant += ms; };
const DAY = 86400000;
const hash = new ScryptPasswordHash();
let hashGate;
let verifyGate;
let hashCalls = 0;
const passwords = {
  hash: async value => { hashCalls++; const result = await hash.hash(value); if (hashGate) await hashGate(); return result; },
  verify: async (value, encoded) => { const result = await hash.verify(value, encoded); if (verifyGate) await verifyGate(); return result; },
};
function gate() {
  let arrive, release;
  return { arrived: new Promise(resolve => { arrive = resolve; }), wait: new Promise(resolve => { release = resolve; }), arrive: () => arrive(), release: () => release() };
}
async function check(name, work) { await work(); console.log(`PASS: ${name}`); }
function cookie(response) { return response.headers['set-cookie'][0].split(';')[0]; }
function secret(value) { return value.split('=')[1]; }
function safeFailure(response) { return { status: response.status, code: response.body.error.code, messageKey: response.body.error.messageKey, fields: response.body.error.fieldErrors }; }
async function connect(url) { const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 }); await client.connect(); return client; }

try {
  await withDisposablePostgres(async ({ url }) => {
    process.env.NODE_ENV = 'production'; process.env.IDENTITY_COOKIE_MODE = 'https';
    process.env.IDENTITY_SECRET_KEY = randomBytes(32).toString('hex'); process.env.IDENTITY_ALLOWED_ORIGINS = origin;
    process.env.IDENTITY_AUTH_ATTEMPTS = '1000'; process.env.IDENTITY_AUTH_BUCKETS = '10000';
    process.env.IDENTITY_TRUSTED_PROXY_IPS = '';
    process.env.DATABASE_URL = url('runtime', 'lumical_i01_blank');
    await promisify(execFile)(process.execPath, ['scripts/prisma.mjs', 'migrate', 'deploy'], {
      cwd: backend, env: { ...process.env, MIGRATION_DATABASE_URL: url('migration', 'lumical_i01_blank') }, maxBuffer: 2 * 1024 * 1024,
    });
    const runtime = await connect(process.env.DATABASE_URL);
    const migration = await connect(url('migration', 'lumical_i01_blank'));
    let app;
    const start = async () => {
      const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(clock)
        .overrideProvider(PasswordHash).useValue(passwords).compile();
      const record = value => logs.push(String(value));
      app = module.createNestApplication({ logger: { log: record, warn: record, error: record, debug: record, verbose: record } });
      configureApp(app); await app.init();
    };
    const api = () => request(app.getHttpServer());
    const register = (email, key = randomUUID()) => api().post('/api/v1/auth/register').set('Origin', origin).set('Idempotency-Key', key).send({ email, password });
    const login = (email, supplied = password) => api().post('/api/v1/auth/login').set('Origin', origin).send({ email, password: supplied });
    const me = value => api().get('/api/v1/account/me').set('Cookie', value);
    const change = (admin, csrf, id, status, version, key = randomUUID(), restoreEligibleShares = false) => api()
      .put(`/api/v1/admin/users/${id}/account-status`).set('Cookie', admin).set('Origin', origin).set('X-CSRF-Token', csrf)
      .set('Idempotency-Key', key).set('If-Match', `"${version}"`).send({ status, reason: 'TEST ONLY operator review', restoreEligibleShares });
    try {
      await start();
      let owner; let ownerCookie; let ownerCsrf;
      await check('registration, normalized uniqueness, credential-safe Principal, keyed session/CSRF and encrypted idempotent replay', async () => {
        const key = randomUUID();
        const response = await register(' Owner@Example.invalid ', key).expect(201);
        owner = response.body.data.id; ownerCookie = cookie(response); ownerCsrf = response.body.data.csrfToken;
        assert.deepEqual(Object.keys(response.body.data).sort(), ['accountStatus','csrfToken','email','id','role']);
        assert.equal(response.body.data.role, 'USER'); assert.equal(response.body.data.email, 'owner@example.invalid');
        const retry = await register('OWNER@example.invalid', key).expect(201);
        assert.deepEqual(retry.body, response.body); assert.equal(cookie(retry), ownerCookie);
        await register(' owner@example.invalid ').expect(409);
        const users = await runtime.query('SELECT count(*) FROM lumical.users WHERE normalized_email=$1', ['owner@example.invalid']);
        assert.equal(users.rows[0].count, '1');
        const sessions = (await runtime.query('SELECT * FROM lumical.sessions WHERE user_id=$1', [owner])).rows;
        assert.equal(sessions.length, 1); assert.notEqual(sessions[0].session_digest, secret(ownerCookie)); assert.notEqual(sessions[0].csrf_digest, ownerCsrf);
        const replay = (await runtime.query('SELECT encrypted_replay FROM lumical.idempotency_records WHERE actor_id=$1', [owner])).rows[0];
        assert.equal(replay.encrypted_replay.includes(Buffer.from(secret(ownerCookie))), false);
        assert.equal(JSON.stringify(sessions).includes(secret(ownerCookie)), false);
        assert.equal(JSON.stringify(sessions).includes(ownerCsrf), false);
        await me(ownerCookie).expect(200).expect('Cache-Control', 'no-store');
      });
      await check('deployed cookie flags; public ADMIN injection and alternate recipient cookies are rejected', async () => {
        const response = await login('owner@example.invalid').expect(200);
        const flags = response.headers['set-cookie'][0];
        for (const expected of ['__Host-lumical_session=', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(flags.includes(expected));
        assert.equal(/Domain=/i.test(flags), false);
        await api().post('/api/v1/auth/register').set('Origin', origin).set('Idempotency-Key', randomUUID())
          .send({ email: 'injected@example.invalid', password, role: 'ADMIN' }).expect(422);
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.users WHERE normalized_email=$1', ['injected@example.invalid'])).rows[0].count, '0');
        await me(`__Host-lumical_recipient=${randomBytes(32).toString('base64url')}`).expect(401);
        await api().get('/api/v1/account/me').expect(401);
      });
      await check('malformed email NUL/high/low surrogates reject before hashing/persistence; valid Unicode credentials survive unchanged', async () => {
        const before = (await runtime.query('SELECT count(*) FROM lumical.users')).rows[0].count;
        const hashes = hashCalls;
        for (const bad of ['\u0000', '\ud800', '\udc00']) {
          for (const endpoint of ['register', 'login']) {
            const response = await api().post(`/api/v1/auth/${endpoint}`).set('Origin', origin).set('Idempotency-Key', randomUUID())
              .send({ email: `malformed${bad}@example.invalid`, password }).expect(422);
            assert.equal(response.body.error.code, 'VALIDATION_FAILED'); assert.equal(response.body.error.retryable, false);
            assert.equal(response.body.error.fieldErrors[0].path, 'email');
          }
        }
        assert.equal(hashCalls, hashes); assert.equal((await runtime.query('SELECT count(*) FROM lumical.users')).rows[0].count, before);
        const email = 'kýức-e\u0301@vídụ.invalid'; const unicodePassword = '  ký ức e\u0301 🙂🙂🙂🙂  ';
        const response = await api().post('/api/v1/auth/register').set('Origin', origin).set('Idempotency-Key', randomUUID())
          .send({ email, password: unicodePassword }).expect(201);
        assert.equal(response.body.data.email, email);
        const row = (await runtime.query('SELECT normalized_email,password_hash FROM lumical.users WHERE id=$1', [response.body.data.id])).rows[0];
        assert.equal(row.normalized_email, email); assert.equal(await hash.verify(unicodePassword, row.password_hash), true);
        assert.equal(await hash.verify(unicodePassword.trim(), row.password_hash), false);
        assert.equal(await hash.verify(unicodePassword.normalize('NFC'), row.password_hash), false);
        await login(email, unicodePassword).expect(200);
      });
      await check('real auth handlers reject oversized registration/login JSON with non-retryable safe 413', async () => {
        const before = (await runtime.query('SELECT count(*) FROM lumical.users')).rows[0].count; const hashes = hashCalls;
        for (const endpoint of ['register', 'login']) {
          const response = await api().post(`/api/v1/auth/${endpoint}`).set('Origin', origin).set('Idempotency-Key', randomUUID())
            .send({ email: 'oversized@example.invalid', password: 'TEST ONLY oversized secret ' + 'x'.repeat(120000) }).expect(413);
          assert.deepEqual(response.body.error, { code: 'VALIDATION_FAILED', messageKey: 'errors.validation', requestId: response.headers['x-request-id'], retryable: false, fieldErrors: [] });
          assert.equal(typeof response.body.error.requestId, 'string');
          assert.equal(JSON.stringify(response.body).includes('oversized secret'), false);
        }
        assert.equal(hashCalls, hashes); assert.equal((await runtime.query('SELECT count(*) FROM lumical.users')).rows[0].count, before);
      });
      await check('unknown email, wrong password and disabled account return equivalent generic login failures', async () => {
        const unknown = await login('unknown@example.invalid').expect(401);
        const wrong = await login('owner@example.invalid', password.trim()).expect(401);
        const disabled = await register('disabled@example.invalid').expect(201);
        await migration.query("UPDATE lumical.users SET status='DISABLED' WHERE id=$1", [disabled.body.data.id]);
        const blocked = await login('disabled@example.invalid').expect(401);
        assert.deepEqual(safeFailure(unknown), safeFailure(wrong)); assert.deepEqual(safeFailure(wrong), safeFailure(blocked));
        for (const response of [unknown, wrong, blocked]) assert.equal(response.headers['set-cookie'], undefined);
      });
      await check('exact/missing/lookalike Origin and missing/wrong/cross-session CSRF; safe GET requires neither', async () => {
        for (const badOrigin of [undefined, 'https://lumical.test.evil', 'https://lumical.test/', 'null']) {
          const operation = api().post('/api/v1/auth/login').send({ email: 'owner@example.invalid', password });
          if (badOrigin) operation.set('Origin', badOrigin);
          await operation.expect(403);
        }
        const other = await register('other@example.invalid').expect(201);
        for (const token of [undefined, 'wrong', other.body.data.csrfToken]) {
          const operation = api().delete('/api/v1/auth/session').set('Cookie', ownerCookie).set('Origin', origin);
          if (token) operation.set('X-CSRF-Token', token);
          await operation.expect(403);
        }
        await api().delete('/api/v1/auth/session').set('Cookie', ownerCookie).set('X-CSRF-Token', ownerCsrf).expect(403);
        await api().get('/api/v1/auth/session').set('Cookie', ownerCookie).expect(200);
        await me(ownerCookie).expect(200);
      });
      await check('unknown logout fields and malformed credential JSON return safe validation errors without mutation', async () => {
        await api().delete('/api/v1/auth/session').set('Cookie', ownerCookie).set('Origin', origin).set('X-CSRF-Token', ownerCsrf)
          .send({ role: 'ADMIN' }).expect(422);
        const malformed = await api().post('/api/v1/auth/login').set('Origin', origin).set('Content-Type', 'application/json')
          .send('{"password":"TEST ONLY private malformed JSON"').expect(422);
        assert.equal(malformed.body.error.code, 'VALIDATION_FAILED');
        assert.equal(JSON.stringify(malformed.body).includes('private malformed'), false);
        await me(ownerCookie).expect(200);
      });
      await check('durable session survives a Nest restart; login rotates current cookie; logout revokes and safe repeated logout clears cookie', async () => {
        await app.close(); await start(); await me(ownerCookie).expect(200);
        const rotated = await api().post('/api/v1/auth/login').set('Cookie', ownerCookie).set('Origin', origin).send({ email: 'owner@example.invalid', password }).expect(200);
        assert.notEqual(cookie(rotated), ownerCookie); await me(ownerCookie).expect(401);
        ownerCookie = cookie(rotated); ownerCsrf = rotated.body.data.csrfToken;
        const logout = await api().delete('/api/v1/auth/session').set('Cookie', ownerCookie).set('Origin', origin).set('X-CSRF-Token', ownerCsrf).expect(204);
        assert.match(logout.headers['set-cookie'][0], /Max-Age=0/); assert.match(logout.headers['set-cookie'][0], /HttpOnly/);
        await me(ownerCookie).expect(401);
        const boot = await api().get('/api/v1/auth/session').set('Cookie', ownerCookie).expect(200); assert.deepEqual(boot.body, { data: { authenticated: false } });
        await api().delete('/api/v1/auth/session').set('Cookie', ownerCookie).set('Origin', origin).expect(204);
      });
      await check('controlled idle/absolute expiry, throttled activity and concurrent touch cannot extend absolute lifetime', async () => {
        const idle = await login('owner@example.invalid').expect(200); advance(DAY); await me(cookie(idle)).expect(401);
        const absolute = await login('owner@example.invalid').expect(200); const current = cookie(absolute);
        for (let day = 0; day < 7; day++) { advance(23 * 3600000); await me(current).expect(200); }
        const row = (await runtime.query('SELECT idle_expires_at,absolute_expires_at,last_activity_at FROM lumical.sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [owner])).rows[0];
        assert.equal(row.idle_expires_at.getTime(), row.absolute_expires_at.getTime());
        await me(current).expect(200);
        const unchanged = (await runtime.query('SELECT last_activity_at FROM lumical.sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [owner])).rows[0];
        assert.equal(unchanged.last_activity_at.getTime(), row.last_activity_at.getTime());
        advance(60000); await Promise.all([me(current).expect(200), me(current).expect(200)]);
        advance(7 * 3600000 - 60000); await me(current).expect(401);
      });
      let adminCookie; let adminCsrf; let adminId;
      await check('controlled operator Admin fixture; non-Admin denial and minimal audited account-status projection', async () => {
        const admin = await register('operator@example.invalid').expect(201); adminId = admin.body.data.id;
        await migration.query("UPDATE lumical.users SET role='ADMIN' WHERE id=$1", [adminId]);
        const auth = await login('operator@example.invalid').expect(200); adminCookie = cookie(auth); adminCsrf = auth.body.data.csrfToken;
        const ownerAuth = await login('owner@example.invalid').expect(200); ownerCookie = cookie(ownerAuth); ownerCsrf = ownerAuth.body.data.csrfToken;
        await api().get(`/api/v1/admin/users/${owner}/account-status`).set('Cookie', ownerCookie).expect(403);
        const status = await api().get(`/api/v1/admin/users/${owner}/account-status`).set('Cookie', adminCookie).expect(200).expect('ETag', '"1"');
        assert.deepEqual(status.body, { data: { id: owner, status: 'ACTIVE', version: 1 } });
        assert.equal((await runtime.query("SELECT count(*) FROM lumical.admin_audit_events WHERE action='ACCOUNT_STATUS_READ' AND target_id=$1", [owner])).rows[0].count, '1');
      });
      await check('malformed Admin reasons reject before transaction; legitimate Unicode reason is audited unchanged', async () => {
        const auth = await register('reason-regression@example.invalid').expect(201); const id = auth.body.data.id;
        const before = (await runtime.query('SELECT id,revoked_at FROM lumical.sessions WHERE user_id=$1 ORDER BY id', [id])).rows;
        const repository = app.get(IdentityRepository); const original = repository.changeStatus.bind(repository); let writes = 0;
        repository.changeStatus = async (...args) => { writes++; return original(...args); };
        try {
          for (const bad of ['\u0000', '\ud800', '\udc00']) {
            const key = randomUUID();
            const response = await api().put(`/api/v1/admin/users/${id}/account-status`).set('Origin', origin).set('Cookie', adminCookie)
              .set('X-CSRF-Token', adminCsrf).set('Idempotency-Key', key).set('If-Match', '"1"')
              .send({ status: 'DISABLED', reason: `review${bad}` }).expect(422);
            assert.equal(response.body.error.code, 'VALIDATION_FAILED'); assert.equal(response.body.error.retryable, false);
            assert.equal(response.body.error.fieldErrors[0].path, 'reason');
            assert.equal((await runtime.query('SELECT count(*) FROM lumical.idempotency_records WHERE key=$1', [key])).rows[0].count, '0');
          }
          assert.equal(writes, 0);
          assert.deepEqual((await runtime.query('SELECT status,version FROM lumical.users WHERE id=$1', [id])).rows[0], { status: 'ACTIVE', version: 1 });
          assert.deepEqual((await runtime.query('SELECT id,revoked_at FROM lumical.sessions WHERE user_id=$1 ORDER BY id', [id])).rows, before);
          assert.equal((await runtime.query('SELECT count(*) FROM lumical.admin_audit_events WHERE target_id=$1', [id])).rows[0].count, '0');
          const reason = 'Đã xem xét e\u0301 🙂';
          await api().put(`/api/v1/admin/users/${id}/account-status`).set('Origin', origin).set('Cookie', adminCookie).set('X-CSRF-Token', adminCsrf)
            .set('Idempotency-Key', randomUUID()).set('If-Match', '"1"').send({ status: 'DISABLED', reason }).expect(200);
          assert.equal((await runtime.query("SELECT purpose FROM lumical.admin_audit_events WHERE target_id=$1 AND action='ACCOUNT_DISABLED'", [id])).rows[0].purpose, reason);
        } finally { repository.changeStatus = original; }
      });
      await check('audit insertion failure rolls back status, all session revocations and idempotency outcome', async () => {
        const key = randomUUID(); const before = (await runtime.query('SELECT id,revoked_at FROM lumical.sessions WHERE user_id=$1 ORDER BY id', [owner])).rows;
        await migration.query('REVOKE INSERT ON lumical.admin_audit_events FROM lumical_runtime');
        try { await change(adminCookie, adminCsrf, owner, 'DISABLED', 1, key).expect(503); }
        finally { await migration.query('GRANT INSERT ON lumical.admin_audit_events TO lumical_runtime'); }
        assert.deepEqual((await runtime.query('SELECT status,version FROM lumical.users WHERE id=$1', [owner])).rows[0], { status: 'ACTIVE', version: 1 });
        assert.deepEqual((await runtime.query('SELECT id,revoked_at FROM lumical.sessions WHERE user_id=$1 ORDER BY id', [owner])).rows, before);
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.idempotency_records WHERE key=$1', [key])).rows[0].count, '0');
      });
      await check('disable revokes multiple sessions; idempotent replay precedes old ETag; stale/version/missing preconditions reject', async () => {
        const second = await login('owner@example.invalid').expect(200); const key = randomUUID();
        const response = await change(adminCookie, adminCsrf, owner, 'DISABLED', 1, key).expect(200).expect('ETag', '"2"');
        const retry = await change(adminCookie, adminCsrf, owner, 'DISABLED', 1, key).expect(200); assert.deepEqual(retry.body, response.body);
        await change(adminCookie, adminCsrf, owner, 'ACTIVE', 1, key).expect(409);
        await change(adminCookie, adminCsrf, owner, 'ACTIVE', 1).expect(412);
        await api().put(`/api/v1/admin/users/${owner}/account-status`).set('Origin', origin).set('Cookie', adminCookie).set('X-CSRF-Token', adminCsrf)
          .set('Idempotency-Key', randomUUID()).send({ status: 'ACTIVE', reason: 'TEST ONLY' }).expect(428);
        await me(ownerCookie).expect(401); await me(cookie(second)).expect(401); await login('owner@example.invalid').expect(401);
        assert.equal((await runtime.query('SELECT count(*) FROM lumical.sessions WHERE user_id=$1 AND revoked_at IS NULL', [owner])).rows[0].count, '0');
        assert.equal((await runtime.query("SELECT count(*) FROM lumical.admin_audit_events WHERE target_id=$1 AND action='ACCOUNT_DISABLED'", [owner])).rows[0].count, '1');
      });
      await check('explicit audited re-enable cannot revive old cookies; fresh credentials are required', async () => {
        await change(adminCookie, adminCsrf, owner, 'ACTIVE', 2).expect(200).expect('ETag', '"3"');
        await me(ownerCookie).expect(401);
        const auth = await login('owner@example.invalid').expect(200); ownerCookie = cookie(auth); ownerCsrf = auth.body.data.csrfToken; await me(ownerCookie).expect(200);
      });
      await check('exported account-principal port joins the caller transaction and conveys no recipient/owner grant', async () => {
        await app.get(Transactions).run(async context => {
          await app.get(ActiveAccounts).withActiveAccount({ secret: secret(ownerCookie) }, false, async (actor, joined) => {
            assert.equal(joined, context); assert.deepEqual(actor, { kind: 'account', id: owner, role: 'USER', accountStatus: 'ACTIVE' });
          });
        });
      });
      await check('simultaneous equivalent registration has one account; same-intent parallel retry returns one bound session', async () => {
        const barrier = gate(); let arrived = 0;
        hashGate = async () => { arrived++; if (arrived === 2) barrier.arrive(); await barrier.wait; };
        const key = randomUUID(); const attempts = [register(' race@example.invalid ', key), register('RACE@example.invalid', key)].map(result => result.then(value => value));
        try { await barrier.arrived; barrier.release(); const result = await Promise.all(attempts);
          assert.deepEqual(result.map(value => value.status), [201, 201]); assert.equal(cookie(result[0]), cookie(result[1]));
          assert.equal((await runtime.query("SELECT count(*) FROM lumical.users WHERE normalized_email='race@example.invalid'")).rows[0].count, '1');
        } finally { hashGate = undefined; barrier.release(); }
      });
      await check('login racing with committed disable rechecks active account before issuing a session', async () => {
        const race = await register('login-race@example.invalid').expect(201); const id = race.body.data.id; const barrier = gate();
        verifyGate = async () => { barrier.arrive(); await barrier.wait; };
        const attempt = login('login-race@example.invalid').then(value => value);
        try { await barrier.arrived; await change(adminCookie, adminCsrf, id, 'DISABLED', 1).expect(200); barrier.release(); assert.equal((await attempt).status, 401);
          assert.equal((await runtime.query('SELECT count(*) FROM lumical.sessions WHERE user_id=$1 AND revoked_at IS NULL', [id])).rows[0].count, '0');
        } finally { verifyGate = undefined; barrier.release(); }
      });
      await check('protected request races with disable/logout using repository barriers; no stale session survives completion', async () => {
        for (const mutation of ['disable', 'logout']) {
          const auth = await register(`${mutation}-race@example.invalid`).expect(201); const id = auth.body.data.id; const current = cookie(auth);
          const repository = app.get(IdentityRepository); const original = repository.lockAccount.bind(repository); const barrier = gate(); let paused = false;
          repository.lockAccount = async (target, context) => { if (target === id && !paused) { paused = true; barrier.arrive(); await barrier.wait; } return original(target, context); };
          const protectedRead = me(current).then(value => value);
          try { await barrier.arrived;
            if (mutation === 'disable') await change(adminCookie, adminCsrf, id, 'DISABLED', 1).expect(200);
            else await api().delete('/api/v1/auth/session').set('Cookie', current).set('Origin', origin).set('X-CSRF-Token', auth.body.data.csrfToken).expect(204);
            barrier.release(); assert.equal((await protectedRead).status, 401); await me(current).expect(401);
          } finally { repository.lockAccount = original; barrier.release(); }
        }
      });
      await check('concurrent Admin repeated disable commits one audit/version outcome', async () => {
        const auth = await register('admin-race@example.invalid').expect(201); const id = auth.body.data.id; const key = randomUUID();
        const responses = await Promise.all([change(adminCookie, adminCsrf, id, 'DISABLED', 1, key), change(adminCookie, adminCsrf, id, 'DISABLED', 1, key)]);
        assert.deepEqual(responses.map(value => value.status), [200,200]); assert.deepEqual(responses[0].body, responses[1].body);
        assert.equal((await runtime.query("SELECT count(*) FROM lumical.admin_audit_events WHERE action='ACCOUNT_DISABLED' AND target_id=$1", [id])).rows[0].count, '1');
      });
      await check('security suspension preserves history; shares stay suspended until explicit operator restoration; revoked grants stay revoked', async () => {
        await seedSynthetic(app.get(DatabaseAvailability));
        const project = await projectFixture(runtime, owner, syntheticIds.revision);
        const order = await orderFixture(runtime, project, owner); const share = randomUUID();
        await runtime.query("INSERT INTO lumical.recipient_shares(id,order_id,credential_digest) VALUES($1,$2,'TEST ONLY share digest')", [share,order]);
        const history = (await runtime.query('SELECT row_to_json(o) AS data FROM lumical.orders o WHERE id=$1', [order])).rows;
        await change(adminCookie, adminCsrf, owner, 'DISABLED', 3).expect(200);
        assert.equal((await runtime.query('SELECT status FROM lumical.recipient_shares WHERE id=$1', [share])).rows[0].status, 'SUSPENDED');
        await change(adminCookie, adminCsrf, owner, 'ACTIVE', 4).expect(200);
        assert.equal((await runtime.query('SELECT status FROM lumical.recipient_shares WHERE id=$1', [share])).rows[0].status, 'SUSPENDED');
        await change(adminCookie, adminCsrf, owner, 'DISABLED', 5).expect(200);
        // A synthetic settlement supports the security-only still-valid grant fixture.
        const attempt = randomUUID();
        await runtime.query("INSERT INTO lumical.payment_attempts(id,order_id,provider,environment,updated_at) VALUES($1,$2,'TEST_ONLY','SANDBOX',now())", [attempt,order]);
        await runtime.query("INSERT INTO lumical.payment_settlements(id,order_id,attempt_id,provider,environment,capture_reference,amount_minor,evidence_summary,completed_at) VALUES($1,$2,$3,'TEST_ONLY','SANDBOX',$4,2900,'{\"testOnly\":true}',now())", [randomUUID(),order,attempt,randomUUID()]);
        await change(adminCookie, adminCsrf, owner, 'ACTIVE', 6, randomUUID(), true).expect(200);
        assert.equal((await runtime.query('SELECT status FROM lumical.recipient_shares WHERE id=$1', [share])).rows[0].status, 'ACTIVE');
        await runtime.query("UPDATE lumical.recipient_shares SET status='REVOKED',credential_digest=NULL,revoked_at=now() WHERE id=$1", [share]);
        await change(adminCookie, adminCsrf, owner, 'DISABLED', 7).expect(200); await change(adminCookie, adminCsrf, owner, 'ACTIVE', 8, randomUUID(), true).expect(200);
        assert.equal((await runtime.query('SELECT status FROM lumical.recipient_shares WHERE id=$1', [share])).rows[0].status, 'REVOKED');
        assert.deepEqual((await runtime.query('SELECT row_to_json(o) AS data FROM lumical.orders o WHERE id=$1', [order])).rows, history);
      });
      await check('bounded HTTP login protection treats existing/unknown accounts equally and returns safe 429', async () => {
        await app.close(); process.env.IDENTITY_AUTH_ATTEMPTS = '2'; await start();
        for (const email of ['owner@example.invalid', 'rate-unknown@example.invalid']) {
          await login(email, 'TEST ONLY wrong passphrase').expect(401);
          await login(email, 'TEST ONLY wrong passphrase').expect(401);
          const limited = await login(email, 'TEST ONLY wrong passphrase').expect(429);
          assert.equal(limited.body.error.code, 'RATE_LIMITED'); assert.equal(limited.body.error.retryable, true);
        }
      });
      await check('disabled Admin cannot perform security operations; API/OpenAPI/log projections contain no raw credentials', async () => {
        await migration.query("UPDATE lumical.users SET status='DISABLED' WHERE id=$1", [adminId]);
        await api().get(`/api/v1/admin/users/${owner}/account-status`).set('Cookie', adminCookie).expect(401);
        const spec = await api().get('/api/v1/openapi.json').expect(200);
        for (const path of ['/auth/register','/auth/login','/auth/session','/account/me','/admin/users/{id}/account-status']) assert.ok(spec.body.paths[`/api/v1${path}`]);
        assert.equal(spec.body.components.schemas.CredentialsDto.additionalProperties, false);
        assert.equal(spec.body.components.schemas.CredentialsDto.properties.password.writeOnly, true);
        assert.equal('passwordHash' in spec.body.components.schemas.PrincipalDto.properties, false);
        for (const path of ['/api/v1/auth/register','/api/v1/auth/login']) assert.ok(spec.body.paths[path].post.responses['413']);
        for (const sensitive of [password, secret(adminCookie), adminCsrf, process.env.IDENTITY_SECRET_KEY, process.env.DATABASE_URL]) assert.equal(logs.join('\n').includes(sensitive), false);
        assert.equal(JSON.stringify(spec.body).includes(process.env.IDENTITY_SECRET_KEY), false);
      });
      await check('gateway source isolation, spoofed address headers, default/untrusted direct access and independent normalized-email limits', async () => {
        const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
        const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
        const send = (base, source, email, spoof = '198.51.100.1') => new Promise((resolve, reject) => {
          const body = JSON.stringify({ email, password });
          const operation = httpRequest(`${base}/api/v1/auth/login`, { method: 'POST', localAddress: source,
            headers: { Origin: origin, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
              'X-Forwarded-For': spoof, 'X-Real-IP': spoof, Forwarded: `for=${spoof}`, 'True-Client-IP': spoof, 'CF-Connecting-IP': spoof } }, response => {
            let text = ''; response.on('data', chunk => { text += String(chunk); });
            response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
          });
          operation.on('error', reject); operation.end(body);
        });
        await app.close(); process.env.IDENTITY_AUTH_ATTEMPTS = '1'; process.env.IDENTITY_TRUSTED_PROXY_IPS = ''; await start();
        await app.listen(0, '127.0.0.1');
        let base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
        for (let attempt = 0; attempt < 5; attempt++) {
          assert.equal((await send(base, '127.0.0.3', `direct-${attempt}@example.invalid`, `198.51.100.${attempt + 1}`)).status, 401);
        }
        assert.equal((await send(base, '127.0.0.3', 'direct-overflow@example.invalid', '203.0.113.1')).status, 429);
        await app.close(); process.env.IDENTITY_AUTH_ATTEMPTS = '10'; process.env.IDENTITY_TRUSTED_PROXY_IPS = '127.0.0.1'; await start();
        await app.listen(0, '127.0.0.1'); base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
        const abuse = app.get(AuthAttempts); const original = abuse.check.bind(abuse); let lastSource;
        abuse.check = (ip, email) => { lastSource = ip; original(ip, email); };
        const web = createServer((req, res) => res.end('TEST ONLY frontend'));
        let gateway;
        try {
          gateway = createGateway(base, await listen(web)); const proxy = await listen(gateway);
          assert.equal((await send(proxy, '127.0.0.3', 'owner@example.invalid')).status, 200); assert.equal(lastSource, '127.0.0.3');
          // Exact prior malformed-input reproduction now rejects before consuming any quota.
          for (let attempt = 0; attempt < 49; attempt++) assert.equal((await send(proxy, '127.0.0.2', `review${attempt}\u0000@example.invalid`)).status, 422);
          assert.equal((await send(proxy, '127.0.0.3', 'owner@example.invalid')).status, 200);
          // Also exhaust A using well-formed requests: B still authenticates.
          for (let attempt = 0; attempt < 49; attempt++) {
            assert.equal((await send(proxy, '127.0.0.2', `source-${attempt}@example.invalid`, `203.0.113.${attempt + 1}`)).status, 401);
            assert.equal(lastSource, '127.0.0.2');
          }
          assert.equal((await send(proxy, '127.0.0.3', 'owner@example.invalid')).status, 200);
          assert.equal((await send(proxy, '127.0.0.2', 'source-final@example.invalid')).status, 401);
          const limited = await send(proxy, '127.0.0.2', 'source-overflow@example.invalid', '203.0.113.200');
          assert.equal(limited.status, 429); assert.equal(limited.body.error.code, 'RATE_LIMITED');
          assert.equal((await send(proxy, '127.0.0.3', 'owner@example.invalid')).status, 200);
          // Configured trust does not extend to a direct, untrusted peer.
          assert.equal((await send(base, '127.0.0.4', 'untrusted-direct@example.invalid', '127.0.0.1, 203.0.113.5')).status, 401);
          assert.equal(lastSource, '127.0.0.4');
          for (let attempt = 0; attempt < 10; attempt++) assert.equal((await send(proxy, '127.0.0.3', ' EMAIL-LIMIT@Example.invalid ')).status, 401);
          assert.equal((await send(proxy, '127.0.0.4', 'email-limit@example.invalid')).status, 429);
        } finally {
          abuse.check = original;
          if (gateway) await close(gateway);
          await close(web);
        }
      });
    } finally { await app?.close(); await runtime.end(); await migration.end(); }
  });
  console.log('PASS: I02 real PostgreSQL identity/session/security gate.');
} catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1; }
finally { process.env = originalEnv; }
