// Isolated AR spike server. Plain node:http, no framework. TLS is expected from the host / tunnel
// (the phone camera needs HTTPS); this process listens on HTTP behind it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadManifest, sha256 } from './manifest.mjs';
import { createRegistry, NOT_FOUND } from './registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STATIC = {
  '/': { file: 'public/index.html', type: 'text/html; charset=utf-8' },
  '/fallback': { file: 'public/fallback.html', type: 'text/html; charset=utf-8' },
  '/client.js': { file: 'public/client.js', type: 'text/javascript; charset=utf-8' },
  '/fallback.js': { file: 'public/fallback.js', type: 'text/javascript; charset=utf-8' },
  '/reveal-guard.js': { file: 'public/reveal-guard.js', type: 'text/javascript; charset=utf-8' },
  '/start-failure.js': { file: 'public/start-failure.js', type: 'text/javascript; charset=utf-8' },
  '/lifecycle.js': { file: 'public/lifecycle.js', type: 'text/javascript; charset=utf-8' },
  '/styles.css': { file: 'public/styles.css', type: 'text/css; charset=utf-8' },
};
const VENDOR = {
  '/vendor/three.module.js': 'node_modules/three/build/three.module.js',
};
// Directories of ES modules served read-only under a prefix. MindAR's entry file imports sibling chunks
// (./controller-*.js, ./ui-*.js), so its whole dist/ folder must be reachable, not just the entry file.
const MODULE_DIRS = [
  { prefix: '/vendor/three-addons/', dir: 'node_modules/three/examples/jsm' },
  { prefix: '/vendor/mindar/', dir: 'node_modules/mind-ar/dist' },
];

function baseHeaders(extra = {}) {
  return {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  };
}

function sendJson(res, { status, body }) {
  res.writeHead(status, baseHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
  res.end(JSON.stringify(body));
}

/** CSP: connect-src 'self' means camera frames cannot be posted to a third party from this page. */
function pageHeaders(rootDir, type, isIndex) {
  let scriptSrc = "'self' 'wasm-unsafe-eval'";
  if (isIndex) {
    const html = fs.readFileSync(path.join(rootDir, 'public/index.html'), 'utf8');
    const m = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
    if (m) scriptSrc += ` 'sha256-${Buffer.from(sha256(Buffer.from(m[1])), 'hex').toString('base64')}'`;
  }
  return baseHeaders({
    'Content-Type': type,
    'Content-Security-Policy': [
      "default-src 'none'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self' blob:",
      "worker-src 'self' blob:",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  });
}

function bearer(req) {
  const m = /^Bearer ([A-Za-z0-9_-]{16,128})$/.exec(req.headers.authorization || '');
  return m ? m[1] : null;
}

function readJson(req, limit = 1024) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        resolve({ tooLarge: true });
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve({ value: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
      } catch {
        resolve({ value: null });
      }
    });
    req.on('error', () => resolve({ value: null }));
  });
}

export function createServer({ registry, rootDir = ROOT }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    const p = url.pathname;
    try {
      if (req.method === 'GET' && STATIC[p]) {
        const s = STATIC[p];
        const body = fs.readFileSync(path.join(rootDir, s.file));
        res.writeHead(200, pageHeaders(rootDir, s.type, p === '/'));
        return res.end(body);
      }
      if (req.method === 'GET' && VENDOR[p]) {
        const body = fs.readFileSync(path.join(rootDir, VENDOR[p]));
        res.writeHead(200, baseHeaders({ 'Content-Type': 'text/javascript; charset=utf-8' }));
        return res.end(body);
      }
      const mod = req.method === 'GET' ? MODULE_DIRS.find((m) => p.startsWith(m.prefix)) : null;
      if (mod) {
        const base = path.join(rootDir, mod.dir);
        const target = path.resolve(base, decodeURIComponent(p.slice(mod.prefix.length)));
        if (!target.startsWith(base + path.sep) || !target.endsWith('.js') || !fs.existsSync(target)) return sendJson(res, NOT_FOUND);
        const body = fs.readFileSync(target);
        res.writeHead(200, baseHeaders({ 'Content-Type': 'text/javascript; charset=utf-8' }));
        return res.end(body);
      }
      if (p === '/healthz') return sendJson(res, { status: 200, body: { ok: true } });

      if (req.method === 'GET' && p === '/api/spike/session') return sendJson(res, registry.describeSession(bearer(req)));
      if (req.method === 'GET' && p === '/api/spike/content') return sendJson(res, registry.fallbackContent(bearer(req)));
      if (req.method === 'GET' && p.startsWith('/api/spike/artifacts/')) {
        const r = registry.fetchArtifact(bearer(req), decodeURIComponent(p.slice('/api/spike/artifacts/'.length)));
        if (r.buffer) {
          res.writeHead(200, baseHeaders({ 'Content-Type': 'application/octet-stream' }));
          return res.end(r.buffer);
        }
        return sendJson(res, r);
      }
      if (req.method === 'POST' && p === '/api/spike/reveal') {
        const body = await readJson(req);
        if (body.tooLarge) return sendJson(res, { status: 413, body: { code: 'PAYLOAD_TOO_LARGE' } });
        return sendJson(res, registry.reveal(bearer(req), body.value));
      }
      return sendJson(res, NOT_FOUND);
    } catch {
      if (res.headersSent) return res.end();
      return sendJson(res, { status: 500, body: { code: 'INTERNAL' } });
    }
  });
}

// ---- CLI entry -------------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = loadManifest(ROOT);
  const tokenA = process.env.SPIKE_TOKEN_A || randomBytes(24).toString('base64url');
  const tokenB = process.env.SPIKE_TOKEN_B || randomBytes(24).toString('base64url');
  const registry = createRegistry({
    manifest,
    rootDir: ROOT,
    sessions: [
      { token: tokenA, versionKey: 'A' },
      { token: tokenB, versionKey: 'B' },
    ],
    enableCombined: process.env.SPIKE_ENABLE_COMBINED === '1',
  });
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  createServer({ registry }).listen(port, host, () => {
    const base = process.env.SPIKE_PUBLIC_URL || `http://localhost:${port}`;
    console.log(`AR spike harness on http://${host}:${port}  (use HTTPS via tunnel/host for the phone camera)`);
    console.log(`Version A session: ${base}/#t=${tokenA}`);
    console.log(`Version B session: ${base}/#t=${tokenB}`);
    for (const k of ['A', 'B']) if (!manifest.versions[k]?.artifact) console.warn(`WARNING: no prepared artifact registered for version ${k} (see README step 3)`);
    if (process.env.SPIKE_ENABLE_COMBINED === '1') console.warn('TEST-ONLY combined artifact enabled');
  });
}
