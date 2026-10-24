import puppeteer from 'puppeteer-core';
import { ORIGIN, TOKEN_A as TOKEN, chrome } from './env.mjs';

const b = await puppeteer.launch({
  executablePath: chrome(), headless: false, protocolTimeout: 60000,
  defaultViewport: { width: 420, height: 920 },
  args: ['--no-sandbox', '--use-fake-device-for-media-stream'],  // KHÔNG fake-ui
});
const ctx = b.defaultBrowserContext();
await ctx.overridePermissions(ORIGIN, []);   // TỪ CHỐI quyền
const p = await b.newPage();

const errs = [];
p.on('pageerror', e => errs.push({ msg: e.message, stack: e.stack }));
p.on('console', m => { if (m.type() === 'error') errs.push({ msg: '[console] ' + m.text().slice(0, 300) }); });

await p.goto(`${ORIGIN}/#t=${TOKEN}`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1000));

// Bắt lỗi TẠI NƠI NÓ RA: monkey-patch để xem getUserMedia trả gì
await p.evaluate(() => {
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    try { const s = await orig(c); window.__gum = { ok: true, tracks: s.getTracks().length }; return s; }
    catch (e) { window.__gum = { ok: false, type: typeof e, isErr: e instanceof Error, val: String(e), name: e && e.name }; throw e; }
  };
});

console.log('═══ BẤM START (permission bị từ chối) ═══');
await p.evaluate(() => document.getElementById('start').click());
await new Promise(r => setTimeout(r, 7000));

console.log('\n── getUserMedia trả về gì? ──');
console.log('  ', JSON.stringify(await p.evaluate(() => window.__gum)));

console.log('\n── Status cuối ──');
console.log('  ', await p.$eval('#status', e => e.textContent));

console.log('\n── PAGE ERRORS ──');
errs.forEach((e, i) => {
  console.log(`  [${i}] ${e.msg}`);
  if (e.stack) e.stack.split('\n').slice(0, 5).forEach(l => console.log(`       ${l.trim()}`));
});

console.log('\n── Evidence log (phần getUserMedia / ar:) ──');
const ev = await p.evaluate(() => {
  const el = document.getElementById('log');   // UI dùng #log, không phải #evidence
  return el ? el.textContent : '(không có #log)';
});
console.log('  ' + ev.split('\n').filter(l => /getUserMedia|ar:|error/i.test(l)).join('\n  '));

console.log('\n── Fallback link có hiện không ──');
console.log('  ', await p.evaluate(() => {
  const f = document.getElementById('fallback-link');
  return f ? { text: f.textContent.trim(), visible: !!f.offsetParent } : 'không có';
}));

// Người dùng bấm "View without camera" có được không?
const fbOk = await p.evaluate(() => {
  const f = document.getElementById('fallback-link');
  if (!f) return 'no-element';
  return { href: f.getAttribute('href'), hidden: !!f.closest('[hidden]') };
});
console.log('  fallback-route:', JSON.stringify(fbOk));

await b.close();
console.log('\n✅ xong\n');
