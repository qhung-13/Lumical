import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertRequiredGates, missingProviderConfig, providerErrorKind, requireG4ImageCapacity } from './media-privacy-gates.mjs';

const gates = [
  'G0:image', 'G0:video', 'G0:audio', 'G1:original', 'G2:prepared',
  'G3:ready', 'G4:declaration', 'G4:format', 'G4:size', 'G4:audio',
  'G5:delivery', 'G5:ranges', 'G5:auth', 'G6:pending-race', 'cleanup',
];

test('rejects missing or blank timed-media presets before any provider work', () => {
  const env = {
    CLOUDINARY_CLOUD_NAME: 'sandbox', CLOUDINARY_API_KEY: '123',
    CLOUDINARY_API_SECRET: 'fake', CLOUDINARY_UPLOAD_PRESET_IMAGE: 'image',
    CLOUDINARY_UPLOAD_PRESET_VIDEO: ' ',
  };
  assert.deepEqual(missingProviderConfig(env), ['CLOUDINARY_UPLOAD_PRESET_VIDEO', 'CLOUDINARY_UPLOAD_PRESET_AUDIO']);
});

test('requires every mandatory PASS even with a supplementary trial or note', () => {
  for (const omitted of gates) {
    const passed = new Set([...gates.filter(gate => gate !== omitted), 'G4:video', `NOTE:${omitted}`]);
    assert.throws(() => assertRequiredGates(passed), { message: `Mandatory gates incomplete (${omitted})` });
  }
  assert.doesNotThrow(() => assertRequiredGates(new Set(gates)));
});

test('reduces provider diagnostics to safe categories and rejects unrelated failures', () => {
  const classify = message => providerErrorKind({ error: { message } });
  assert.equal(classify('Invalid Signature TEST-SIGNATURE. String to sign - SECRET https://sandbox.invalid'), 'SIGNATURE_REJECTED');
  assert.equal(classify('Image file format gif not allowed'), 'FORMAT_REJECTED');
  assert.equal(classify('File size too large. Maximum is 10485760'), 'SIZE_REJECTED');
  assert.equal(classify('Not allowed to use this API key'), 'UNKNOWN');
  assert.equal(classify('Unsupported request format'), 'UNKNOWN');
  assert.equal(classify('https://sandbox.invalid/s--SENSITIVE--?token=secret'), 'UNKNOWN');
});
test('requires the actual plan capacity for the mandatory oversized image', () => {
  const appLimit = 10_000_000;
  const bytes = 10_401_000;
  const usage = image_max_size_bytes => ({ media_limits: { image_max_size_bytes } });
  assert.equal(requireG4ImageCapacity(usage(10_485_760), bytes, appLimit), 10_485_760);
  assert.equal(requireG4ImageCapacity(usage(bytes), bytes, appLimit), bytes);
  assert.equal(requireG4ImageCapacity(usage(bytes - 1), bytes, appLimit), undefined);
  assert.equal(requireG4ImageCapacity(usage(String(bytes)), bytes, appLimit), undefined);
  assert.equal(requireG4ImageCapacity({}, bytes, appLimit), undefined);
  assert.throws(() => requireG4ImageCapacity(usage(bytes), appLimit, appLimit), /fixture must exceed/);
});
