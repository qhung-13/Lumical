// Deterministic synthetic "calendar page" images. No real photos, no participant content.
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Returns { width, height, pixels } for a feature-rich synthetic calendar-like page. */
export function renderSyntheticPage({ seed, size = 1024 }) {
  const rnd = mulberry32(seed);
  const px = new Uint8Array(size * size * 3);
  const int = (n) => Math.floor(rnd() * n);
  const color = () => [int(256), int(256), int(256)];
  const dark = () => [int(90), int(90), int(90)];
  const rect = (x0, y0, w, h, c) => {
    for (let y = Math.max(0, y0); y < Math.min(size, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(size, x0 + w); x++) {
        const i = (y * size + x) * 3;
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
      }
    }
  };
  const disc = (cx, cy, r, c) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) rect(cx + x, cy + y, 1, 1, c);
  };
  const line = (x0, y0, x1, y1, th, c) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s++) rect(Math.round(x0 + ((x1 - x0) * s) / steps), Math.round(y0 + ((y1 - y0) * s) / steps), th, th, c);
  };

  rect(0, 0, size, size, [246, 243, 236]);
  const header = Math.floor(size * 0.16);
  rect(0, 0, size, header, color());
  for (let i = 0; i < 14; i++) disc(int(size), int(header), 8 + int(26), color()); // header texture

  const margin = 48;
  const cols = 7;
  const rows = 6;
  const cw = Math.floor((size - margin * 2) / cols);
  const ch = Math.floor((size - header - margin * 2) / rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = margin + c * cw;
      const y0 = header + margin + r * ch;
      for (let k = 0; k < 4; k++) rect(x0 + 6 + int(cw - 40), y0 + 6 + int(ch - 40), 14 + int(cw / 3), 14 + int(ch / 3), color());
      const lx = x0 + 8 + int(cw / 2);
      const ly = y0 + 8 + int(ch / 2);
      line(lx, ly, lx + int(40) - 20, ly + int(40) - 20, 5, dark());
      for (let k = 0; k < 5; k++) rect(x0 + 8 + int(30), y0 + 8 + int(30), 4 + int(10), 8 + int(14), dark()); // digit-like blobs
    }
  }
  for (let r = 0; r <= rows; r++) rect(margin, header + margin + r * ch - 2, cols * cw, 4, dark());
  for (let c = 0; c <= cols; c++) rect(margin + c * cw - 2, header + margin, 4, rows * ch, dark());
  for (let i = 0; i < 18; i++) disc(margin + int(cols * cw), header + margin + int(rows * ch), 10 + int(22), color());
  return { width: size, height: size, pixels: px };
}

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export function renderPng(opts) {
  const { width, height, pixels } = renderSyntheticPage(opts);
  return { png: encodePng(width, height, pixels), pixelSha256: sha256(pixels) };
}
