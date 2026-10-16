import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPng, renderSyntheticPage, sha256 } from '../src/synth-image.mjs';

test('synthetic pages are pixel-deterministic per seed', () => {
  const a1 = renderPng({ seed: 1001, size: 256 });
  const a2 = renderPng({ seed: 1001, size: 256 });
  assert.equal(a1.pixelSha256, a2.pixelSha256);
});

test('different seeds give different targets (A, B, unknown)', () => {
  const hashes = [1001, 2002, 9009].map((seed) => renderPng({ seed, size: 256 }).pixelSha256);
  assert.equal(new Set(hashes).size, 3);
});

test('png output is a valid PNG header with the right size', () => {
  const { png } = renderPng({ seed: 1, size: 64 });
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 64);
  assert.equal(png.readUInt32BE(20), 64);
});

test('page is not flat (feature-rich enough to be a plausible target)', () => {
  const { pixels } = renderSyntheticPage({ seed: 1001, size: 256 });
  const distinct = new Set();
  for (let i = 0; i < pixels.length; i += 3) distinct.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
  assert.ok(distinct.size > 50);
  assert.equal(sha256(pixels).length, 64);
});
