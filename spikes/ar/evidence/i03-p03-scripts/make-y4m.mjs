// Sinh video Y4M (YUV420p) feed vào Chrome --use-file-for-fake-video-capture
// 3 pha lặp: TARGET A hiện → target biến mất (màu xám) → target hiện lại
// → đo được found → lost → found = REPEAT SCAN (scope #8 của I03-P03)
import { PNG } from '/home/duc/Documents/Lumical-AR-spike/spikes/ar/node_modules/pngjs/lib/png.js';
import fs from 'node:fs';

const SRC = '/home/duc/Documents/AR-targets/version-a.png';
const OUT = '/tmp/opencode/ar-debug/target-a.y4m';
const W = 512, H = 512;
const FRAMES_PER_PHASE = 90;   // 3 giây/pha @30fps
const FPS = 30;

const png = PNG.sync.read(fs.readFileSync(SRC));

// resize PNG → W×H (nearest, đủ cho feature matching)
const scaled = new Uint8Array(W * H * 3);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const sx = Math.min(png.width - 1, Math.floor(x * png.width / W));
    const sy = Math.min(png.height - 1, Math.floor(y * png.height / H));
    const si = (png.width * sy + sx) * 4;
    const di = (y * W + x) * 3;
    scaled[di] = png.data[si];
    scaled[di + 1] = png.data[si + 1];
    scaled[di + 2] = png.data[si + 2];
  }
}

const rgbToYuv = (rgb, phase) => {
  const y = new Uint8Array(W * H);
  const u = new Uint8Array((W >> 1) * (H >> 1));
  const v = new Uint8Array((W >> 1) * (H >> 1));
  // chuẩn bị U/V tạm ở full res rồi downsample
  const ut = new Uint8Array(W * H), vt = new Uint8Array(W * H);
  for (let i = 0, j = 0; i < W * H; i++, j += 3) {
    const R = phase ? 128 : rgb[j], G = phase ? 128 : rgb[j + 1], B = phase ? 128 : rgb[j + 2];
    let Y = 0.299 * R + 0.587 * G + 0.114 * B;
    y[i] = Math.max(0, Math.min(255, Math.round(Y)));
    ut[i] = Math.max(0, Math.min(255, Math.round(-0.1687 * R - 0.3313 * G + 0.5 * B + 128)));
    vt[i] = Math.max(0, Math.min(255, Math.round(0.5 * R - 0.4187 * G - 0.0813 * B + 128)));
  }
  for (let cy = 0; cy < H >> 1; cy++) {
    for (let cx = 0; cx < W >> 1; cx++) {
      const i = (cy * 2) * W + cx * 2;
      const ci = cy * (W >> 1) + cx;
      u[ci] = (ut[i] + ut[i + 1] + ut[i + W] + ut[i + W + 1]) >> 2;
      v[ci] = (vt[i] + vt[i + 1] + vt[i + W] + vt[i + W + 1]) >> 2;
    }
  }
  return Buffer.concat([Buffer.from(y), Buffer.from(u), Buffer.from(v)]);
};

const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`);
const frameTag = Buffer.from('FRAME\n');

const out = fs.createWriteStream(OUT);
out.write(header);

// 3 pha: 0 = target hiện, 1 = xám (mất), 2 = target hiện lại
const phases = [0, 1, 0];
let written = 0;
for (const phase of phases) {
  const yuv = rgbToYuv(scaled, phase);
  for (let f = 0; f < FRAMES_PER_PHASE; f++) {
    out.write(frameTag);
    out.write(yuv);
    written++;
  }
}
out.end();

out.on('finish', () => {
  const size = fs.statSync(OUT).size;
  console.log(`✅ ${OUT}`);
  console.log(`   ${W}x${H} @${FPS}fps · ${written} frames · ${(size / 1048576).toFixed(1)} MB`);
  console.log(`   pha: TARGET (3s) → MẤT (3s) → TARGET (3s) — lặp vô hạn`);
});
