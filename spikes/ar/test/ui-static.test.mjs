// Guards for UI defects found in the I03-P03 device/desktop test (MEMBER_4, 2026-10-18). They read source; they do not
// replace a real device run, but each one is a defect that blocked or misled the first phone test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('#container is a stacking context so MindAR\'s z-index:-2 video is not painted behind its background', () => {
  const rule = /#container\s*\{([^}]*)\}/.exec(read('public/styles.css'))[1];
  assert.match(rule, /position:\s*relative/);
  assert.match(rule, /z-index:\s*0/, 'without z-index the camera area is black');
});

test('camera summary refreshes when tracks are created or end and after AR starts, not only on stop', () => {
  const js = read('public/client.js');
  const wrapper = js.slice(js.indexOf('md.getUserMedia = async'), js.indexOf('// ---- session'));
  assert.match(wrapper, /log\('track:created'[^;]*;\s*updateCameraSummary\(\)/);
  assert.match(wrapper, /track:ended[^\n]*updateCameraSummary\(\)/);
  const started = js.slice(js.indexOf("log('ar:started'"));
  assert.match(started.slice(0, 200), /updateCameraSummary\(\)/);
});

test('artifact choice is locked while AR runs and unlocked on stop (a late change must not look like a test)', () => {
  const js = read('public/client.js');
  assert.match(js, /setArtifactChoiceLocked\(true\)/);
  assert.match(js, /setArtifactChoiceLocked\(false\)/);
  assert.match(js, /input\[name=artifact\]'\)\.forEach\(\(r\) => r\.addEventListener\('change'/);
});

test('status always names the artifact in use and shows loading and scanning progress', () => {
  const js = read('public/client.js');
  assert.match(js, /Fetching prepared target \(\$\{artifactLabel\(art\)\}\)/);
  assert.match(js, /Loading the target and starting the camera/);
  assert.match(js, /Scanning with the \$\{artifactLabel\(art\)\} artifact/);
  assert.match(js, /artifact: artifactLabel\(art\)/, 'evidence log records which artifact ran');
});

test('recognized-but-refused shows an explicit message instead of silence', () => {
  assert.match(read('public/client.js'), /This target has nothing to show in this session\./);
});
