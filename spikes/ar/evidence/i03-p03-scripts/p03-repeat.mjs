import puppeteer from 'puppeteer-core';
import { ORIGIN, TOKEN_A as TOKEN, chrome, scratch } from './env.mjs';

const Y4M = scratch('target-a.y4m');

const b = await puppeteer.launch({
  executablePath: chrome(), headless: false, protocolTimeout: 120000,
  defaultViewport: { width: 420, height: 920 },
  args: [
    '--no-sandbox',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-video-capture=${Y4M}`,   // camera thấy TARGET A thật
    '--window-size=440,960',
  ],
});
const p = await b.newPage();
const jsErr = [];
p.on('pageerror', e => jsErr.push(e.message.slice(0, 140)));

await p.goto(`${ORIGIN}/#t=${TOKEN}`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));

console.log('═══ START AR (camera thấy target A thật) ═══');
await p.evaluate(() => document.getElementById('start').click());
await new Promise(r => setTimeout(r, 6000));
console.log('  status:', await p.$eval('#status', e => e.textContent));

console.log('\n═══ Quan sát 40 giây (video lặp: 3s thấy → 3s mất → 3s thấy) ═══');
const events = [];
const t0 = Date.now();
let revealSeen = 0, lastRevealHidden = null;
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const snap = await p.evaluate(() => {
    const log = document.getElementById('log')?.textContent || '';
    const reveal = document.getElementById('reveal');
    const card = reveal && !reveal.hidden ? (reveal.querySelector('h2')?.textContent || '(có nội dung)') : null;
    return { log, card, revealHidden: reveal ? reveal.hidden : null,
             status: document.getElementById('status')?.textContent };
  });
  const found = (snap.log.match(/target:found/g) || []).length;
  const lost = (snap.log.match(/target:lost/g) || []).length;
  const revealOk = (snap.log.match(/reveal:ok|reveal:done|reveal:success/g) || []).length;
  const revealDenied = (snap.log.match(/reveal:denied/g) || []).length;
  if (i % 4 === 0 || (lastRevealHidden !== null && lastRevealHidden !== snap.revealHidden)) {
    console.log(`  +${i + 1}s  found=${found} lost=${lost} revealOk=${revealOk} denied=${revealDenied} | card=${snap.card ? `"${snap.card}"` : '(ẩn)'} | ${snap.status.slice(0, 50)}`);
  }
  lastRevealHidden = snap.revealHidden;
  if (snap.card) revealSeen = Math.max(revealSeen, 1);
  events.push({ t: i + 1, found, lost, revealOk, revealDenied, card: snap.card });
}

const finalLog = await p.evaluate(() => document.getElementById('log')?.textContent || '');
console.log('\n═══ EVIDENCE LOG (các sự kiện AR) ═══');
finalLog.split('\n').filter(l => /ar:started|target:|reveal:|status/.test(l))
  .forEach(l => console.log('  ' + l.trim().slice(0, 150)));

const last = events[events.length - 1];
const totalFound = last.found, totalLost = last.lost, totalReveal = last.revealOk, totalDenied = last.revealDenied;

console.log('\n═══════════════════════════════════════');
console.log('  📊 REPEAT SCAN KẾT QUẢ');
console.log('═══════════════════════════════════════');
console.log(`  target:found  : ${totalFound} lần`);
console.log(`  target:lost   : ${totalLost} lần`);
console.log(`  reveal (ok)   : ${totalReveal} lần`);
console.log(`  reveal denied : ${totalDenied} lần`);
console.log(`  JS errors     : ${jsErr.length ? jsErr.join('; ') : 'không có'}`);
const repeatable = totalFound >= 2 && totalLost >= 1 && totalReveal >= 1;
console.log(`\n  → REPEATABILITY (scope #8): ${repeatable ? 'PASS ✅ (tìm thấy ≥2 lần, mất ≥1 lần, reveal chạy)' : 'FAIL ❌'}`);
console.log(`  → Nhãn đúng phiên (reveal A): ${totalReveal >= 1 ? 'CÓ ✅' : 'KHÔNG — target không được nhận diện'}`);

await b.close();
process.exit(0);
