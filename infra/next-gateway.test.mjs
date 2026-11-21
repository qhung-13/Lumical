import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { forwardApiRequest } from './next-gateway.mjs';

const key = randomBytes(32).toString('hex');
const backend = 'https://backend.example';
const ip = '198.51.100.7';
function request(path = '/api/v1/auth/session', options = {}) {
  return new Request(`https://demo.example${path}`, { ...options, headers: { 'x-vercel-forwarded-for': ip, ...options.headers } });
}
const proxy = (req, fetcher, config = {}) => forwardApiRequest(req, { backend, gatewayKey: key, vercel: true, fetcher, ...config });

for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
  test(`forwards ${method}, raw query/body and approved headers only`, async () => {
    const body = ['GET', 'HEAD'].includes(method) ? undefined : '{"email":"a+b@example.invalid","password":"  unchanged  "}';
    const req = request('/api/v1/templates?query=a%2Bb&cursor=&category=GENERAL&query=two', { method, body, headers: {
      cookie: '__Host-lumical_session=opaque; other=value', origin: 'https://demo.example', 'x-csrf-token': 'csrf',
      'content-type': 'application/json', 'idempotency-key': 'test-only-key', 'if-match': '"2"', range: 'bytes=0-9',
      host: 'attacker.invalid', forwarded: 'for=evil', 'x-forwarded-for': '203.0.113.99', 'x-real-ip': '203.0.113.99',
      'cf-connecting-ip': '203.0.113.99', 'x-lumical-gateway-key': 'spoofed', 'x-lumical-client-ip': '203.0.113.99',
      connection: 'x-csrf-token', authorization: 'untrusted', 'x-vercel-id': 'untrusted',
    } });
    let calls = 0;
    const result = await proxy(req, async (url, options) => {
      calls++;
      assert.equal(url.href, `${backend}/api/v1/templates?query=a%2Bb&cursor=&category=GENERAL&query=two`);
      assert.equal(options.method, method);
      assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
      assert.equal(options.headers.get('cookie'), '__Host-lumical_session=opaque; other=value');
      assert.equal(options.headers.get('origin'), 'https://demo.example');
      assert.equal(options.headers.get('x-lumical-gateway-key'), key);
      assert.equal(options.headers.get('x-lumical-client-ip'), ip);
      assert.equal(options.headers.get('if-match'), '"2"'); assert.equal(options.headers.get('range'), 'bytes=0-9');
      for (const name of ['host', 'forwarded', 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'connection', 'authorization', 'x-vercel-id', 'x-csrf-token']) assert.equal(options.headers.get(name), null);
      if (body !== undefined) assert.equal(await new Response(options.body).text(), body);
      return new Response(method === 'HEAD' ? null : 'upstream', { headers: { 'Cache-Control': 'public, max-age=999' } });
    });
    assert.equal(calls, 1); assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(result.headers.get('vercel-cdn-cache-control'), 'no-store');
    assert.equal(await result.text(), method === 'HEAD' ? '' : 'upstream');
  });
}

test('preserves CSRF, binary bytes, multiple Set-Cookie, status and safe failure metadata', async () => {
  const cookies = ['__Host-lumical_session=one; Secure; HttpOnly; Path=/; Expires=Wed, 01 Jan 2031 00:00:00 GMT', '__Host-second=two; Secure; Path=/'];
  const result = await proxy(request('/api/v1/auth/login', { method: 'POST', body: new Uint8Array([0, 255, 42]), headers: { 'x-csrf-token': 'csrf' } }), async (_url, options) => {
    assert.equal(options.headers.get('x-csrf-token'), 'csrf');
    assert.deepEqual(new Uint8Array(await new Response(options.body).arrayBuffer()), new Uint8Array([0, 255, 42]));
    const headers = new Headers({ 'content-type': 'application/json', 'retry-after': '17', 'x-request-id': 'backend-id',
      'content-encoding': 'gzip', 'content-length': '999', 'x-lumical-gateway-key': key, connection: 'keep-alive' });
    cookies.forEach(cookie => headers.append('set-cookie', cookie));
    return new Response('{"error":{"code":"RATE_LIMITED"}}', { status: 429, headers });
  });
  assert.equal(result.status, 429); assert.deepEqual(result.headers.getSetCookie(), cookies);
  assert.equal(result.headers.get('retry-after'), '17'); assert.equal(result.headers.get('x-request-id'), 'backend-id');
  for (const header of ['content-encoding', 'content-length', 'x-lumical-gateway-key', 'connection']) assert.equal(result.headers.get(header), null);
  assert.deepEqual(await result.json(), { error: { code: 'RATE_LIMITED' } });
});

for (const status of [201, 204, 400, 401, 403, 404, 409, 413, 422, 500, 503]) {
  test(`preserves backend ${status} including empty responses`, async () => {
    const result = await proxy(request(), async () => new Response(status === 204 ? null : 'safe backend body', { status }));
    assert.equal(result.status, status); assert.equal(await result.text(), status === 204 ? '' : 'safe backend body');
  });
}

test('fails closed on unsafe configuration, routes and unverified IPs without a network call', async () => {
  for (const [req, config] of [
    [request(), { backend: 'http://backend.example' }], [request(), { backend: `${backend}/path` }],
    [request(), { backend: 'https://name:password@backend.example' }], [request(), { backend: `${backend}?url=evil` }],
    [request(), { gatewayKey: undefined }], [request(), { gatewayKey: 'a'.repeat(64) }], [request(), { vercel: false }],
    [request('/other'), {}], [request('/api/%2f%2fevil.example'), {}], [request('/api/%5cevil.example'), {}],
    [request(undefined, { headers: { 'x-vercel-forwarded-for': '' } }), {}],
    [request(undefined, { headers: { 'x-vercel-forwarded-for': `${ip}, 203.0.113.4` } }), {}],
  ]) {
    const result = await proxy(req, () => { assert.fail('must not contact any upstream'); }, config);
    assert.equal(result.status, 502); assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.ok(!(await result.text()).includes(key));
  }
});

test('returns a redacted contract error on timeout, redirect rejection or network failure', async () => {
  for (const name of ['TimeoutError', 'AbortError', 'TypeError']) {
    const result = await proxy(request(), async () => { const error = new Error(`${key} private upstream details`); error.name = name; throw error; });
    assert.equal(result.status, 502);
    const body = await result.json();
    assert.equal(body.error.code, 'PROVIDER_UNAVAILABLE'); assert.equal(body.error.retryable, true);
    assert.equal(body.error.requestId, result.headers.get('x-request-id'));
    assert.ok(!JSON.stringify(body).includes(key));
  }
});

test('propagates caller cancellation to the upstream signal', async () => {
  const controller = new AbortController();
  await proxy(request(undefined, { signal: controller.signal }), async (_url, options) => {
    controller.abort(); assert.equal(options.signal.aborted, true);
    throw options.signal.reason;
  });
});
