import puppeteer from 'puppeteer-core';

const TOKEN = 'devtokenA123456789';
const ORIGIN = 'http://127.0.0.1:8787';

const b = await puppeteer.launch({
  browser: 'firefox',
  executablePath: '/tmp/opencode/ar-debug/firefox/linux-stable_158.0/firefox/firefox',
  headless: true,
  userDataDir: '/tmp/opencode/ar-debug/ff-profile',   // profile riêng — không đụng Firefox đang mở
  protocolTimeout: 60000,
  extraPrefsFirefox: {
    'media.navigator.streams.fake': true,          // fake camera trong Firefox
    'media.navigator.permission.disabled': true,   // không hỏi quyền
    'dom.disable_open_during_load': false,
  },
});
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 160)));

console.log('═══ FIREFOX 157 — load trang ═══');
await p.goto(`${ORIGIN}/#t=${TOKEN}`, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 2000));
console.log('  UA      :', (await p.evaluate(() => navigator.userAgent)).slice(0, 90));
console.log('  status  :', await p.$eval('#status', e => e.textContent));
console.log('  secureCtx:', await p.evaluate(() => window.isSecureContext));
console.log('  gUM có  :', await p.evaluate(() => !!navigator.mediaDevices?.getUserMedia));
const btnDisabled = await p.$eval('#start', e => e.disabled);
console.log('  Start disabled:', btnDisabled);

console.log('\n═══ BẤM START ═══');
await p.evaluate(() => document.getElementById('start').click());
for (let i = 0; i < 8; i++) {
  await new Promise(r => setTimeout(r, 1500));
  const st = await p.$eval('#status', e => e.textContent);
  if (i % 2 === 0 || /Scanning|denied|failed|unsupported/i.test(st)) console.log(`  +${(i + 1) * 1.5}s ${st}`);
  if (/Scanning|denied|failed|unsupported/i.test(st)) break;
}
const st = await p.$eval('#status', e => e.textContent);
console.log('  → status cuối :', st);
const sum = await p.$eval('#camera-summary', e => e.textContent).catch(() => '-');
console.log('  → summary     :', sum);
const tracks = await p.evaluate(() => {
  const v = document.querySelector('#container video');
  return v && v.srcObject ? v.srcObject.getVideoTracks().length : -1;
});
console.log('  → video tracks:', tracks);

console.log('\n═══ STOP — cleanup ═══');
await p.evaluate(() => document.getElementById('stop').click());
await new Promise(r => setTimeout(r, 2500));
console.log('  status  :', await p.$eval('#status', e => e.textContent));
console.log('  summary :', await p.$eval('#camera-summary', e => e.textContent).catch(() => '-'));

console.log('\n═══ JS errors ═══');
console.log('  ', errs.length ? errs : 'không có');

const ok = /Scanning/i.test(st) && tracks > 0;
console.log('\n═══ KẾT LUẬN FIREFOX ═══');
console.log('  Camera + AR:', ok ? 'PASS ✅' : 'FAIL ❌');
await b.close().catch(() => {});
process.exit(0);
