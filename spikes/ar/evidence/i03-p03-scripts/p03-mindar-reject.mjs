import puppeteer from 'puppeteer-core';

const ORIGIN = 'http://127.0.0.1:8787';
const b = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: false, protocolTimeout: 60000,
  defaultViewport: { width: 420, height: 600 },
  args: ['--no-sandbox', '--use-fake-device-for-media-stream'],
});
const ctx = b.defaultBrowserContext();
await ctx.overridePermissions(ORIGIN, []);   // TỪ CHỐI quyền camera
const p = await b.newPage();
await p.goto(`${ORIGIN}/#t=devtokenA123456789`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));

console.log('═══ MindAR.start() reject bằng CÁI GÌ khi bị từ chối quyền? ═══');
const res = await p.evaluate(async () => {
  const out = {};
  // 1. getUserMedia trực tiếp — confirm browser trả gì
  try { await navigator.mediaDevices.getUserMedia({ video: true }); out.gum = 'granted(!)'; }
  catch (e) { out.gum = `${e?.name}: ${e?.message}`; }

  // 2. Gọi MindAR.start() qua importmap
  try {
    const mod = await import('mindar-image-three');
    out.hasMindARThree = typeof mod.MindARThree;
    const m = new mod.MindARThree({
      container: document.getElementById('container'),
      imageTargetSrc: '/api/spike/artifacts/ar-c9a3a21cc733aafb9c70662428608a28229ede3adbb6fa9a15f29c68d67b33d3',
      uiLoading: 'no', uiScanning: 'no', uiError: 'no',
    });
    await m.start();
    out.mindarStart = 'resolved (unexpected)';
  } catch (e) {
    out.mindarStart = {
      type: typeof e,
      isNullish: e === null || e === undefined,
      isErr: e instanceof Error,
      name: e?.name ?? '(e.' + 'name' + ' => CRASH)',
      string: String(e),
    };
  }
  return out;
});
console.log(JSON.stringify(res, null, 2));

console.log('\n═══ Kết luận ═══');
const m = res.mindarStart;
if (m && m.isNullish) console.log('  ❌ MindAR start() REJECT VỚI undefined/null → client.js:191 crash là HỆ QUẢ');
else if (m && m.isErr) console.log('  ✅ MindAR ném Error đúng → lỗi nằm ở client.js');
else console.log('  ? khác:', JSON.stringify(m));

await b.close();
console.log('\n✅ xong\n');
