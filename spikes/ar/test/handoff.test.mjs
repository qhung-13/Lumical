// Guards for the P06 handoff pack: it must not claim an independent reproduction that has not happened, and every file it
// points at must exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const handoff = read('I03-P06-handoff.md');
const record = read('evidence/P06-reproduction-record.md');

test('revised handoff remains review-pending and never claims the transferred independent run is done', () => {
  assert.doesNotMatch(handoff, /- \[[xX]\]/);
  assert.match(handoff, /Handoff prepared; independent reproduction NOT done/);
  assert.match(handoff, /SELECT WITH CONDITIONS/);
  assert.match(handoff, /READY FOR REVIEW/);
  assert.match(handoff, /I08-P06\/I12-P05/);
  assert.match(handoff, /review still pending/);
  assert.match(handoff, /conditional/);
});

test('the reproducer is required to be someone other than the author', () => {
  assert.match(handoff, /The author must not be the reproducer/);
  assert.match(record, /must not be the author/);
});

test('the reproduction record ships empty: no result cells are pre-filled', () => {
  const rows = record.split('\n').filter((l) => /^\| (1|2a|2b|3|4|5|6|7) \|/.test(l));
  assert.equal(rows.length, 8);
  for (const row of rows) {
    const cells = row.split('|').slice(1, -1).map((c) => c.trim());
    assert.ok(cells.slice(3).every((c) => c === ''), `observed/attempts/light/... must be empty: ${row.slice(0, 50)}`);
  }
  assert.doesNotMatch(record, /\b(PASS|MATCH)\b(?! \/)/, 'no pre-filled pass result');
});

test('relative links and backticked repository paths in the handoff resolve to real files', () => {
  const links = [...handoff.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)].map((m) => m[1]).filter((l) => !/^https?:/.test(l));
  assert.ok(links.length > 5);
  for (const link of links) assert.ok(fs.existsSync(path.resolve(ROOT, link)), `broken link: ${link}`);
  const paths = [...handoff.matchAll(/`((?:public|src|test|port|evidence|scripts|fixtures)\/[A-Za-z0-9_./-]+\.[a-z]+)`/g)].map((m) => m[1]);
  assert.ok(paths.length > 0);
  for (const p of paths) assert.ok(fs.existsSync(path.join(ROOT, p)), `missing file: ${p}`);
});

test('the owner smoke check is labelled as not recorded evidence', () => {
  assert.match(handoff, /Not recorded evidence/);
  assert.doesNotMatch(handoff, /supported (on|combination)/i, 'no support claim');
});

test('the failed-device limits and recorded numbers are preserved', () => {
  assert.match(handoff, /4\/5 at 512 px/);
  assert.match(handoff, /0\/5 at 512 px and 3\/5 at native 1024 px/);
  assert.match(handoff, /rejects `start\(\)` with `undefined`/);
});
