// Live desktop denial check using the repository's existing Playwright install.
// No hardware, recognition, manual accessibility or independent-person acceptance is implied.
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/server.mjs';
import { createRegistry } from '../src/registry.mjs';
import { loadManifest } from '../src/manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browserName = process.argv[2] ?? 'chromium';
assert.ok(['chromium', 'firefox'].includes(browserName), 'Usage: node scripts/verify-browser.mjs [chromium|firefox]');
// Resolves an already declared/installed tool; does not add a spike runtime dependency.
const require = createRequire(path.resolve(root, '../../frontend/package.json'));
const playwright = require('@playwright/test');
const token = randomBytes(24).toString('base64url');
const registry = createRegistry({ rootDir: root, manifest: loadManifest(root), sessions: [{ token, versionKey: 'A' }] });
const server = createServer({ registry });
let browser;
let page;
const errors = [];
const requests = [];
const report = {
  kind: 'automated-live-desktop-denial', browser: browserName,
  environment: { platform: os.platform(), release: os.release(), arch: os.arch(), node: process.version },
  scope: 'localhost secure context; denied permission; no recognition or mobile acceptance',
};
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await playwright[browserName].launch(browserName === 'chromium' ? {
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  } : {
    headless: true,
    firefoxUserPrefs: { 'permissions.default.camera': 2, 'media.navigator.streams.fake': true },
  });
  report.version = browser.version();
  const context = await browser.newContext();
  page = await context.newPage();
  if (browserName === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Browser.setPermission', { origin, permission: { name: 'camera' }, setting: 'denied' });
  }
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (!['http:', 'https:'].includes(url.protocol)) return;
    requests.push({ method: request.method(), origin: url.origin === origin ? 'same' : url.origin,
      path: url.pathname, bodyBytes: Buffer.byteLength(request.postData() ?? '') });
  });
  report.stage = 'load';
  await page.goto(`${origin}/#t=${token}`);
  report.stage = 'session-ready';
  await page.waitForFunction(() => !document.getElementById('start').disabled, undefined, { timeout: 30000 });
  await page.locator('#start').click();
  report.stage = 'denial-feedback';
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('Camera permission was denied.'), undefined, { timeout: 30000 });
  const denial = await page.evaluate(() => ({
    status: document.getElementById('status').textContent,
    summary: document.getElementById('camera-summary').textContent,
    startEnabled: !document.getElementById('start').disabled,
    stopDisabled: document.getElementById('stop').disabled,
    choiceUnlocked: !document.getElementById('artifact-choice').disabled,
    getUserMediaDenied: document.getElementById('log').textContent.includes('NotAllowedError'),
    stopped: document.getElementById('log').textContent.includes('ar:stopped'),
    noVideoStreams: [...document.querySelectorAll('video')].every(video => !video.srcObject || video.srcObject.getTracks().every(track => track.readyState === 'ended')),
    fragmentRemoved: location.hash === '',
  }));
  assert.ok(denial.getUserMediaDenied && denial.stopped && denial.noVideoStreams);
  assert.ok(denial.startEnabled && denial.stopDisabled && denial.choiceUnlocked && denial.fragmentRemoved);
  assert.match(denial.summary, /0 live|none yet/);
  assert.deepEqual(errors, [], 'denial must not produce a page JS exception');
  const expected = registry.fallbackContent(token).body;
  report.stage = 'fallback';
  await page.locator('#fallback-link').click();
  await page.waitForFunction(() => !document.getElementById('reveal').hidden);
  const fallback = await page.locator('#reveal').evaluate(box => ({
    title: box.querySelector('h2').textContent, message: box.querySelector('p').textContent,
    image: box.querySelector('img').getAttribute('src'), alt: box.querySelector('img').alt,
  }));
  assert.deepEqual(fallback, { title: expected.title, message: expected.message, image: expected.image.dataUri, alt: expected.image.alt });
  assert.deepEqual(errors, []);
  const storage = await page.evaluate(async () => ({
    sessionStorageKeys: Object.keys(sessionStorage), localStorageKeys: Object.keys(localStorage),
    indexedDBNames: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map(db => db.name) : 'not-inspectable',
    cacheKeys: await caches.keys(), serviceWorkers: (await navigator.serviceWorker.getRegistrations()).length,
  }));
  report.result = 'PASS';
  report.denial = denial;
  report.fallback = { sameAuthorizedContent: true, imageLoaded: await page.locator('#reveal img').evaluate(img => img.complete && img.naturalWidth > 0) };
  report.storage = storage;
  report.cookies = (await context.cookies()).map(cookie => cookie.name);
  report.requests = requests;
  report.pageErrors = errors;
  report.offOriginRequests = requests.filter(request => request.origin !== 'same').length;
  report.bodyBytes = requests.reduce((sum, request) => sum + request.bodyBytes, 0);
  // Guard the recorded boundaries; these checks do not generalize beyond this denied-camera session.
  assert.equal(report.offOriginRequests, 0);
  assert.equal(report.bodyBytes, 0);
  assert.equal(report.fallback.imageLoaded, true);
  report.stage = 'complete';
} catch (error) {
  report.result = 'FAIL';
  report.failure = { name: error?.name, message: error?.message };
  report.pageErrors = errors;
  report.requests = requests;
  if (page && !page.isClosed()) report.diagnostics = await page.evaluate(() => ({ status: document.getElementById('status')?.textContent, log: document.getElementById('log')?.textContent.slice(0, 2500) })).catch(() => 'page unavailable');
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  console.log(JSON.stringify(report, null, 2).replaceAll(token, '<redacted>'));
}
