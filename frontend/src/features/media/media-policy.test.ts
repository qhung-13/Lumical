import { describe, expect, it } from 'vitest';
import { mediaGuidance, validateMediaFile } from './media-policy';

function file(name: string, type: string, size = 10) {
  const value = new File(['x'], name, { type });
  Object.defineProperty(value, 'size', { value: size });
  return value;
}

describe('private media guidance', () => {
  it('uses the approved decimal byte limits and category formats', () => {
    expect(mediaGuidance.IMAGE.maxBytes).toBe(10_000_000);
    expect(mediaGuidance.VIDEO.maxBytes).toBe(100_000_000);
    expect(mediaGuidance.AUDIO.maxBytes).toBe(20_000_000);
    expect(mediaGuidance.VIDEO.maxDurationSeconds).toBe(60);
    expect(mediaGuidance.AUDIO.maxDurationSeconds).toBe(60);
  });

  it('accepts supported media and rejects wrong format, empty and oversized files', () => {
    expect(validateMediaFile(file('family.webp', 'image/webp'), 'IMAGE')).toBeUndefined();
    expect(validateMediaFile(file('memory.webm', 'video/webm'), 'VIDEO')).toBeUndefined();
    expect(validateMediaFile(file('voice.ogg', 'audio/ogg'), 'AUDIO')).toBeUndefined();
    expect(validateMediaFile(file('unsafe.svg', 'image/svg+xml'), 'IMAGE')).toBe('INVALID_FORMAT');
    expect(validateMediaFile(file('large.jpg', 'image/jpeg', 10_000_001), 'IMAGE')).toBe('TOO_LARGE');
    expect(validateMediaFile(file('empty.jpg', 'image/jpeg', 0), 'IMAGE')).toBe('TOO_LARGE');
  });
});
