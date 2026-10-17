// Static module-graph check: every ES module the browser will request must resolve (HTTP 200, JavaScript).
// This is what catches "entry file served, but its sibling chunks 404" before a phone run.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/server.mjs';
import { createRegistry } from '../src/registry.mjs';
import { loadManifest } from '../src/manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installed = fs.existsSync(path.join(ROOT, 'node_modules/mind-ar/dist')) && fs.existsSync(path.join(ROOT, 'node_modules/three/build'));
let server, base;

before(async () => {
  if (!installed) return;
  const registry = createRegistry({ manifest: loadManifest(ROOT), rootDir: ROOT, sessions: [], enableCombined: false });
  server = createServer({ registry, rootDir: ROOT });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

const SPEC = /(?:\bfrom|\bimport)\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

test('every module reachable from the page resolves on this server', { skip: !installed && 'run npm install --ignore-scripts first' }, async () => {
  const html = await (await fetch(`${base}/`)).text();
  const importMap = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]).imports;
  const resolveBare = (spec) => {
    if (importMap[spec]) return importMap[spec];
    const prefix = Object.keys(importMap).find((k) => k.endsWith('/') && spec.startsWith(k));
    return prefix ? importMap[prefix] + spec.slice(prefix.length) : null;
  };
  const queue = ['/client.js'];
  const seen = new Set();
  const problems = [];
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const res = await fetch(base + url);
    if (res.status !== 200 || !/javascript/.test(res.headers.get('content-type') || '')) {
      problems.push(`${url} -> ${res.status}`);
      continue;
    }
    const src = await res.text();
    for (const m of src.matchAll(SPEC)) {
      const spec = m[1] ?? m[2];
      if (/^(data:|blob:|https?:)/.test(spec)) continue;
      const next = spec.startsWith('.') || spec.startsWith('/') ? new URL(spec, 'http://x' + url).pathname : resolveBare(spec);
      if (!next) problems.push(`${url} imports unmapped specifier "${spec}"`);
      else queue.push(next);
    }
  }
  assert.deepEqual(problems, []);
  assert.ok([...seen].some((u) => u.startsWith('/vendor/mindar/controller-')), 'MindAR sibling chunks were crawled');
});

test('vendor routes cannot escape their directory', { skip: !installed }, async () => {
  for (const p of ['/vendor/mindar/../../package.json', '/vendor/mindar/%2e%2e/%2e%2e/package.json', '/vendor/three-addons/../../../package.json']) {
    const res = await fetch(base + p);
    assert.notEqual(res.status, 200, p);
  }
});
