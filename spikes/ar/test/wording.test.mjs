// Review item: claims in the docs must not outrun the evidence. These guard specific overclaims from coming back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = ['README.md', 'I03-P04-privacy-fallback-port-review.md', 'evidence/P04-observations-template.md', 'evidence/P02-device-run-template.md'];
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('no document claims frames are never sent or that nothing leaves the device', () => {
  for (const f of docs) {
    assert.doesNotMatch(read(f), /no frames? (are|is) (ever )?(sent|uploaded)|frames? (are )?never (sent|uploaded|leave)|nothing leaves the device/i, f);
  }
  // the honest statement must be present instead
  assert.match(read('README.md'), /not established/);
  assert.match(read('I03-P04-privacy-fallback-port-review.md'), /What it does not support/);
});

test('docs do not say spike tests run in or fail in CI while the repository CI does not run them', () => {
  for (const f of docs) assert.doesNotMatch(read(f), /fails? in CI|CI (fails|catches|will catch)|caught by CI/i, f);
  assert.match(read('README.md'), /repository CI\s+does not run the spike tests/);
});

test('reproducibility is only claimed for the recorded environment', () => {
  const readme = read('README.md');
  assert.doesNotMatch(readme, /byte-reproducible(?! in)/);
  assert.match(readme, /recorded environment/);
  assert.match(readme, /not\s+claimed for other Node, OS or tfjs versions/);
});

test('the review doc states that a .mind file cannot prove its source and what manual-unverified means', () => {
  const doc = read('I03-P04-privacy-fallback-port-review.md');
  assert.match(doc, /not the source pixels/);
  assert.match(doc, /manual-unverified/);
});
