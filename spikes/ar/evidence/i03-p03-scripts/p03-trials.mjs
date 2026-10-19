import puppeteer from 'puppeteer-core';

const ORIGIN = 'http://127.0.0.1:8787';
const TRIALS = 5;
const WAIT_MS = 12000;   // thời gian chờ nhận diện mỗi trial

async function trialSet(label, token, y4m) {
  const b = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: false, protocolTimeout: 90000,
    defaultViewport: { width: 420, height: 920 },
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
           `--use-file-for-fake-video-capture=${y4m}`, '--window-size=440,960'],
  });
  let hits = 0; const detail = [];
  for (let t = 1; t <= TRIALS; t++) {
    const p = await b.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message.slice(0, 90)));
    await p.goto(`${ORIGIN}/#t=${token}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));
    await p.evaluate(() => document.getElementById('start').click());
    await new Promise(r => setTimeout(r, WAIT_MS));
    const s = await p.evaluate(() => {
      const log = document.getElementById('log')?.textContent || '';
      const rv = document.getElementById('reveal');
      return {
        found: (log.match(/target:found/g) || []).length,
        revealOk: (log.match(/reveal:ok/g) || []).length,
        card: rv && !rv.hidden ? (rv.querySelector('h2')?.textContent || '?') : null,
        started: log.includes('ar:started'),
        st: document.getElementById('status')?.textContent || '',
      };
    });
    const hit = s.found > 0;
    if (hit) hits++;
    detail.push(`#${t}:${hit ? 'HIT' : 'MISS'}(found=${s.found},reveal=${s.revealOk},card=${s.card || '-'})${s.started ? '' : ',NO-START'}${errs.length ? ',ERR:' + errs[0] : ''}`);
    await p.close();
  }
  await b.close();
  console.log(`\n═══ ${label} ═══`);
  detail.forEach(d => console.log('   ' + d));
  console.log(`   → ${hits}/${TRIALS} trial nhận diện được (${Math.round(hits / TRIALS * 100)}%)`);
  return { label, hits, trials: TRIALS };
}

const A = await trialSet('TARGET A — phiên A, per-version A', 'devtokenA123456789', '/tmp/opencode/ar-debug/a-always.y4m');
const B = await trialSet('TARGET B — phiên B, per-version B', 'devtokenB123456789', '/tmp/opencode/ar-debug/b-always.y4m');

console.log('\n════════════════════════════════════════════');
console.log('  📊 NHẬN DIỆN THEO TRIAL (target luôn hiện, 12s/trial)');
console.log('════════════════════════════════════════════');
console.log(`  Target A: ${A.hits}/${A.trials} (${Math.round(A.hits / A.trials * 100)}%)`);
console.log(`  Target B: ${B.hits}/${B.trials} (${Math.round(B.hits / B.trials * 100)}%)`);
console.log('════════════════════════════════════════════\n');
process.exit(0);
