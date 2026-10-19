import puppeteer from 'puppeteer-core';

const ORIGIN = 'http://127.0.0.1:8787';
const TOKEN = 'devtokenA123456789';
const b = await puppeteer.launch({
  browser: 'firefox',
  executablePath: '/tmp/opencode/ar-debug/firefox/linux-stable_158.0/firefox/firefox',
  headless: true,
  userDataDir: '/tmp/opencode/ar-debug/ff-profile2',
  protocolTimeout: 60000,
  extraPrefsFirefox: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': false },
});
const ctx = b.defaultBrowserContext();
await ctx.overridePermissions(ORIGIN, []);   // TỪ CHỐI
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 200)));

await p.goto(`${ORIGIN}/#t=${TOKEN}`, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

console.log('═══ FIREFOX 158 — Permission BỊ TỪ CHỐI ═══');
await p.evaluate(() => document.getElementById('start').click());
const seen = [];
for (let i = 0; i < 9; i++) {
  await new Promise(r => setTimeout(r, 1200));
  const st = await p.$eval('#status', e => e.textContent);
  if (!seen.length || seen[seen.length - 1] !== st) seen.push(st);
  if (/denied|failed|unsupported|not supported/i.test(st)) break;
}
seen.forEach(s => console.log('  status:', s));
const last = seen[seen.length - 1];
console.log('  → Báo lỗi cho người dùng:', /denied|failed|unsupported/i.test(last) ? '✅ CÓ' : '❌ KHÔNG');
console.log('  → JS errors:', errs.length ? errs : 'không có');
console.log('  → Kết luận:', /denied/i.test(last) ? 'Firefox xử lý denial ĐÚNG (không như Chrome+MindAR)' : 'FAIL như Chrome');
await b.close().catch(() => {});
process.exit(0);
