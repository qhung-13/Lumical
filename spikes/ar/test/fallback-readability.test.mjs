// I03-P04: the camera-free path must keep a readable image and message (BR-AR-004). Harness-level checks only;
// real-device readability (zoom, screen reader, small screens) is recorded in evidence/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContent } from '../src/content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

for (const key of ['A', 'B']) {
  test(`version ${key}: image has alt text, text contrast >= 4.5:1, and the message is real text`, () => {
    const c = buildContent(key);
    const svg = Buffer.from(c.image.dataUri.split(',')[1], 'base64').toString();
    const bg = /<rect[^>]*fill="(#[0-9a-f]{6})"/i.exec(svg)[1];
    const fg = /<text[^>]*fill="(#[0-9a-f]{6})"/i.exec(svg)[1];
    assert.ok(contrast(bg, fg) >= 4.5, `contrast ${contrast(bg, fg).toFixed(2)}`);
    assert.ok(c.image.alt.length >= 10, 'alt describes the image');
    assert.ok(c.message.length >= 40 && !svg.includes(c.message), 'message is not baked into the image');
    assert.ok(c.title && c.message);
  });
}

test('versions are visually and textually distinct (a wrong reveal would be noticeable)', () => {
  const [a, b] = [buildContent('A'), buildContent('B')];
  assert.notEqual(a.image.dataUri, b.image.dataUri);
  assert.notEqual(a.message, b.message);
});

test('fallback page marks status for assistive tech and shows content through text nodes', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public/fallback.html'), 'utf8');
  assert.match(html, /<html lang="en">/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  const js = fs.readFileSync(path.join(ROOT, 'public/fallback.js'), 'utf8');
  assert.match(js, /img\.alt = c\.image\.alt/);
  assert.match(js, /textContent = c\.title/);
});
