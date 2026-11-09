import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  CloudinaryUpload,
} = require('../dist/modules/media/infrastructure/cloudinary-upload.js');
const {
  CloudinaryInspection,
} = require('../dist/modules/media/infrastructure/cloudinary-inspection.js');
const { assessReadiness } = require('../dist/modules/media/domain/media.js');
const {
  CloudinaryContent,
} = require('../dist/modules/media/infrastructure/cloudinary-content.js');
const config = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_UPLOAD_PRESET_IMAGE',
];
if (config.some((key) => !process.env[key]))
  throw new Error(
    'Configured Cloudinary synthetic smoke requires all image upload credentials/preset. No provider acceptance was run.',
  );
const result = await new CloudinaryUpload().authorizeUpload({
  binding: {
    ownerId: randomUUID(),
    assetId: randomUUID(),
    uploadIntentId: randomUUID(),
  },
  category: 'IMAGE',
  expiresAt: new Date(Date.now() + 3_600_000),
});
assert.equal(
  result.kind,
  'AUTHORIZED',
  'Private signed preset configuration must pass',
);
const { fields, uploadEndpoint } = result.intent;
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBZkAAAAASUVORK5CYII=',
  'base64',
);
async function upload() {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set('file', new Blob([png], { type: 'image/png' }), 'synthetic.png');
  return fetch(uploadEndpoint, {
    method: 'POST',
    body: form,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
}
let attempted = false;
try {
  attempted = true;
  const first = await upload();
  assert.equal(first.ok, true, 'Synthetic private upload must succeed');
  const object = await first.json();
  assert.equal(object.type, 'authenticated');
  assert.equal(object.public_id, fields.public_id);
  // Provider normalization can change the stored PNG length. Verify provider
  // facts against the category cap rather than equating them to client bytes.
  assert.ok(
    Number.isSafeInteger(object.bytes) &&
      object.bytes > 0 &&
      object.bytes <= 10_000_000,
  );
  assert.equal(object.format, 'png');
  assert.equal(object.width, 1);
  assert.equal(object.height, 1);
  const inspected = await new CloudinaryInspection().inspect(
    result.intent.binding,
  );
  assert.equal(
    inspected.kind,
    'VERIFIED',
    'Authenticated Admin API inspection must independently verify the upload',
  );
  assert.equal(
    assessReadiness(result.intent.binding, 'IMAGE', inspected).status,
    'READY',
  );
  assert.equal(inspected.facts.bytes, object.bytes);
  assert.equal(inspected.facts.object.contentVersion, String(object.version));
  assert.equal(inspected.facts.contentType, 'image/png');
  const storage = new CloudinaryContent(new CloudinaryInspection());
  const contentRequest = {
    object: inspected.facts.object,
    access: {
      kind: 'OWNER',
      actorId: result.intent.binding.ownerId,
      ownerId: result.intent.binding.ownerId,
    },
    method: 'GET',
    rendition: 'ORIGINAL',
  };
  const abort = new AbortController();
  try {
    let original;
    for (const range of [
      undefined,
      { kind: 'CLOSED', start: 0, end: 3 },
      { kind: 'OPEN', start: 4 },
      { kind: 'SUFFIX', length: 4 },
    ]) {
      const content = await storage.fetch(
        { ...contentRequest, range },
        abort.signal,
      );
      assert.equal(
        content.kind,
        'CONTENT',
        'Pinned private original/range must stream through the adapter',
      );
      assert.equal(content.status, range ? 206 : 200);
      const chunks = [];
      for await (const chunk of content.body) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      assert.equal(bytes.length, content.contentLength);
      if (!range) original = bytes;
      else
        assert.deepEqual(
          bytes,
          original.subarray(
            content.contentRange.start,
            content.contentRange.end + 1,
          ),
        );
    }
    const head = await storage.fetch(
      { ...contentRequest, method: 'HEAD' },
      abort.signal,
    );
    assert.equal(head.kind, 'CONTENT');
    assert.equal(head.body, undefined);
    assert.equal(head.contentLength, object.bytes);
    const wrongVersion = await storage.fetch(
      {
        ...contentRequest,
        object: { ...contentRequest.object, contentVersion: '1' },
      },
      abort.signal,
    );
    assert.equal(wrongVersion.kind, 'REJECTED', 'No latest-version fallback');
    const anonymous = await fetch(
      `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/authenticated/v${object.version}/${fields.public_id}.png`,
      { redirect: 'manual', signal: AbortSignal.timeout(10000) },
    );
    await anonymous.body?.cancel();
    assert.ok(
      [401, 403, 404].includes(anonymous.status),
      'Anonymous original must remain denied after signed streaming',
    );
  } finally {
    abort.abort();
  }
  const second = await upload();
  const replay = await second.json();
  assert.ok(
    !second.ok || replay.existing === true,
    'Replay must reject overwrite or return existing object',
  );
  if (second.ok) assert.equal(replay.version, object.version);
  console.log(
    'PASS: configured Cloudinary intake/readiness, pinned GET/HEAD/ranges, anonymous original denial and overwrite protection; P07 prepared derivative acceptance remains separate.',
  );
} finally {
  if (attempted) {
    const params = {
      public_id: fields.public_id,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: 'authenticated',
    };
    const canonical = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    const form = new URLSearchParams({
      ...params,
      api_key: process.env.CLOUDINARY_API_KEY,
      signature: createHash('sha256')
        .update(canonical + process.env.CLOUDINARY_API_SECRET)
        .digest('hex'),
    });
    const deleted = await fetch(
      uploadEndpoint.replace(/\/upload$/, '/destroy'),
      {
        method: 'POST',
        body: form,
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      },
    );
    assert.equal(deleted.ok, true, 'Synthetic run object cleanup must succeed');
    assert.ok(['ok', 'not found'].includes((await deleted.json()).result));
  }
}
