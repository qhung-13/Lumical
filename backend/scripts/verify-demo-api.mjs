import { loadEnvFile } from 'node:process';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

loadEnvFile(new URL('../.env', import.meta.url));
const local = !process.argv[2];
const base = process.argv[2] ?? 'http://127.0.0.1:3391';
const origin = process.env.IDENTITY_ALLOWED_ORIGINS;
const checks = [];
let child, migration;
function check(name, pass, detail) {
  checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
  if (!pass) throw Error(name);
}
async function api(path, { method = 'GET', body, cookie, csrf, direct = false, otherOrigin, etag } = {}) {
  const headers = { Accept: 'application/json' };
  if (local && !direct) headers['X-LumiCal-Gateway-Key'] = process.env.LUMICAL_GATEWAY_KEY;
  if (method !== 'GET') headers.Origin = otherOrigin ?? origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (csrf) headers['X-CSRF-Token'] = csrf;
  if (method === 'POST' || method === 'PUT') headers['Idempotency-Key'] = randomUUID();
  if (etag) headers['If-Match'] = etag;
  const response = await fetch(new URL('/api/v1' + path, base), {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error', signal: AbortSignal.timeout(90000),
  });
  const data = await response.json().catch(() => null);
  return { response, data, cookie: response.headers.getSetCookie()[0]?.split(';')[0] };
}
try {
  if (local) {
    child = spawn(process.execPath, ['dist/main.js'], {
      cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '3391', RENDER: 'true' },
      stdio: 'ignore', windowsHide: true,
    });
  }
  let ready;
  for (let attempt = 0; attempt < 20; attempt++) {
    ready = await api('/health/ready').catch(() => null);
    if (ready?.response.status === 200) break;
    await delay(1000);
  }
  check('Backend ready with Neon runtime Prisma connection', ready?.response.status === 200, ready?.response.status);
  check('Liveness', (await api('/health/live')).response.status === 200, 200);
  if (local) check('Direct account route denied without gateway key', (await api('/auth/session', { direct: true })).response.status === 404, 404);
  check('Unauthenticated account denied', (await api('/account/me')).response.status === 401, 401);
  const suffix = randomBytes(5).toString('hex');
  const password = randomBytes(24).toString('base64url') + 'aA1!';
  const email = `demo-${suffix}@example.invalid`;
  const registered = await api('/auth/register', { method: 'POST', body: { email, password } });
  check('Registration', registered.response.status === 201, registered.response.status);
  const setCookie = registered.response.headers.getSetCookie()[0] ?? '';
  check('Secure opaque session cookie', /^__Host-lumical_session=/.test(setCookie) && ['httponly', 'secure', 'samesite=lax', 'path=/'].every(s => setCookie.toLowerCase().includes(s)) && !/domain=/i.test(setCookie));
  const login = await api('/auth/login', { method: 'POST', body: { email, password } });
  check('Login', login.response.status === 200, login.response.status);
  const cookie = login.cookie, csrf = login.data.data.csrfToken;
  check('Authenticated account read', (await api('/account/me', { cookie })).response.status === 200, 200);
  check('Authenticated response no-store', (await api('/auth/session', { cookie })).response.headers.get('cache-control')?.includes('no-store'));
  check('Ordinary user cannot read admin templates', (await api('/admin/templates', { cookie })).response.status === 403, 403);
  check('Missing CSRF rejected', (await api('/auth/session', { method: 'DELETE', cookie })).response.status === 403, 403);
  check('Wrong Origin rejected', (await api('/auth/session', { method: 'DELETE', cookie, csrf, otherOrigin: 'https://untrusted.example' })).response.status === 403, 403);
  migration = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL, connectionTimeoutMillis: 15000 });
  await migration.connect();
  await migration.query("UPDATE lumical.users SET role='ADMIN',version=version+1 WHERE id=$1 AND normalized_email=$2 AND role='USER'", [registered.data.data.id, email]);
  const operator = await api('/auth/login', { method: 'POST', body: { email, password } });
  check('Synthetic operator login', operator.response.status === 200 && operator.data.data.role === 'ADMIN', operator.response.status);
  const admin = { cookie: operator.cookie, csrf: operator.data.data.csrfToken };
  check('Admin catalog authorized', (await api('/admin/templates', admin)).response.status === 200, 200);
  const revision = {
    name: { vi: 'Lịch demo tổng hợp', en: 'Synthetic demo calendar' },
    description: { vi: 'Dữ liệu tổng hợp cho bản demo học thuật I04.', en: 'Synthetic data for the I04 academic demo.' },
    layout: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 },
    presets: [{ id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } }],
    price: { currency: 'USD', unitPriceMinor: 1450 },
  };
  const created = await api('/admin/templates', { ...admin, method: 'POST', body: { category: 'GENERAL', revision } });
  check('Admin creates audited inactive template', created.response.status === 201, created.response.status);
  const id = created.data.data.id;
  check('Inactive template not public', (await api('/templates/' + id)).response.status === 404, 404);
  const active = await api(`/admin/templates/${id}/availability`, { ...admin, method: 'PUT', etag: created.response.headers.get('etag'), body: { availability: 'ACTIVE', reason: 'Synthetic I04 academic demonstration verification' } });
  check('Admin activates complete published template', active.response.status === 200, active.response.status);
  const list = await api('/templates');
  check('Catalog reads deployed Neon data', list.response.status === 200 && list.data.data.some(row => row.id === id), list.response.status);
  check('Published template detail', (await api('/templates/' + id)).response.status === 200, 200);
  check('Empty catalog search', (await api('/templates?query=nevermatches' + suffix)).data.data.length === 0, 200);
  check('Logout', (await api('/auth/session', { ...admin, method: 'DELETE' })).response.status === 204, 204);
  check('Revoked session rejected', (await api('/account/me', { cookie: admin.cookie })).response.status === 401, 401);
  // Revoke the separate initial ordinary session as well; keep only synthetic DB records.
  await api('/auth/session', { method: 'DELETE', cookie, csrf });
  await api('/auth/session', { method: 'DELETE', cookie: registered.cookie, csrf: registered.data.data.csrfToken });
  const directory = new URL('../../../secrets/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  writeFileSync(new URL('.demo-operator.json', directory), JSON.stringify({ email, password, templateId: id }), { mode: 0o600 });
} catch {
  console.error('Demo API verification stopped; secret values redacted. Failed check: ' + (checks.at(-1)?.name ?? 'startup'));
  process.exitCode = 1;
} finally {
  child?.kill(); await migration?.end().catch(() => {});
  writeFileSync(new URL(`../../evidence/${local ? 'local-neon' : 'live'}-api-verification.json`, import.meta.url), JSON.stringify({ base, checks }, null, 2));
  console.log(JSON.stringify(checks, null, 2));
}
