// I03-P04 static privacy review, codified. These checks inspect SOURCE and the installed library; they do not replace
// a real network trace on a phone (evidence/P04-observations-template.md). Do not read a pass as "no frame leaves the device".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const FRAME_OR_STORAGE_APIS = /\b(toBlob|toDataURL|getImageData|MediaRecorder|ImageCapture|createImageBitmap|readPixels|captureStream)\b/;
const EXTRA_CHANNELS = /\b(XMLHttpRequest|sendBeacon|WebSocket|EventSource|RTCPeerConnection|BroadcastChannel|navigator\.serviceWorker)\b/;
const PERSISTENCE = /\b(localStorage|indexedDB|document\.cookie)\b/;

test('page scripts never read camera pixels and open no network channel other than fetch', () => {
  for (const f of ['public/client.js', 'public/fallback.js']) {
    const src = strip(read(f));
    assert.doesNotMatch(src, FRAME_OR_STORAGE_APIS, `${f} touches frame/pixel APIs`);
    assert.doesNotMatch(src, EXTRA_CHANNELS, `${f} opens another network channel`);
    assert.doesNotMatch(src, PERSISTENCE, `${f} persists data beyond sessionStorage`);
  }
});

test('every fetch in the page scripts targets this origin under /api/spike/', () => {
  for (const f of ['public/client.js', 'public/fallback.js']) {
    const calls = [...strip(read(f)).matchAll(/fetch\(\s*([`'"])([^`'"]+)\1/g)].map((m) => m[2]);
    assert.ok(calls.length > 0, `${f} has fetch calls`);
    for (const url of calls) assert.match(url, /^\/api\/spike\//, `${f}: fetch(${url})`);
  }
});

test('the only data the page sends about a recognition is { artifactId, targetIndex }', () => {
  const src = read('public/client.js');
  const bodies = [...src.matchAll(/body:\s*JSON\.stringify\(([^)]*)\)/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
  assert.deepEqual(bodies, ['{ artifactId, targetIndex: index }']);
});

test('the bearer token travels only in the Authorization header, never in a URL', () => {
  for (const f of ['public/client.js', 'public/fallback.js']) {
    const src = strip(read(f));
    assert.doesNotMatch(src, /[?&](t|token|access_token)=/, `${f} puts a token in a URL`);
    assert.match(src, /history\.replaceState/, `${f} removes the #t= fragment from the address bar`);
  }
});

test('camera-free page loads no camera, AR or three.js code', () => {
  const html = read('public/fallback.html');
  const js = strip(read('public/fallback.js'));
  assert.deepEqual([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]), ['/fallback.js']);
  assert.doesNotMatch(html + js, /getUserMedia|mindar|mind-ar|three|importmap|\bimport\s/i);
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|document\.write/, 'content is inserted as text, not markup');
});

test('both pages send no Referer (a token must never leak through navigation)', () => {
  for (const f of ['public/index.html', 'public/fallback.html']) assert.match(read(f), /<meta name="referrer" content="no-referrer">/, f);
});

// Inventory of what the installed MindAR build can reach FROM THE ENTRY THE HARNESS LOADS. It documents the review; it
// does not prove runtime behaviour. The face-tracking chunk (controller-d1-*.js) fetches MediaPipe WASM from
// cdn.jsdelivr.net; it must stay unreachable from the image-tracking entry.
const installed = fs.existsSync(path.join(ROOT, 'node_modules/mind-ar/dist'));
const ENTRY = 'mindar-image-three.prod.js';
const KNOWN_URL_HOSTS = new Set([
  // licence headers, references and doc comments inside bundled third-party code
  'www.apache.org', 'opensource.org', 'github.com', 'developer.mozilla.org', 'beta.observablehq.com', 'arxiv.org',
  'www.jmlr.org', 'www.cs.toronto.edu', 'ruder.io', 'proceedings.mlr.press', 'www.shadertoy.com', 'strawlab.org',
  // JSDoc examples inside tfjs ("const modelUrl = ...", "model.save('http://my-server/...')"), not executed
  'storage.googleapis.com', 'my-server',
]);

function reachableFromEntry(dist) {
  const seen = new Set();
  const queue = [ENTRY];
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of fs.readFileSync(path.join(dist, f), 'utf8').matchAll(/from\s*"\.\/([^"]+\.js)"/g)) queue.push(m[1]);
  }
  return seen;
}

test('reviewed MindAR build: pinned version and no unreviewed remote host in the loaded modules', { skip: !installed && 'run npm ci --ignore-scripts' }, () => {
  const pkg = JSON.parse(read('node_modules/mind-ar/package.json'));
  assert.equal(pkg.version, '1.2.5', 'a different mind-ar version needs a fresh privacy review (update I03-P04 review)');
  const dist = path.join(ROOT, 'node_modules/mind-ar/dist');
  const loaded = reachableFromEntry(dist);
  assert.ok(loaded.size >= 3, 'entry plus sibling chunks were followed');
  const unknown = new Set();
  for (const f of loaded) {
    for (const m of fs.readFileSync(path.join(dist, f), 'utf8').matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
      if (!KNOWN_URL_HOSTS.has(m[1])) unknown.add(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual([...unknown], []);
});

test('the face-tracking chunk (remote MediaPipe WASM) is not reachable from the image entry', { skip: !installed }, () => {
  const dist = path.join(ROOT, 'node_modules/mind-ar/dist');
  const faceChunks = fs.readdirSync(dist).filter((f) => f.endsWith('.js') && fs.readFileSync(path.join(dist, f), 'utf8').includes('cdn.jsdelivr.net'));
  assert.ok(faceChunks.length > 0, 'the known face chunk still exists (if not, review this test)');
  const loaded = reachableFromEntry(dist);
  for (const f of faceChunks) assert.ok(!loaded.has(f), `${f} must not be loaded by ${ENTRY}`);
});
