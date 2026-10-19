import { PNG } from '/home/duc/Documents/Lumical-AR-spike/spikes/ar/node_modules/pngjs/lib/png.js';
import fs from 'node:fs';

// Giao thức chính xác: TARGET 6s → MẤT 6s → lặp (chu kỳ 12s)
const SRC = process.argv[2], OUT = process.argv[3];
const W = 512, H = 512, PER = 180, FPS = 30;   // 180 frames = 6s @30fps
const png = PNG.sync.read(fs.readFileSync(SRC));
const rgb = new Uint8Array(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const sx = Math.min(png.width - 1, Math.floor(x * png.width / W));
  const sy = Math.min(png.height - 1, Math.floor(y * png.height / H));
  const si = (png.width * sy + sx) * 4, di = (y * W + x) * 3;
  rgb[di] = png.data[si]; rgb[di + 1] = png.data[si + 1]; rgb[di + 2] = png.data[si + 2];
}
const toYuv = (blank) => {
  const y = new Uint8Array(W * H), ut = new Uint8Array(W * H), vt = new Uint8Array(W * H);
  const u = new Uint8Array((W >> 1) * (H >> 1)), v = new Uint8Array((W >> 1) * (H >> 1));
  for (let i = 0, j = 0; i < W * H; i++, j += 3) {
    const R = blank ? 128 : rgb[j], G = blank ? 128 : rgb[j + 1], B = blank ? 128 : rgb[j + 2];
    y[i] = Math.max(0, Math.min(255, Math.round(0.299 * R + 0.587 * G + 0.114 * B)));
    ut[i] = Math.max(0, Math.min(255, Math.round(-0.1687 * R - 0.3313 * G + 0.5 * B + 128)));
    vt[i] = Math.max(0, Math.min(255, Math.round(0.5 * R - 0.4187 * G - 0.0813 * B + 128)));
  }
  for (let cy = 0; cy < (H >> 1); cy++) for (let cx = 0; cx < (W >> 1); cx++) {
    const i = (cy * 2) * W + cx * 2, ci = cy * (W >> 1) + cx;
    u[ci] = (ut[i] + ut[i + 1] + ut[i + W] + ut[i + W + 1]) >> 2;
    v[ci] = (vt[i] + vt[i + 1] + vt[i + W] + vt[i + W + 1]) >> 2;
  }
  return Buffer.concat([Buffer.from(y), Buffer.from(u), Buffer.from(v)]);
};

const out = fs.createWriteStream(OUT);
out.write(Buffer.from(`YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`));
const on = toYuv(false), off = toYuv(true);
for (const buf of [on, off]) for (let f = 0; f < PER; f++) { out.write(Buffer.from('FRAME\n')); out.write(buf); }
out.end();
await new Promise(r => out.on('finish', r));
console.log(`✅ ${OUT} — TARGET 6s → MẤT 6s (chu kỳ 12s)`);
