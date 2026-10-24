// Review item: a /api/spike/reveal response that arrives late must never render after the target was lost, AR was
// stopped, or a newer recognition started. Covers the guard directly and a real aborted HTTP request.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRevealGuard, runGuardedReveal } from '../public/reveal-guard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A fetch whose response we release manually, like a slow network.
function deferredFetch({ ok = true, status = 200, body = { versionLabel: 'A' } } = {}) {
  let release;
  const gate = new Promise((r) => { release = r; });
  const fetchReveal = async (signal) => {
    await new Promise((resolve, reject) => {
      gate.then(resolve);
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    return { ok, status, json: async () => body };
  };
  return { fetchReveal, release: () => release() };
}
const recorder = () => {
  const calls = [];
  return { calls, handlers: { onOk: (b) => calls.push(['ok', b]), onDenied: (s) => calls.push(['denied', s]), onStale: (w) => calls.push(['stale', w]), onError: (e) => calls.push(['error', e.message]) } };
};

test('found, then target lost, then the response arrives late: nothing is rendered', async () => {
  const guard = createRevealGuard();
  const { fetchReveal, release } = deferredFetch();
  const r = recorder();
  const pending = runGuardedReveal(guard, { fetchReveal }, r.handlers);
  guard.invalidate(); // target lost
  release();
  await pending;
  assert.deepEqual(r.calls.map((c) => c[0]), ['stale']);
});

test('found, then Stop (invalidate), then a late denied response: not shown either', async () => {
  const guard = createRevealGuard();
  const { fetchReveal, release } = deferredFetch({ ok: false, status: 404 });
  const r = recorder();
  const pending = runGuardedReveal(guard, { fetchReveal }, r.handlers);
  guard.invalidate();
  release();
  await pending;
  assert.deepEqual(r.calls.map((c) => c[0]), ['stale']);
});

test('response arrives, but the target is lost while the body is still being read', async () => {
  const guard = createRevealGuard();
  const r = recorder();
  let resolveBody;
  const fetchReveal = async () => ({ ok: true, status: 200, json: () => new Promise((res) => { resolveBody = res; }) });
  const pending = runGuardedReveal(guard, { fetchReveal }, r.handlers);
  await new Promise((ok) => setImmediate(ok));
  guard.invalidate();
  resolveBody({ versionLabel: 'A' });
  await pending;
  assert.deepEqual(r.calls, [['stale', 'after-body']]);
});

test('a response that was already delivered (fetch ignores abort) is still dropped once the target is lost', async () => {
  const guard = createRevealGuard();
  const r = recorder();
  const ignoresAbort = async () => ({ ok: true, status: 200, json: async () => ({ versionLabel: 'A' }) });
  const pending = runGuardedReveal(guard, { fetchReveal: ignoresAbort }, r.handlers);
  guard.invalidate(); // before the continuation after `await fetchReveal` runs
  await pending;
  assert.deepEqual(r.calls, [['stale', 'after-response']]);
});

test('a newer recognition supersedes an older one: only the newest can render', async () => {
  const guard = createRevealGuard();
  const first = deferredFetch({ body: { versionLabel: 'old' } });
  const second = deferredFetch({ body: { versionLabel: 'new' } });
  const r = recorder();
  const p1 = runGuardedReveal(guard, { fetchReveal: first.fetchReveal }, r.handlers);
  const p2 = runGuardedReveal(guard, { fetchReveal: second.fetchReveal }, r.handlers);
  second.release();
  first.release();
  await Promise.all([p1, p2]);
  const ok = r.calls.filter((c) => c[0] === 'ok');
  assert.deepEqual(ok, [['ok', { versionLabel: 'new' }]]);
});

test('without invalidation the response renders normally (guard does not swallow real reveals)', async () => {
  const guard = createRevealGuard();
  const { fetchReveal, release } = deferredFetch();
  const r = recorder();
  const pending = runGuardedReveal(guard, { fetchReveal }, r.handlers);
  release();
  await pending;
  assert.deepEqual(r.calls, [['ok', { versionLabel: 'A' }]]);
});

test('a real slow HTTP response is aborted on invalidate and never reaches onOk', async () => {
  const server = http.createServer((req, res) => setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"versionLabel":"A"}'); }, 300));
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  try {
    const guard = createRevealGuard();
    const r = recorder();
    const url = `http://127.0.0.1:${server.address().port}/`;
    const pending = runGuardedReveal(guard, { fetchReveal: (signal) => fetch(url, { signal }) }, r.handlers);
    setTimeout(() => guard.invalidate(), 50);
    await pending;
    assert.deepEqual(r.calls, [['stale', 'aborted']]);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

test('client.js routes every reveal through the guard and invalidates on lost, stop and start', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public/client.js'), 'utf8');
  assert.match(js, /import \{ createRevealGuard, runGuardedReveal \} from '\.\/reveal-guard\.js'/);
  assert.match(js, /runGuardedReveal\(\s*revealGuard/);
  assert.doesNotMatch(js, /await fetch\('\/api\/spike\/reveal'/, 'no unguarded reveal fetch');
  const lost = js.slice(js.indexOf('anchor.onTargetLost'), js.indexOf('anchor.onTargetLost') + 200);
  assert.match(lost, /revealGuard\.invalidate\(\)/);
  assert.match(js.slice(js.indexOf('async function stop(')), /^[^}]*revealGuard\.invalidate\(\)/);
  assert.match(js.slice(js.indexOf('async function start(')), /^[^}]*revealGuard\.invalidate\(\)/);
});
