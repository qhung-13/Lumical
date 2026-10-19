import puppeteer from 'puppeteer-core';

const ORIGIN = 'http://127.0.0.1:8787';
const Y4M = process.argv[2] || '/tmp/opencode/ar-debug/b-cycle12.y4m';

const b = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: false, protocolTimeout: 90000,
  defaultViewport: { width: 420, height: 920 },
  args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
         `--use-file-for-fake-video-capture=${Y4M}`, '--window-size=440,960'],
});
const p = await b.newPage();
await p.goto(`${ORIGIN}/#t=devtokenB123456789`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));
await p.evaluate(() => document.getElementById('start').click());

console.log('file:', Y4M.split('/').pop());
console.log('═══ Theo dõi video stream 25 giây ═══');
console.log('  t   readyState currentTime paused  w×h     pixel(Target A/B màu mực?)  found');
for (let s = 1; s <= 25; s++) {
  await new Promise(r => setTimeout(r, 1000));
  const d = await p.evaluate(() => {
    const v = document.querySelector('#container video');
    const log = document.getElementById('log')?.textContent || '';
    let px = { meanR: 0, meanG: 0, meanB: 0, varied: false };
    if (v && v.videoWidth) {
      try {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const x = c.getContext('2d'); x.drawImage(v, 0, 0, 64, 64);
        const im = x.getImageData(0, 0, 64, 64).data;
        let sr = 0, sg = 0, sb = 0, min = 255, max = 0;
        for (let i = 0; i < im.length; i += 4) {
          sr += im[i]; sg += im[i + 1]; sb += im[i + 2];
          const l = (im[i] + im[i + 1] + im[i + 2]) / 3;
          if (l < min) min = l; if (l > max) max = l;
        }
        const n = im.length / 4;
        px = { meanR: Math.round(sr / n), meanG: Math.round(sg / n), meanB: Math.round(sb / n), min: Math.round(min), max: Math.round(max) };
      } catch (e) { px = { err: e.message.slice(0, 30) }; }
    }
    return {
      rs: v ? v.readyState : '-', ct: v ? +v.currentTime.toFixed(1) : '-', paused: v ? v.paused : '-',
      dims: v ? `${v.videoWidth}×${v.videoHeight}` : '-',
      px, found: (log.match(/target:found/g) || []).length,
      started: log.includes('ar:started'),
    };
  });
  console.log(`  ${String(s).padStart(2)}s  ${String(d.rs).padEnd(3)} ${String(d.ct).padStart(7)} ${String(d.paused).padEnd(6)} ${d.dims.padEnd(9)} R${d.px.meanR ?? '-'} G${d.px.meanG ?? '-'} B${d.px.meanB ?? '-'} span[${d.px.min ?? '-'}..${d.px.max ?? '-'}]  f=${d.found}${d.started ? '' : ' (chưa ar:started)'}`);
}
await b.close();
process.exit(0);
