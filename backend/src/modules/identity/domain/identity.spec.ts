import { activeSession, credentials, IdentityError, statusChange } from './identity';

describe('BR-ID credential and account policies', () => {
  it('normalizes case and surrounding spaces while preserving a passphrase exactly', () => {
    const password = '  a gentle passphrase  ';
    expect(credentials({ email: ' Demo@Example.invalid ', password })).toEqual({ email: 'demo@example.invalid', password });
  });
  it.each([11, 129])('rejects %i-character passwords', (size) => {
    expect(() => credentials({ email: 'demo@example.invalid', password: 'x'.repeat(size) })).toThrow(IdentityError);
  });
  it.each([12, 128])('accepts %i-character passphrases without composition rules', (size) => {
    expect(credentials({ email: 'demo@example.invalid', password: 'x'.repeat(size) }).password).toHaveLength(size);
  });
  it('counts Unicode characters and never truncates them', () => {
    expect(credentials({ email: 'demo@example.invalid', password: '🙂'.repeat(128) }).password).toBe('🙂'.repeat(128));
    expect(() => credentials({ email: 'demo@example.invalid', password: '🙂'.repeat(11) })).toThrow(IdentityError);
  });
  it('rejects role injection, unknown fields and malformed email', () => {
    expect(() => credentials({ email: 'demo@example.invalid', password: 'x'.repeat(12), role: 'ADMIN' })).toThrow(IdentityError);
    expect(() => credentials({ email: 'bad email', password: 'x'.repeat(12) })).toThrow(IdentityError);
  });
  it('rejects unpaired Unicode surrogates instead of silently changing a password', () => {
    expect(() => credentials({ email: 'demo@example.invalid', password: 'x'.repeat(12) + '\ud800' })).toThrow(IdentityError);
  });
  it('requires a reason and explicit valid restoration input', () => {
    expect(() => statusChange({ status: 'DISABLED', reason: ' ', restoreEligibleShares: true })).toThrow(IdentityError);
    expect(statusChange({ status: 'ACTIVE', reason: 'reviewed', restoreEligibleShares: true })).toEqual({ status: 'ACTIVE', reason: 'reviewed', restoreEligibleShares: true });
  });
  it.each(['\u0000', '\ud800', '\udc00'])('rejects malformed email and reason text %j with field errors', bad => {
    expect(() => credentials({ email: `test${bad}@example.invalid`, password: 'x'.repeat(12) })).toThrow(expect.objectContaining({ status: 422, field: 'email' }));
    expect(() => statusChange({ status: 'DISABLED', reason: `review${bad}` })).toThrow(expect.objectContaining({ status: 422, field: 'reason' }));
  });
  it('preserves legitimate Unicode without additional normalization', () => {
    const password = '  ký ức e\u0301 🙂🙂🙂🙂  ';
    expect(credentials({ email: ' KÝỨC-e\u0301@vídụ.invalid ', password })).toEqual({ email: 'kýức-e\u0301@vídụ.invalid', password });
    expect(statusChange({ status: 'DISABLED', reason: 'Đã xem xét e\u0301 🙂' }).reason).toBe('Đã xem xét e\u0301 🙂');
  });
  it('rejects exact idle and absolute expiry, revocation and disabled accounts', () => {
    const now = new Date('2026-10-13T00:00:00Z');
    const account = { id: 'test', normalizedEmail: 'test@example.invalid', passwordHash: 'not returned', role: 'USER' as const, status: 'ACTIVE' as const, version: 1 };
    const session = { id: 'test', userId: 'test', csrfDigest: 'not returned', lastActivityAt: now, idleExpiresAt: new Date(now.getTime() + 1), absoluteExpiresAt: new Date(now.getTime() + 1), revokedAt: null };
    expect(activeSession(session, account, now)).toBe(true);
    expect(activeSession({ ...session, idleExpiresAt: now }, account, now)).toBe(false);
    expect(activeSession({ ...session, absoluteExpiresAt: now }, account, now)).toBe(false);
    expect(activeSession({ ...session, revokedAt: now }, account, now)).toBe(false);
    expect(activeSession(session, { ...account, status: 'DISABLED' }, now)).toBe(false);
  });
});
