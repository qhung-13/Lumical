// Regression for the I03-P03 finding (Chrome 155 and Firefox 158): when camera permission is denied, MindAR 1.2.5 rejects
// start() with `undefined`; the page read `err.name`, threw a TypeError inside its own catch block, never cleaned up and
// left the status on "Loading…". The page must classify ANY rejection value without throwing and must say what happened.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyStartFailure } from '../public/start-failure.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = fs.readFileSync(path.join(ROOT, 'public/client.js'), 'utf8');
const denied = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });

test('the measured case: start() rejects with undefined after a NotAllowedError from getUserMedia', () => {
  const f = classifyStartFailure({ error: undefined, lastGetUserMediaError: denied });
  assert.equal(f.name, 'NotAllowedError');
  assert.equal(f.source, 'getUserMedia-error');
  assert.equal(f.rejectedWith, 'undefined');
  assert.equal(f.text, 'Camera permission was denied.');
  assert.equal(f.denied, true);
  assert.equal(f.disableStart, false, 'the person can grant permission and try again');
});

test('undefined rejection with no recorded error: the Permissions API result is used when it says denied', () => {
  const f = classifyStartFailure({ error: undefined, cameraPermission: 'denied' });
  assert.equal(f.name, 'NotAllowedError');
  assert.equal(f.source, 'permissions-api');
});

test('undefined rejection and nothing else known: an honest generic message, never a crash and never a guess', () => {
  for (const cameraPermission of [undefined, 'unknown', 'prompt', 'granted']) {
    const f = classifyStartFailure({ error: undefined, cameraPermission });
    assert.equal(f.name, 'UnknownStartFailure');
    assert.equal(f.denied, false, 'denial is not claimed without evidence');
    assert.match(f.text, /could not start/);
  }
});

test('any rejection value is classified without throwing', () => {
  for (const error of [undefined, null, '', 'boom', 0, 42, false, {}, { name: '' }, { name: 5 }, [], Symbol('x')]) {
    assert.doesNotThrow(() => classifyStartFailure({ error }), String(typeof error));
    const f = classifyStartFailure({ error });
    assert.equal(typeof f.text, 'string');
    assert.ok(f.text.length > 0);
  }
  assert.doesNotThrow(() => classifyStartFailure());
});

test('a real Error keeps its own name and wins over older evidence', () => {
  const f = classifyStartFailure({ error: Object.assign(new Error('x'), { name: 'NotFoundError' }), lastGetUserMediaError: denied, cameraPermission: 'denied' });
  assert.equal(f.name, 'NotFoundError');
  assert.equal(f.source, 'error');
  assert.equal(f.text, 'No camera was found.');
  assert.equal(f.denied, false);
});

test('unsupported disables Start; other failures leave it enabled; unknown error names get a generic message', () => {
  assert.equal(classifyStartFailure({ error: Object.assign(new Error(), { name: 'UnsupportedError' }) }).disableStart, true);
  assert.equal(classifyStartFailure({ error: Object.assign(new Error(), { name: 'PreparationUnavailable' }) }).disableStart, false);
  assert.equal(classifyStartFailure({ error: Object.assign(new Error(), { name: 'WeirdError' }) }).text, 'AR failed to start.');
});

test('client.js never dereferences the rejected value directly and records the getUserMedia error', () => {
  const start = client.indexOf('async function start()');
  const stop = client.indexOf('async function stop(');
  const body = client.slice(start, stop);
  const catchBlock = body.slice(body.lastIndexOf('} catch (err) {'));
  assert.doesNotMatch(catchBlock, /\berr\.(name|message)\b/, 'err may be undefined');
  assert.match(catchBlock, /classifyStartFailure\(\{ error: err, lastGetUserMediaError/);
  assert.match(catchBlock, /await stop\(true\)/);
  assert.match(client, /lastGetUserMediaError = err;/);
  assert.match(client, /lastGetUserMediaError = null;/);
  assert.match(client, /navigator\.permissions\?\.query\(\{ name: 'camera' \}\)/);
  assert.match(client, /import \{ classifyStartFailure \} from '\.\/start-failure\.js'/);
});

test('the status after a failed start names the cause and points to the camera-free view', () => {
  assert.match(client, /setStatus\(`\$\{failure\.text\} Use “View without camera” for the same content\.`\)/);
});
