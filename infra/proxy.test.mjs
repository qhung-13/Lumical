import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, get } from 'node:http';
import { once } from 'node:events';
import { createGateway } from './proxy.mjs';
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
test('same-origin routing passes API cookies/Origin/CSRF and Set-Cookie directly to Nest; web paths reach Next', async () => {
  let received;
  const backend = createServer((req,res) => { received = req.headers; res.writeHead(201, { 'Set-Cookie': ['__Host-lumical_session=TEST_ONLY; Secure; HttpOnly; Path=/; SameSite=Lax'], 'Cache-Control':'no-store' }); res.end('backend'); });
  const frontend = createServer((req,res) => res.end('frontend'));
  const gateway = createGateway(await listen(backend), await listen(frontend)); const base = await listen(gateway);
  try {
    const result = await fetch(`${base}/api/v1/auth/register`, { method:'POST', headers:{ Cookie:'TEST_ONLY', Origin:'https://lumical.test', 'X-CSRF-Token':'TEST_ONLY',
      'X-Forwarded-Host':'untrusted.invalid', 'X-Forwarded-For':'198.51.100.1', 'X-Forwarded-Proto':'https',
      'X-Real-IP':'198.51.100.2', Forwarded:'for=198.51.100.3', 'CF-Connecting-IP':'198.51.100.4', 'True-Client-IP':'198.51.100.5' } });
    assert.equal(result.status,201); assert.equal(await result.text(),'backend');
    assert.equal(received.cookie,'TEST_ONLY'); assert.equal(received.origin,'https://lumical.test'); assert.equal(received['x-csrf-token'],'TEST_ONLY');
    assert.equal(received['x-forwarded-host'],undefined); assert.match(result.headers.get('set-cookie'),/Secure; HttpOnly/);
    assert.equal(received['x-forwarded-for'],'127.0.0.1');
    for (const name of ['x-forwarded-proto','x-real-ip','forwarded','cf-connecting-ip','true-client-ip']) assert.equal(received[name],undefined);
    assert.equal(await (await fetch(base+'/login')).text(),'frontend');
  } finally { await close(gateway); await close(backend); await close(frontend); }
});

for (const sendHeaders of [false, true]) {
  test(`cancels a media upstream on disconnect ${sendHeaders ? 'during streaming' : 'before headers'}`, { timeout: 5000 }, async () => {
    let closed;
    const backend = createServer((_req, res) => {
      closed = once(res, 'close');
      if (sendHeaders) res.write('first chunk');
    });
    const target = await listen(backend);
    const gateway = createGateway(target, target);
    const base = await listen(gateway);
    try {
      const started = once(backend, 'request');
      const client = get(`${base}/api/v1/media/test/content`);
      client.on('error', () => {});
      await Promise.race([started, once(client, 'error').then(([error]) => { throw error; })]);
      if (sendHeaders) {
        const [response] = await once(client, 'response');
        await once(response, 'data');
      }
      client.destroy();
      await closed;
    } finally {
      await close(gateway);
      await close(backend);
    }
  });
}

test('relays a controlled 503 after the Admin inspection budget', { timeout: 22000 }, async () => {
  const backend = createServer((_req, res) => {
    const timer = setTimeout(() => res.writeHead(503, { 'X-Request-Id': 'nest-test' }).end(), 15_100);
    res.once('close', () => clearTimeout(timer));
  });
  const target = await listen(backend);
  const gateway = createGateway(target, target);
  const base = await listen(gateway);
  try {
    const response = await fetch(`${base}/api/v1/media/test/finalize`, { method: 'POST' });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('x-request-id'), 'nest-test');
    await response.arrayBuffer();
  } finally {
    await close(gateway);
    await close(backend);
  }
});
