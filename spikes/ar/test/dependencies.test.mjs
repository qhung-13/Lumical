// Guards the dependency overrides that remove the audit findings, and the facts the README relies on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')).packages;
const version = (name) => lock[`node_modules/${name}`]?.version;
const atLeast = (v, min) => v.split('.').map(Number).reduce((r, n, i) => (r !== 0 ? r : n - min.split('.').map(Number)[i]), 0) >= 0;

test('package.json declares the tar and argparse overrides', () => {
  assert.deepEqual(pkg.overrides, { tar: '^7.5.22', argparse: '^2.0.1' });
});

test('the lockfile resolves patched versions and no longer contains sprintf-js', () => {
  assert.ok(atLeast(version('tar'), '7.5.22'), `tar ${version('tar')}`);
  assert.match(version('argparse'), /^2\./);
  assert.equal(version('sprintf-js'), undefined, 'argparse@2 has no sprintf-js; no patched sprintf-js exists');
});

test('direct dependencies stay pinned to exact versions', () => {
  assert.deepEqual(pkg.dependencies, { '@tensorflow/tfjs': '4.22.0', 'mind-ar': '1.2.5', pngjs: '7.0.0', three: '0.160.0' });
});

test('the README states the trade-off instead of claiming an upstream fix', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.match(readme, /deliberate trade-off, not an upstream fix/);
  assert.match(readme, /A clean\s+`npm audit` does not mean the libraries are safe/);
});
