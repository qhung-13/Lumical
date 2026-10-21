import puppeteer from 'puppeteer-core';
import { ORIGIN, TOKEN_A as TOKEN, chrome } from './env.mjs';

// ── CASE A: permission ĐƯỢC CẤP ─────────────────────────────
async function runA() {
  const b = await puppeteer.launch({
    executablePath: chrome(), headless: false, protocolTimeout: 60000,
    defaultViewport: { width: 420, height: 920 },
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const ctx = b.defaultBrowserContext();
  await ctx.overridePermissions(ORIGIN, ['camera']);
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  await p.goto(`${ORIGIN}/#t=${TOKEN}`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await p.evaluate(() => document.getElementById('start').click());
  await new Promise(r => setTimeout(r, 6000));
  console.log('\n═══ CASE A — Permission ĐƯỢC CẤP ═══');
  console.log('  status :', await p.$eval('#status', e => e.textContent));
  console.log('  summary:', await p.$eval('#camera-summary', e => e.textContent));
  const ok = await p.evaluate(() => {
    const v = document.querySelector('#container video');
    return v && v.srcObject ? v.srcObject.getVideoTracks().length : 0;
  });
  console.log('  tracks :', ok, ok > 0 ? '→ camera START ✅' : '→ ❌ FAIL');
  await p.evaluate(() => document.getElementById('stop').click());
  await new Promise(r => setTimeout(r, 2000));
  console.log('  sau stop:', await p.$eval('#camera-summary', e => e.textContent));
  console.log('  JS errors:', errs.length ? errs : 'không có');
  await b.close();
  return ok > 0;
}

// ── CASE B: permission BỊ TỪ CHỐI ──────────────────────────
async function runB() {
  const b = await puppeteer.launch({
    executablePath: chrome(), headless: false, protocolTimeout: 60000,
    defaultViewport: { width: 420, height: 920 },
    args: ['--no-sandbox', '--use-fake-device-for-media-stream'],  // KHÔNG dùng fake-ui
  });
  const ctx = b.defaultBrowserContext();
  await ctx.overridePermissions(ORIGIN, []);   // [] = TỪ CHỐI rõ ràng
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await p.goto(`${ORIGIN}/#t=${TOKEN}`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  console.log('\n═══ CASE B — Permission BỊ TỪ CHỐI ═══');
  await p.evaluate(() => document.getElementById('start').click());
  const seen = [];
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const st = await p.$eval('#status', e => e.textContent);
    const sum = await p.$eval('#camera-summary', e => e.textContent).catch(() => '-');
    if (!seen.length || seen[seen.length - 1].st !== st) seen.push({ t: i, st, sum });
    if (/denied|failed|unavailable|error/i.test(st)) break;
  }
  seen.forEach(s => console.log(`  +${s.t}s status : ${s.st}`));
  const last = seen[seen.length - 1];
  console.log('  summary:', last.sum);
  const denied = /denied|failed|unavailable|blocked|not allowed/i.test(last.st);
  console.log('  → thông báo lỗi hiển thị:', denied ? '✅ CÓ' : '❌ KHÔNG (user không biết bị từ chối)');
  // Fallback có chạy không?
  const fb = await p.evaluate(() => {
    const el = document.getElementById('fallback-link');
    return el ? { exists: true, hidden: el.hidden } : { exists: false };
  });
  console.log('  fallback element:', JSON.stringify(fb));
  // Vẫn bấm được Stop / page không crash?
  await p.evaluate(() => document.getElementById('stop').click()).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  console.log('  sau stop  :', await p.$eval('#status', e => e.textContent));
  console.log('  JS errors :', errs.length ? errs : 'không có');
  const crashed = await p.evaluate(() => true).catch(() => false);
  console.log('  page còn sống:', crashed ? '✅' : '❌');
  await b.close();
  return denied;
}

const a = await runA();
const bd = await runB();
console.log('\n════ TỔNG KẾT ════');
console.log('  Camera start khi được cấp quyền :', a ? 'PASS ✅' : 'FAIL ❌');
console.log('  Báo lỗi khi bị từ chối quyền    :', bd ? 'PASS ✅' : 'FAIL ❌');
console.log('\n✅ xong\n');
