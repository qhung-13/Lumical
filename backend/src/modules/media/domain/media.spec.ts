import { assessReadiness, MEDIA_LIMITS, type MediaCategory, type VerifiedMediaFacts } from './media';

const binding = { assetId: 'asset', ownerId: 'owner', uploadIntentId: 'intent' };
const facts = (category: MediaCategory): VerifiedMediaFacts => ({
  object: { binding, storageKey: 'opaque-key', contentVersion: 'immutable-v1' },
  category, contentType: { IMAGE: 'image/jpeg', VIDEO: 'video/mp4', AUDIO: 'audio/mpeg' }[category],
  bytes: MEDIA_LIMITS[category].maxBytes, durationSeconds: category === 'IMAGE' ? null : 60,
  privateOriginal: true, privateDerivatives: true,
});
const decision = (value: VerifiedMediaFacts) => assessReadiness(binding, value.category, { kind: 'VERIFIED', facts: value });

describe('private media readiness', () => {
  it.each<MediaCategory>(['IMAGE', 'VIDEO', 'AUDIO'])('accepts exact limits and rejects excess for %s', category => {
    expect(decision(facts(category)).status).toBe('READY');
    expect(decision({ ...facts(category), bytes: MEDIA_LIMITS[category].maxBytes + 1 }).status).toBe('UNAVAILABLE');
  });
  it.each([0, -1, NaN, Infinity, 1.5])('rejects invalid byte count %s', bytes => {
    expect(decision({ ...facts('IMAGE'), bytes }).status).toBe('UNAVAILABLE');
  });
  it.each([null, 0, -1, NaN, Infinity, 60.01])('rejects invalid timed duration %s', durationSeconds => {
    for (const category of ['VIDEO', 'AUDIO'] as const)
      expect(decision({ ...facts(category), durationSeconds }).status).toBe('UNAVAILABLE');
  });
  it('never converts uncertainty or missing evidence into Ready', () => {
    expect(assessReadiness(binding, 'IMAGE', { kind: 'PENDING' })).toEqual({ status: 'PENDING' });
    expect(assessReadiness(binding, 'IMAGE', { kind: 'UNAVAILABLE' }).status).toBe('UNAVAILABLE');
  });
  it('rejects wrong binding, category, unsafe content, public assets and missing immutable identity', () => {
    for (const key of ['assetId', 'ownerId', 'uploadIntentId'] as const) {
      const value = facts('IMAGE');
      expect(decision({ ...value, object: { ...value.object, binding: { ...binding, [key]: 'other' } } }).status).toBe('UNAVAILABLE');
    }
    for (const patch of [
      { contentType: 'image/svg+xml' }, { privateOriginal: false }, { privateDerivatives: false },
      { object: { ...facts('IMAGE').object, contentVersion: '' } },
      { object: { ...facts('IMAGE').object, storageKey: '' } },
    ]) expect(decision({ ...facts('IMAGE'), ...patch }).status).toBe('UNAVAILABLE');
    expect(assessReadiness(binding, 'VIDEO', { kind: 'VERIFIED', facts: facts('IMAGE') }).status).toBe('UNAVAILABLE');
  });
});