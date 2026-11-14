import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { deflateSync } from 'node:zlib';
import pg from 'pg';
import request from 'supertest';
import { withDisposablePostgres } from './disposable-postgres.mjs';
import { assertRequiredGates, missingProviderConfig, providerErrorKind, requireG4ImageCapacity } from './media-privacy-gates.mjs';

/**
 * I06-P07 — genuine Cloudinary private-storage acceptance (G0-G6).
 *
 * Opt-in (never part of `test:db`, so an offline run cannot pass a provider gate):
 *   pnpm --dir backend test:media:privacy
 *
 * Synthetic media only. Every object this run uploads is destroyed in `finally`
 * by exact binding (owner/asset/upload-intent UUIDs), never by lookup of a
 * foreign object. Output is evidence: labels and provider facts only — no API
 * secret, no signature, no signed delivery URL, no session cookie.
 */

const backend = fileURLToPath(new URL('..', import.meta.url));
const origin = 'https://lumical.test';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- B1 gate: no provider call happens without the configured account -----
const absent = missingProviderConfig(process.env);
if (absent.length) {
  console.error(`ENVIRONMENT BLOCKED: I06-P07 requires isolated Cloudinary configuration (${absent.join(', ')}).`);
  process.exit(1);
}
const cloud = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const secret = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
const require = createRequire(import.meta.url);
const { MEDIA_LIMITS } = require('../dist/modules/media/domain/media.js');

const evidence = [];
const passed = new Set();
let phase = 'setup';
// PASS/NOTE/SKIP are counted separately so a mandatory gate can never be
// reported as PASS when it only produced a NOTE or a SKIP (LEAD review).
const counts = { pass: 0, note: 0, skip: 0 };
function pass(gate, text) {
  passed.add(gate);
  counts.pass += 1;
  evidence.push(text);
  console.log(`PASS: ${text}`);
}
function note(text) {
  counts.note += 1;
  evidence.push(`NOTE: ${text}`);
  console.log(`NOTE: ${text}`);
}
function skip(text) {
  counts.skip += 1;
  evidence.push(`SKIP: ${text}`);
  console.log(`SKIP: ${text}`);
}
// ---- Synthetic media (PNG / GIF / WAV), generated in memory only -----------
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBZkAAAAASUVORK5CYII=',
  'base64',
);
const GIF_1X1 = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);
const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value;
  }
  return table;
})();
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, checksum]);
}
/** Lossless 8-bit truecolour PNG with incompressible scanlines (well above 10 MB). */
function noisyPng(width, height) {
  const stride = width * 3 + 1;
  const scanlines = randomBytes(stride * height);
  for (let row = 0; row < height; row += 1) scanlines[row * stride] = 0;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
/** 8-bit mono PCM WAV, 61 s of silence: over the 60 s audio policy by design. */
function longWav(seconds = 61, sampleRate = 8000) {
  const samples = Buffer.alloc(sampleRate * seconds, 0x80);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
}
function looksLikeMedia(buffer) {
  const head = buffer.subarray(0, 12);
  return (
    head.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ) || // PNG
    (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) || // JPEG
    head.subarray(0, 3).toString('ascii') === 'GIF' || // GIF
    head.subarray(0, 4).toString('ascii') === 'RIFF' || // WAV/WEBP
    head.subarray(4, 8).toString('ascii') === 'ftyp' // MP4/M4A
  );
}

