import puppeteer from 'puppeteer-core';
import { ORIGIN, TOKEN_A as TOKEN, chrome } from './env.mjs';
const b = await puppeteer.launch({
  executablePath: chrome(), headless: false,
  protocolTimeout: 60000,
  defaultViewport: { width: 420, height: 920 },
  args: ['--no-sandbox', '--use-fake-device-for-media-stream',
         '--use-fake-ui-for-media-stream', '--window-size=440,960'],
});
const p = await b.newPage();
p.on('console', m => { const t = m.text(); if (/error|fail/i.test(t)) console.log('  [page]', t.slice(0, 140)); });

await p.goto(`${ORIGIN}/#t=${TOKEN}`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1200));

console.log('═══ Đo độresponsive của main thread TRƯỚC start ═══');
const lat = async () => { const t0 = Date.now(); await p.evaluate(() => new Promise(r => setTimeout(r, 0))); return Date.now() - t0; };
console.log('  latency:', await lat(), 'ms');

console.log('\n═══ BẤM START ═══');
await p.click('#start');
await new Promise(r => setTimeout(r, 6000));
console.log('  status:', await p.$eval('#status', e => e.textContent));

console.log('\n═══ Main thread SAU start (MindAR đang quét) ═══');
for (let i = 0; i < 3; i++) {
  const t0 = Date.now();
  try { await p.evaluate(() => 1); console.log(`  evaluate() ${Date.now() - t0}ms`); }
  catch (e) { console.log(`  evaluate() TIMEOUT sau ${Date.now() - t0}ms`); }
}

console.log('\n═══ Click STOP bằng 2 cách ═══');
const t0 = Date.now();
try {
  await p.evaluate(() => document.getElementById('stop').click());
  console.log(`  [evaluate click] OK ${Date.now() - t0}ms`);
} catch (e) { console.log(`  [evaluate click] FAIL ${Date.now() - t0}ms: ${e.message.slice(0, 80)}`); }

await new Promise(r => setTimeout(r, 2500));
console.log('\n═══ KẾT QUẢ CLEANUP ═══');
console.log('  status  :', await p.$eval('#status', e => e.textContent));
console.log('  summary :', await p.$eval('#camera-summary', e => e.textContent));
const st = await p.evaluate(() => {
  const v = document.querySelector('#container video');
  return { tracks: v && v.srcObject ? v.srcObject.getVideoTracks().length : 0,
           live: v && v.srcObject ? v.srcObject.getVideoTracks().filter(t => t.readyState === 'live').length : 0,
           readyState: v ? v.readyState : 'n/a' };
});
console.log('  video   :', JSON.stringify(st));
console.log('  ✅ CLEANUP:', st.tracks === 0 && st.live === 0 ? 'PASS' : 'FAIL');

await b.close();
console.log('\n✅ xong\n');
