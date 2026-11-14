const requiredVariables = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_UPLOAD_PRESET_IMAGE',
  'CLOUDINARY_UPLOAD_PRESET_VIDEO',
  'CLOUDINARY_UPLOAD_PRESET_AUDIO',
];

export function missingProviderConfig(env) {
  return requiredVariables.filter((key) => !env[key]?.trim());
}

export function requireG4ImageCapacity(usage, fixtureBytes, appLimit) {
  if (!Number.isSafeInteger(fixtureBytes) || fixtureBytes <= appLimit)
    throw new Error('G4 fixture must exceed the LumiCal image limit');
  const imageLimit = usage?.media_limits?.image_max_size_bytes;
  if (!Number.isSafeInteger(imageLimit) || imageLimit < fixtureBytes) return undefined;
  return imageLimit;
}

export function assertRequiredGates(passed) {
  const required = [
    'G0:image', 'G0:video', 'G0:audio', 'G1:original', 'G2:prepared',
    'G3:ready', 'G4:declaration', 'G4:format', 'G4:size', 'G4:audio',
    'G5:delivery', 'G5:ranges', 'G5:auth', 'G6:pending-race', 'cleanup',
  ];
  const missing = required.filter((gate) => !passed.has(gate));
  if (missing.length) throw new Error(`Mandatory gates incomplete (${missing.join(', ')})`);
}

// Interpret provider error text locally. Only these fixed categories reach output.
export function providerErrorKind(body) {
  const message = body?.error?.message;
  if (typeof message !== 'string') return 'UNKNOWN';
  if (/^invalid signature\b/i.test(message)) return 'SIGNATURE_REJECTED';
  if (/^(?:(?:image|video|audio) )?(?:file )?format\s+gif\s+(?:is\s+)?not allowed\b/i.test(message.trim()))
    return 'FORMAT_REJECTED';
  if (/^file size too large\b/i.test(message)) return 'SIZE_REJECTED';
  return 'UNKNOWN';
}