const imageAppLimit = MEDIA_LIMITS.IMAGE.maxBytes;
const inBandPng = noisyPng(1733, 2000);
let usage;
try {
  assert.match(cloud, /^[a-z0-9_-]+$/i);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/usage`, {
    headers: { Authorization: `Basic ${secret}` },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (response.ok) usage = await response.json();
  else await response.body?.cancel();
} catch { /* Keep provider credentials and raw errors out of diagnostics. */ }
const imagePlanLimit = requireG4ImageCapacity(usage, inBandPng.length, imageAppLimit);
if (imagePlanLimit === undefined) {
  console.error(`ENVIRONMENT BLOCKED: G4 requires a verified provider image limit of at least ${inBandPng.length} bytes. No synthetic uploads were attempted.`);
  process.exitCode = 1;
} else await withDisposablePostgres(async ({ url }) => {
  const { Test } = require('@nestjs/testing');
  const { AppModule } = require('../dist/app.module.js');
  const { configureApp } = require('../dist/config/configure-app.js');
  const { MediaInspection } = require('../dist/modules/media/application/finalize-media.js');
  const { CloudinaryInspection } = require('../dist/modules/media/infrastructure/cloudinary-inspection.js');
  const { CloudinaryPurge } = require('../dist/modules/media/infrastructure/cloudinary-purge.js');
  Object.assign(process.env, {
    NODE_ENV: 'production',
    IDENTITY_COOKIE_MODE: 'https',
    IDENTITY_SECRET_KEY: randomBytes(32).toString('hex'),
    IDENTITY_ALLOWED_ORIGINS: origin,
    IDENTITY_AUTH_ATTEMPTS: '1000',
    IDENTITY_TRUSTED_PROXY_IPS: '',
    DATABASE_URL: url('runtime', 'lumical_i01_blank'),
  });
  await promisify(execFile)(
    process.execPath,
    ['scripts/prisma.mjs', 'migrate', 'deploy'],
    {
      cwd: backend,
      env: {
        ...process.env,
        MIGRATION_DATABASE_URL: url('migration', 'lumical_i01_blank'),
      },
    },
  );
  const db = new pg.Client({
    connectionString: url('migration', 'lumical_i01_blank'),
  });
  await db.connect();

  const inspection = new CloudinaryInspection();
  let race;
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MediaInspection).useValue({
      async inspect(binding, signal) {
        const activeRace = race;
        if (activeRace?.id === binding.assetId) {
          if (++activeRace.arrivals === activeRace.expected) activeRace.release();
          await activeRace.barrier;
          signal?.throwIfAborted();
        }
        return inspection.inspect(binding, signal);
      },
    }).compile();
  const app = module.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  const api = () => request(app.getHttpServer());

  /** Objects this run uploaded, destroyed in `finally` by exact binding. */
  const uploaded = [];
  const record = (label, intent) => {
    const parts = intent.upload.fields.public_id.split('/');
    const target = {
      label,
      binding: {
        ownerId: parts[1],
        assetId: parts[2],
        uploadIntentId: parts[3],
      },
    };
    uploaded.push(target);
    return target;
  };
  const register = async (email) => {
    const auth = await api()
      .post('/api/v1/auth/register')
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ email, password: 'TEST ONLY strong passphrase 123' })
      .expect(201);
    return {
      cookie: auth.headers['set-cookie'][0].split(';')[0],
      csrf: auth.body.data.csrfToken,
      id: auth.body.data.id,
    };
  };
  const intake = (actor, input) =>
    api()
      .post('/api/v1/media/uploads')
      .set('Origin', origin)
      .set('Cookie', actor.cookie)
      .set('X-CSRF-Token', actor.csrf)
      .set('Idempotency-Key', randomUUID())
      .send({
        category: 'IMAGE',
        fileName: 'p07-synthetic.png',
        ...input,
      });
  const finalize = (actor, id, key = randomUUID()) =>
    api()
      .post(`/api/v1/media/${id}/finalize`)
      .set('Origin', origin)
      .set('Cookie', actor.cookie)
      .set('X-CSRF-Token', actor.csrf)
      .set('Idempotency-Key', key)
      .send({ uploadCompleted: true });
  const toProvider = async (intent, bytes, fileName, mimeType) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(intent.upload.fields)) {
      form.set(key, value);
    }
    form.set('file', new Blob([bytes], { type: mimeType }), fileName);
    const response = await fetch(intent.upload.url, {
      method: 'POST',
      body: form,
      redirect: 'error',
      signal: AbortSignal.timeout(120_000),
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
    if (response.ok) {
      // The harness is the only writer of this private synthetic binding and
      // observed its single upload finish. Failed or timed-out writes give no proof.
      const target = uploaded.find(({ binding }) => binding.assetId === intent.assetId);
      if (target) target.uploadsQuiescent = true;
    }
    return { status: response.status, ok: response.ok, body };
  };
  const authorizeOrExplain = (upload) => {
    if (upload.ok) return;
    const detail = providerErrorKind(upload.body);
    if (detail === 'SIGNATURE_REJECTED') {
      console.error(
        `Cloudinary rejected the upload signature (${detail}). ` +
          'Verify the signed fields, timestamp, and sandbox credential pairing.',
      );
    } else if (upload.status === 401 || upload.status === 403) {
      console.error(
        `DEFECT: provider authorization refused the signed upload (${detail}).`,
      );
    }
    assert.fail(
      `synthetic private upload must reach the provider (HTTP ` +
        `${upload.status}: ${detail || 'no provider message'})`,
    );
  };
  /** One Idempotency-Key across attempts: 202/503 then Ready, as a client would. */
  const ready = async (actor, id) => {
    const key = randomUUID();
    let last;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      last = await finalize(actor, id, key);
      if (last.status === 200) return { key, response: last };
      if (last.status !== 202 && last.status !== 503) break;
      await sleep(400);
    }
    assert.fail(
      `finalization must converge to Ready (HTTP ${last.status})`,
    );
  };

  let primaryError = null;
  const cleanupFailures = [];
  try {
    phase = 'G0 presets';
    // ---- G0: credentials and signed preset precondition -------------------
    const presetResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/upload_presets/` +
        process.env.CLOUDINARY_UPLOAD_PRESET_IMAGE,
      {
        headers: { Authorization: `Basic ${secret}` },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      },
    );
    assert.ok(
      presetResponse.ok,
      `G0 admin credentials must authenticate (HTTP ${presetResponse.status})`,
    );
    const preset = await presetResponse.json();
    assert.equal(preset.unsigned, false, 'G0 image preset must be signed');
    const presetAllowlist = [
      'allowed_formats',
      'type',
      'overwrite',
      'use_filename',
      'unique_filename',
      'discard_original_filename',
    ];
    const assertPresetShape = (label, name, body, expectedFormats) => {
      assert.equal(
        body.unsigned,
        false,
        `G0 ${label} preset "${name}" must be signed`,
      );
      const formats = String(body.settings?.allowed_formats ?? '')
        .split(',')
        .map((format) => format.trim())
        .filter(Boolean);
      assert.ok(
        formats.length > 0,
        `G0 ${label} preset "${name}" must declare allowed_formats`,
      );
      assert.ok(
        formats.every((format) => expectedFormats.includes(format)),
        `G0 ${label} preset formats must stay inside the ${label} allowlist ` +
          `(${formats.join(', ')})`,
      );
      assert.deepEqual(
        Object.keys(body.settings ?? {})
          .filter((key) => !presetAllowlist.includes(key))
          .sort(),
        [],
        `G0 ${label} preset "${name}" must expose no hidden transformation, ` +
          'eval or folder option',
      );
      return formats;
    };
    assertPresetShape(
      'image',
      process.env.CLOUDINARY_UPLOAD_PRESET_IMAGE,
      preset,
      ['jpg', 'png', 'webp'],
    );
    pass('G0:image', 'G0 image preset is signed and within the format allowlist');
    // The G4 video/audio gates run on these presets, so they are preconditions.
    for (const [label, envKey, formats] of [
      ['video', 'CLOUDINARY_UPLOAD_PRESET_VIDEO', ['mp4', 'webm']],
      [
        'audio',
        'CLOUDINARY_UPLOAD_PRESET_AUDIO',
        ['mp3', 'm4a', 'ogg', 'wav', 'webm'],
      ],
    ]) {
      const name = process.env[envKey];
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud}/upload_presets/${name}`,
        {
          headers: { Authorization: `Basic ${secret}` },
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
        },
      );
      assert.ok(
        response.ok,
        `G0 ${label} preset "${name}" must be readable (HTTP ` +
          `${response.status})`,
      );
      const body = await response.json();
      const verified = assertPresetShape(label, name, body, formats);
      pass(`G0:${label}`,
        `G0 ${label} preset signed; allowed_formats=${verified.join(',')}`,
      );
    }

    const owner = await register('p07-owner@example.invalid');
    const other = await register('p07-other@example.invalid');

    phase = 'G3 upload and readiness';
    // ---- G3: owner upload -> finalize -> private Ready through HTTP -------
    const firstIntake = (
      await intake(owner, { declaredBytes: PNG_1X1.length }).expect(201)
    ).body.data;
    const target = record('g3-ready', firstIntake);
    const assetId = firstIntake.assetId;
    const upload = await toProvider(
      firstIntake,
      PNG_1X1,
      'p07-synthetic.png',
      'image/png',
    );
    authorizeOrExplain(upload);
    assert.equal(upload.body.type, 'authenticated');
    assert.equal(upload.body.public_id, firstIntake.upload.fields.public_id);
    assert.equal(upload.body.format, 'png');
    assert.ok(
      Number.isSafeInteger(upload.body.bytes) &&
        upload.body.bytes > 0 &&
        upload.body.bytes <= 10_000_000,
      'G3 provider-reported bytes must sit inside the image cap',
    );
    let facts = null;
    for (let attempt = 0; attempt < 20 && !facts; attempt += 1) {
      const result = await inspection.inspect(target.binding);
      if (result.kind === 'VERIFIED') facts = result.facts;
      else await sleep(300);
    }
    assert.ok(facts, 'G3 Admin API inspection must verify the private object');
    assert.equal(facts.privateOriginal, true);
    assert.equal(facts.privateDerivatives, true);
    const { key: finalizeKey, response: first } = await ready(owner, assetId);
    assert.equal(first.body.data.status, 'READY');
    assert.equal(first.body.data.verifiedBytes, upload.body.bytes);
    assert.equal(first.body.data.category, 'IMAGE');
    const status = await api()
      .get(`/api/v1/media/${assetId}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    assert.equal(status.body.data.status, 'READY');
    assert.equal(status.body.data.contentPath, `/api/v1/media/${assetId}/content`);
    const statusText = JSON.stringify(status.body);
    assert.ok(
      !statusText.includes('cloudinary') &&
        !statusText.includes('s--') &&
        !statusText.includes(apiKey) &&
        !statusText.includes(apiSecret),
      'G3 asset view must never expose provider URLs, signatures or secrets',
    );
    pass('G3:ready',
      `G3 owner upload->finalize->Ready: ${upload.body.bytes} bytes verified ` +
        `from provider facts and pinned as contentVersion ` +
        `${facts.object.contentVersion}`,
    );
    note('G3 asset view exposes only the account-protected content path');

    phase = 'G5 delivery, ranges and authorization';
    // ---- G5: GET/HEAD/Range keep auth and private-cache protections -------
    const contentPath = `/api/v1/media/${assetId}/content`;
    const total = upload.body.bytes;
    const whole = await api()
      .get(contentPath)
      .set('Cookie', owner.cookie)
      .expect(200);
    assert.equal(whole.headers['cache-control'], 'private, no-store');
    assert.equal(whole.headers['x-content-type-options'], 'nosniff');
    assert.match(whole.headers.vary ?? '', /cookie/i);
    assert.equal(whole.headers['accept-ranges'], 'bytes');
    assert.equal(whole.headers['content-type'], 'image/png');
    assert.equal(whole.headers['content-length'], String(total));
    assert.equal(whole.headers.etag, undefined);
    assert.equal(whole.headers.location, undefined);
    assert.ok(Buffer.isBuffer(whole.body) && whole.body.length === total);
    const head = await api()
      .head(contentPath)
      .set('Cookie', owner.cookie)
      .set('Range', 'bytes=0-3')
      .expect(200);
    assert.equal(head.headers['content-length'], String(total));
    assert.equal(head.headers['content-range'], undefined);
    assert.equal(head.headers['cache-control'], 'private, no-store');
    const ranges = [
      { header: 'bytes=0-3', start: 0, end: 3 },
      { header: 'bytes=4-', start: 4, end: total - 1 },
      { header: 'bytes=-4', start: total - 4, end: total - 1 },
    ];
    let lastRange = whole;
    for (const range of ranges) {
      const partial = await api()
        .get(contentPath)
        .set('Cookie', owner.cookie)
        .set('Range', range.header)
        .expect(206);
      lastRange = partial;
      assert.equal(
        partial.headers['content-range'],
        `bytes ${range.start}-${range.end}/${total}`,
      );
      assert.equal(
        Number(partial.headers['content-length']),
        range.end - range.start + 1,
      );
      assert.ok(Buffer.isBuffer(partial.body));
      assert.equal(partial.body.length, range.end - range.start + 1);
      assert.deepEqual(
        partial.body,
        whole.body.subarray(range.start, range.end + 1),
      );
    }
    const unsatisfiable = await api()
      .get(contentPath)
      .set('Cookie', owner.cookie)
      .set('Range', `bytes=${total + 10}-${total + 20}`)
      .expect(416);
    assert.equal(unsatisfiable.headers['content-range'], `bytes */${total}`);
    assert.equal(
      JSON.stringify(unsatisfiable.body ?? {}).includes('cloudinary'),
      false,
    );
    await api().get(contentPath).expect(401);
    await api().get(`/api/v1/media/${assetId}`).expect(401);
    // A foreign owner gets a safe denial without provider work (404 hides existence).
    const foreignAccount = await api().get('/api/v1/account/me').set('Cookie', other.cookie).expect(200);
    assert.equal(foreignAccount.body.data.id, other.id);
    await api().get(contentPath).set('Cookie', other.cookie).expect(404);
    const headerDump = JSON.stringify({
      ...whole.headers,
      ...head.headers,
      ...lastRange.headers,
      ...unsatisfiable.headers,
    });
    assert.ok(
      !headerDump.includes('cloudinary') &&
        !headerDump.includes(apiKey) &&
        !headerDump.includes(apiSecret) &&
        !/s--[A-Za-z0-9_-]{6,}--/.test(headerDump),
      'G5 stream headers must not leak provider URLs, signatures or secrets',
    );
    pass('G5:delivery',
      'G5 GET/HEAD preserve auth + private-cache protections ' +
        '(private, no-store / nosniff / Vary: Cookie) on provider-backed bytes',
    );
    pass('G5:ranges',
      `G5 ranges CLOSED/OPEN/SUFFIX match pinned bytes and unsatisfiable ` +
        `returns 416 Content-Range: bytes */${total}`,
    );
    pass('G5:auth', 'G5 anonymous requests return 401 and active cross-owner content returns 404');

    phase = 'G1/G2 anonymous privacy';
    // ---- G1 + G2: anonymous original AND prepared derivatives ------------
    const version = facts.object.contentVersion;
    const publicId = firstIntake.upload.fields.public_id;
    const base = `https://res.cloudinary.com/${cloud}/image/authenticated`;
    // Materialize a REAL prepared derivative first: a signed rendition of the
    // w_100 transformation makes the provider create and cache it, and the
    // Admin API must then report it. Denial is only proven against an asset
    // that exists (LEAD review point: transformation URLs alone are not enough).
    const derivativeSignature = createHash('sha256')
      .update(`w_100/${publicId}.png${apiSecret}`)
      .digest('base64url')
      .slice(0, 8);
    const preparedResponse = await fetch(
      `${base}/s--${derivativeSignature}--/w_100/v${version}/${publicId}.png`,
      { redirect: 'manual', signal: AbortSignal.timeout(30_000) },
    );
    const preparedBytes = Buffer.from(await preparedResponse.arrayBuffer());
    assert.equal(
      preparedResponse.status,
      200,
      `G2 prepared derivative must materialize through a signed rendition ` +
        `(HTTP ${preparedResponse.status})`,
    );
    assert.ok(
      looksLikeMedia(preparedBytes),
      'G2 prepared derivative must return real media bytes',
    );
    const resourceResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/resources/image/` +
        `authenticated/${encodeURIComponent(publicId)}?derived=true`,
      {
        headers: { Authorization: `Basic ${secret}` },
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      },
    );
    assert.ok(
      resourceResponse.ok,
      `G2 admin resource read must succeed (HTTP ${resourceResponse.status})`,
    );
    const derivedResources = (await resourceResponse.json()).derived ?? [];
    assert.ok(
      Array.isArray(derivedResources) &&
        derivedResources.some((entry) => entry.transformation === 'w_100'),
      'G2 provider must report the prepared w_100 derivative for this original',
    );
    note(
      `G2 prepared derivative created for real: signed rendition HTTP 200 ` +
        `with ${preparedBytes.length} bytes and Admin API reports derived ` +
        'w_100',
    );
    const anonymousTargets = [
      ['G1 original', `${base}/v${version}/${publicId}.png`],
      ['G2 derived w_100', `${base}/w_100/v${version}/${publicId}.png`],
      [
        'G2 derived crop 200x200',
        `${base}/c_fill,w_200,h_200/v${version}/${publicId}.png`,
      ],
      ['G2 derived f_auto,q_auto', `${base}/f_auto,q_auto/v${version}/${publicId}.png`],
      [
        'G2 derived format change to jpg',
        `${base}/f_jpg/v${version}/${publicId}.jpg`,
      ],
      [
        'G2 derived format change to webp',
        `${base}/f_webp,w_50/v${version}/${publicId}.webp`,
      ],
      [
        'G2 unsigned upload-type fallback',
        `https://res.cloudinary.com/${cloud}/image/upload/v${version}/${publicId}.png`,
      ],
    ];
    for (const [label, url] of anonymousTargets) {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000),
      });
      const payload = Buffer.from(await response.arrayBuffer());
      const contentType = (response.headers.get('content-type') ?? '')
        .split(';')[0]
        .trim();
      assert.ok(
        [401, 403, 404].includes(response.status),
        `${label} must be denied without credentials (HTTP ` +
          `${response.status}, ${payload.length} bytes)`,
      );
      assert.ok(
        payload.length === 0 || !/^(image|video|audio)\//.test(contentType),
        `${label} must not return a media content type`,
      );
      assert.ok(!looksLikeMedia(payload), `${label} must not return media bytes`);
      const denial = `${label} denied anonymously (HTTP ${response.status}, ${payload.length} bytes)`;
      if (label === 'G1 original') pass('G1:original', denial);
      else note(denial);
    }
    // The w_100 derivative above now exists at the provider: its anonymous
    // denial must come from authentication, not from the asset being missing.
    const anonymousPrepared = await fetch(
      `${base}/w_100/v${version}/${publicId}.png`,
      { redirect: 'manual', signal: AbortSignal.timeout(20_000) },
    );
    const anonymousPreparedBytes = Buffer.from(
      await anonymousPrepared.arrayBuffer(),
    );
    assert.ok(
      [401, 403].includes(anonymousPrepared.status),
      `G2 the existing prepared derivative must be denied by ` +
        `authentication (HTTP ${anonymousPrepared.status})`,
    );
    assert.ok(
      !looksLikeMedia(anonymousPreparedBytes),
      'G2 prepared derivative must not leak media bytes anonymously',
    );
    pass('G2:prepared',
      `G2 prepared derivative (existence proven) denied anonymously: ` +
        `HTTP ${anonymousPrepared.status}, ${anonymousPreparedBytes.length} bytes`,
    );

    // ---- G6: duplicate and concurrent finalization on the real object ----
    const replay = await finalize(owner, assetId, finalizeKey).expect(200);
    assert.deepEqual(replay.body, first.body, 'G6 same-key replay is identical');
    phase = 'G6 pending finalization race';
    const raceIntent = (await intake(owner, { declaredBytes: PNG_1X1.length }).expect(201)).body.data;
    const raceTarget = record('g6-race', raceIntent);
    const raceId = raceIntent.assetId;
    authorizeOrExplain(await toProvider(raceIntent, PNG_1X1, 'p07-race.png', 'image/png'));
    let raceFacts;
    for (let attempt = 0; attempt < 20 && !raceFacts; attempt++) {
      const result = await inspection.inspect(raceTarget.binding);
      if (result.kind === 'VERIFIED') raceFacts = result.facts;
      else await sleep(300);
    }
    assert.ok(raceFacts, 'G6 synthetic upload must be visible to the real Admin API before the race');
    const pending = await api().get(`/api/v1/media/${raceId}`).set('Cookie', owner.cookie).expect(200);
    assert.equal(pending.body.data.status, 'PENDING');
    const keys = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    race = { id: raceId, expected: keys.length, arrivals: 0, release, barrier };
    const timer = setTimeout(() => {
      race.timedOut = true;
      release();
    }, 10_000);
    let concurrent;
    try {
      const results = await Promise.allSettled(keys.map(key => finalize(owner, raceId, key)));
      assert.ok(!race.timedOut && race.arrivals === keys.length, 'all four requests must inspect a Pending asset before the barrier opens');
      concurrent = results.map(result => {
        assert.equal(result.status, 'fulfilled', 'G6 all requests must finish');
        return result.value;
      });
    } finally {
      clearTimeout(timer);
      race = undefined;
    }
    const raceFirst = concurrent[0];
    assert.equal(raceFirst.body.data?.status, 'READY');
    assert.equal(raceFirst.body.data.id, raceId);
    const raceReplay = await finalize(owner, raceId, keys[0]).expect(200);
    assert.deepEqual(raceReplay.body, raceFirst.body);
    for (const result of concurrent) {
      assert.equal(
        result.status,
        200,
        `G6 concurrent finalize must converge (HTTP ${result.status})`,
      );
      assert.deepEqual(result.body, raceFirst.body, 'G6 one Ready body, no variant');
    }
    const assets = await db.query(
      'SELECT status, content_version, storage_reference, verified_bytes ' +
        'FROM lumical.media_assets WHERE owner_id=$1 AND id=$2',
      [owner.id, raceId],
    );
    assert.deepEqual(assets.rows, [{
      status: 'READY', content_version: Number(raceFacts.object.contentVersion),
      storage_reference: raceFacts.object.storageKey, verified_bytes: raceFacts.bytes,
    }], 'G6 the Ready row must pin the verified provider object');
    const expectedKeys = [...keys].sort();
    const idempotency = await db.query(
      'SELECT key, condition, safe_result, request_digest ' +
        'FROM lumical.idempotency_records ' +
        "WHERE resource_id=$1 AND resource_type='MEDIA_ASSET' " +
        "AND operation='FINALIZE_MEDIA_UPLOAD'",
      [raceId],
    );
    const durable = idempotency.rows;
    assert.equal(
      durable.length,
      expectedKeys.length,
      `G6 must keep exactly one durable record per finalize key ` +
        `(got ${durable.length}, expected ${expectedKeys.length})`,
    );
    assert.deepEqual(
      durable.map((row) => row.key).sort(),
      expectedKeys,
      'G6 durable records must match the exact finalize keys used',
    );
    const expectedOutcome = raceFirst.body.data;
    for (const row of durable) {
      assert.equal(
        row.condition,
        'COMPLETED',
        `G6 record for key ${row.key} must reach COMPLETED`,
      );
      assert.deepEqual(
        JSON.parse(JSON.stringify(row.safe_result)),
        expectedOutcome,
        `G6 record for key ${row.key} must store the same durable outcome`,
      );
    }
    assert.equal(
      new Set(durable.map((row) => row.request_digest)).size,
      1,
      'G6 every record must carry the same request digest',
    );
    const stranded = await db.query(
      "SELECT count(*)::int AS count FROM lumical.media_assets " +
        "WHERE owner_id=$1 AND status='READY' AND id<>$2",
      [owner.id, raceId],
    );
    assert.equal(stranded.rows[0].count, 1, 'G6 only the earlier G3 asset is also Ready');
    pass('G6:pending-race',
      `G6 duplicate + 4 concurrent finalizations converge on one asset ` +
        `(contentVersion ${assets.rows[0].content_version}; ${durable.length} durable ` +
        'records, one per finalize key, all COMPLETED with the identical ' +
        'stored outcome, no conflict)',
    );

    phase = 'G4 format, size and duration';
    // Keep the five G4 fixtures under one fresh account's demo upload quota.
    const negativeOwner = await register('p07-validation@example.invalid');
    // ---- G4: provider-backed size / type / duration validation ------------
    // (a) declaration gate: an over-cap declared byte count never leaves the API.
    await intake(negativeOwner, { declaredBytes: 10_000_001 }).expect(422);
    pass('G4:declaration', 'G4 declaration gate: declaredBytes above the 10 MB cap is refused at 422');

    // (b) type: a real GIF must be rejected by the provider's allowed_formats.
    const gifIntake = (
      await intake(negativeOwner, {
        fileName: 'p07-declared.png',
        declaredBytes: GIF_1X1.length,
      }).expect(201)
    ).body.data;
    const gifTarget = record('g4-gif', gifIntake);
    const gifUpload = await toProvider(
      gifIntake,
      GIF_1X1,
      'p07-declared.gif',
      'image/gif',
    );
    const gifReason = providerErrorKind(gifUpload.body);
    assert.equal(
      gifUpload.status,
      400,
      `G4 GIF rejection must be the provider's HTTP 400 format validation, ` +
        `not HTTP ${gifUpload.status} (${gifReason})`,
    );
    assert.equal(
      gifReason,
      'FORMAT_REJECTED',
      `G4 GIF rejection cause must name the format allowlist (${gifReason})`,
    );
    gifTarget.providerRefused = true;
    pass('G4:format',
      `G4 provider type validation: GIF refused for invalid format ` +
        `(HTTP 400: ${gifReason})`,
    );
    note(
      `G4 type: preset issued an intent for asset ` +
        `${gifTarget.binding.assetId} and the provider rejected the payload`,
    );

    // (c) size: a supplementary larger fixture and the mandatory in-band trial.
    const sizeTrial = async (label, png) => {
      const intent = (
        await intake(negativeOwner, {
          fileName: 'p07-under-declared.png',
          declaredBytes: 9_999_999,
        }).expect(201)
      ).body.data;
      const target = record(label, intent);
      return { target, upload: await toProvider(intent, png, 'p07-under-declared.png', 'image/png') };
    };
    const planBytes = noisyPng(2100, 2100);
    const planTrial = await sizeTrial('g4-size-plan', planBytes);
    if (!planTrial.upload.ok) {
      const message = providerErrorKind(planTrial.upload.body);
      assert.equal(
        planTrial.upload.status,
        400,
        `G4 provider size refusal must be HTTP 400, not ` +
          `${planTrial.upload.status} (${message})`,
      );
      assert.equal(
        message,
        'SIZE_REJECTED',
        `G4 provider must refuse on size (${message})`,
      );
      planTrial.target.providerRefused = true;
      note(
        `G4 provider size limit: provider refused ${planBytes.length} ` +
          `synthetic bytes (HTTP 400: ${message})`,
      );
    } else {
      assert.ok(planBytes.length <= imagePlanLimit, 'G4 provider accepted a fixture above its reported plan limit');
      const final = await finalize(negativeOwner, planTrial.target.binding.assetId);
      assert.equal(final.status, 422, 'G4 oversized object must never reach Ready');
      note(
        'G4 provider accepted the larger synthetic upload and backend finalize rejected 422',
      );
    }
    // The backend-cap trial is mandatory: the object sits strictly between
    // MEDIA_LIMITS and the provider plan limit, so the provider MUST store it
    // and the backend MUST be the layer that refuses it at finalization.
    const capTrial = await sizeTrial('g4-size-cap', inBandPng);
    assert.ok(
      capTrial.upload.ok,
      `G4 backend cap trial must be stored by the provider (HTTP ` +
        `${capTrial.upload.status}: ${providerErrorKind(capTrial.upload.body)}); the ` +
        'object sits between MEDIA_LIMITS and the provider plan limit',
    );
    const stored = capTrial.upload.body.bytes;
    assert.ok(
      Number.isSafeInteger(stored) && stored > imageAppLimit && stored <= imagePlanLimit,
      `G4 trial must sit between the backend cap and the provider limit ` +
        `(got ${stored})`,
    );
    const final = await finalize(negativeOwner, capTrial.target.binding.assetId);
    assert.equal(
      final.status,
      422,
      'G4 provider facts above MEDIA_LIMITS must never reach Ready',
    );
    const row = await db.query(
      'SELECT status, verified_bytes, verified_at FROM lumical.media_assets ' +
        'WHERE id=$1',
      [capTrial.target.binding.assetId],
    );
    assert.deepEqual(row.rows[0], {
      status: 'UNAVAILABLE',
      verified_bytes: null,
      verified_at: null,
    });
    pass('G4:size',
      `G4 backend size cap: provider stored ${stored} bytes (inside its ` +
        `reported ${imagePlanLimit}-byte limit) and finalize rejected 422 with the asset ` +
        'UNAVAILABLE — MEDIA_LIMITS is enforced from provider facts',
    );

    // (d) duration: a 61 s object must be refused by the 60 s policy.
    {
      const wav = longWav();
      const audioIntake = (
        await intake(negativeOwner, {
          category: 'AUDIO',
          fileName: 'p07-declared.wav',
          declaredBytes: wav.length,
          declaredDurationSeconds: 50,
        }).expect(201)
      ).body.data;
      const audioTarget = record('g4-duration', audioIntake);
      const audioUpload = await toProvider(
        audioIntake,
        wav,
        'p07-declared.wav',
        'audio/wav',
      );
      authorizeOrExplain(audioUpload);
      const providerDuration = Number(audioUpload.body.duration);
      assert.ok(
        Number.isFinite(providerDuration) && providerDuration > 60,
        `G4 provider must report the real duration (got ` +
          `${audioUpload.body.duration ?? 'none'})`,
      );
      const audioFinalize = await finalize(
        negativeOwner,
        audioTarget.binding.assetId,
      );
      assert.equal(
        audioFinalize.status,
        422,
        'G4 provider-reported duration above 60 s must never reach Ready',
      );
      const audioRow = await db.query(
        'SELECT status, verified_bytes FROM lumical.media_assets WHERE id=$1',
        [audioTarget.binding.assetId],
      );
      assert.deepEqual(audioRow.rows, [{ status: 'UNAVAILABLE', verified_bytes: null }]);
      pass('G4:audio',
        `G4 duration: provider reported ${providerDuration.toFixed(3)} s ` +
          'against the 60 s policy and finalize rejected 422',
      );
    }
    // (e) video duration: the same 60 s policy against a real VIDEO asset.
    // Requires ffmpeg on the runner; without it this supplementary trial is an
    // explicit SKIP — the audio trial above remains the mandatory duration gate.
    const ffmpegBinary = process.env.P07_FFMPEG ?? 'ffmpeg';
    let hasFfmpeg = true;
    try {
      await promisify(execFile)(ffmpegBinary, ['-version'], { timeout: 10_000 });
    } catch {
      hasFfmpeg = false;
    }
    if (!hasFfmpeg) {
      skip(
        'G4 video duration: ffmpeg not on this runner — supplementary video ' +
          'trial skipped; the audio trial above is the mandatory duration ' +
          'gate (set P07_FFMPEG to enable)',
      );
    } else {
      const videoPath = join(tmpdir(), `p07-${randomUUID()}.mp4`);
      try {
        await promisify(execFile)(
          ffmpegBinary,
          [
            '-y',
            '-f',
            'lavfi',
            '-i',
            'color=c=black:s=32x32:r=10:d=61',
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            videoPath,
          ],
          { timeout: 120_000 },
        );
        const mp4 = await readFile(videoPath);
        const videoIntake = (
          await intake(negativeOwner, {
            category: 'VIDEO',
            fileName: 'p07-video.mp4',
            declaredBytes: mp4.length,
            declaredDurationSeconds: 50,
          }).expect(201)
        ).body.data;
        const videoTarget = record('g4-video', videoIntake);
        const videoUpload = await toProvider(
          videoIntake,
          mp4,
          'p07-video.mp4',
          'video/mp4',
        );
        authorizeOrExplain(videoUpload);
        assert.equal(
          videoUpload.body.format,
          'mp4',
          'G4 video must upload as mp4 through the signed VIDEO preset',
        );
        const videoDuration = Number(videoUpload.body.duration);
        assert.ok(
          Number.isFinite(videoDuration) && videoDuration > 60,
          `G4 provider must report the real video duration (got ` +
            `${videoUpload.body.duration ?? 'none'})`,
        );
        const videoFinalize = await finalize(
          negativeOwner,
          videoTarget.binding.assetId,
        );
        assert.equal(
          videoFinalize.status,
          422,
          'G4 video duration above 60 s must never reach Ready',
        );
        const videoRow = await db.query(
          'SELECT status FROM lumical.media_assets WHERE id=$1',
          [videoTarget.binding.assetId],
        );
        assert.equal(
          videoRow.rows[0].status,
          'UNAVAILABLE',
          'G4 over-duration video must end UNAVAILABLE',
        );
        pass('G4:video',
          `G4 video duration: provider reported ` +
            `${videoDuration.toFixed(3)} s against the 60 s VIDEO policy ` +
            'and finalize rejected 422',
        );
      } finally {
        await rm(videoPath, { force: true }).catch(() => undefined);
      }
    }
  } catch (error) {
    primaryError = error;
  } finally {
    // Cleanup is part of the acceptance: an object that survives this run is a
    // FAIL, never a log line (LEAD review point).
    const purge = new CloudinaryPurge();
    for (const target of uploaded) {
      try {
        const result = await purge.purge(
          { binding: target.binding, pinned: null, uploadsQuiescent: target.uploadsQuiescent },
          AbortSignal.timeout(45_000),
        );
        if (result.kind === 'DELETED') {
          console.log(`CLEANUP: ${target.label} DELETED`);
        } else if (result.kind === 'MISSING' && target.providerRefused) {
          // The one synthetic upload was explicitly refused before any retry.
          console.log(`CLEANUP: ${target.label} ABSENT_AFTER_REFUSAL`);
        } else {
          cleanupFailures.push(`${target.label}=${result.kind}`);
          console.log(`CLEANUP-FAIL: ${target.label} ${result.kind}`);
        }
      } catch {
        const failure = `${target.label}=PROVIDER_ERROR`;
        cleanupFailures.push(failure);
        console.log(`CLEANUP-FAIL: ${failure}`);
      }
    }
    await app.close();
    await db.end();
  }
  if (primaryError) throw primaryError;
  phase = 'cleanup';
  if (cleanupFailures.length) {
    throw new Error(
      'I06-P07 cleanup could not confirm destruction of every synthetic ' +
        `object (${cleanupFailures.join(', ')}) — acceptance FAILS instead ` +
        'of logging',
    );
  }
  pass('cleanup', 'All synthetic cleanup targets resolved successfully');
}).then(() => {
  phase = 'mandatory gate verification';
  assertRequiredGates(passed);
}).catch(() => {
  console.error(`FAIL: I06-P07 stopped in ${phase}. Raw diagnostic payloads suppressed.`);
  process.exitCode = 1;
});

if (!process.exitCode) {
  console.log('\n=== I06-P07 provider acceptance evidence ===');
  for (const line of evidence) console.log(`- ${line}`);
  console.log(
    `\nPASS: I06-P07 genuine-provider media privacy acceptance ` +
      `(${counts.pass} pass, ${counts.note} note, ${counts.skip} skip).`,
  );
}
