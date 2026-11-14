import { uploadRequest } from './upload-intake';

describe('upload declared metadata boundary', () => {
  it.each([
    { category: 'IMAGE', declaredBytes: 10_000_001 },
    { category: 'VIDEO', declaredBytes: 100_000_001 },
    { category: 'AUDIO', declaredBytes: 20_000_001 },
    { declaredBytes: '12' },
    { declaredBytes: 0 },
    { declaredBytes: 1.5 },
    { category: 'RAW' },
    { declaredDurationSeconds: 61, category: 'VIDEO' },
    { declaredDurationSeconds: null },
    { declaredDurationSeconds: -1 },
    { ownerId: 'another-owner' },
    { public_id: 'existing' },
    { fileName: '\u0000.png' },
  ])('rejects malformed/oversize/extra fields %j', (patch) => {
    expect(() =>
      uploadRequest({
        category: 'IMAGE',
        fileName: 'test.png',
        declaredBytes: 20,
        ...patch,
      }),
    ).toThrow('VALIDATION_FAILED');
  });
  it.each([
    ['IMAGE', 10_000_000],
    ['VIDEO', 100_000_000],
    ['AUDIO', 20_000_000],
  ])('accepts the %s boundary', (category, declaredBytes) => {
    expect(
      uploadRequest({ category, declaredBytes, fileName: 'synthetic' })
        .category,
    ).toBe(category);
  });
});
