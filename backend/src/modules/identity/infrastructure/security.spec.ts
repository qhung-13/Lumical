import { randomBytes } from 'node:crypto';
import { AuthAbuseProtection, IdentitySecrets, ScryptPasswordHash } from './security';
import { IdentityConfig } from './identity-config';
import { Clock } from '../application/ports';

describe('Identity security adapters', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.NODE_ENV = 'production'; process.env.IDENTITY_COOKIE_MODE = 'https';
    process.env.IDENTITY_SECRET_KEY = randomBytes(32).toString('hex');
    process.env.IDENTITY_ALLOWED_ORIGINS = 'https://lumical.test';
    process.env.IDENTITY_AUTH_ATTEMPTS = '2'; process.env.IDENTITY_AUTH_BUCKETS = '4';
    process.env.IDENTITY_TRUSTED_PROXY_IPS = '';
  });
  afterEach(() => { process.env = { ...original }; });
  it('uses salted adaptive hashes and preserves password spaces', async () => {
    const hash = new ScryptPasswordHash(); const password = '  a gentle passphrase  ';
    const encoded = await hash.hash(password);
    expect(encoded).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(await hash.verify(password, encoded)).toBe(true);
    expect(await hash.verify(password.trim(), encoded)).toBe(false);
    expect(await hash.verify(password, undefined)).toBe(false);
  }, 15000);
  it('domain separates digests, binds encrypted replay and compares secrets safely', () => {
    const secrets = new IdentitySecrets(new IdentityConfig()); const value = secrets.random();
    expect(value).toHaveLength(43);
    expect(secrets.digest('session', value)).not.toBe(secrets.digest('csrf-binding', value));
    const encrypted = secrets.encrypt(value, 'account:intent');
    expect(encrypted.includes(Buffer.from(value))).toBe(false);
    expect(secrets.decrypt(encrypted, 'account:intent')).toBe(value);
    expect(() => secrets.decrypt(encrypted, 'other:intent')).toThrow();
    expect(secrets.equal('short', 'longer')).toBe(false);
  });
  it('rejects missing key, insecure deployed cookies and lookalike origins', () => {
    const deployed = new IdentityConfig(); expect(deployed.cookieName).toBe('__Host-lumical_session'); expect(deployed.secure).toBe(true);
    expect(() => deployed.assertOrigin('https://lumical.test.evil')).toThrow();
    expect(() => deployed.assertOrigin(undefined)).toThrow();
    process.env.IDENTITY_COOKIE_MODE = 'loopback'; expect(() => new IdentityConfig().assertConfigured()).toThrow();
    process.env.NODE_ENV = 'development'; process.env.IDENTITY_ALLOWED_ORIGINS = 'http://localhost:3000';
    const local = new IdentityConfig(); expect(local.cookieName).toBe('lumical_session_dev'); expect(local.secure).toBe(false);
    process.env.IDENTITY_ALLOWED_ORIGINS = 'http://localhost.evil:3000'; expect(() => new IdentityConfig().assertConfigured()).toThrow();
    delete process.env.IDENTITY_SECRET_KEY; expect(() => new IdentityConfig().assertConfigured()).toThrow();
  });
  it('limits unknown/known emails identically, bounds buckets and expires them with a clock', () => {
    let now = 0;
    const clock: Clock = { now: () => new Date(now) };
    const config = new IdentityConfig(); const guard = new AuthAbuseProtection(clock, config, new IdentitySecrets(config));
    guard.check('synthetic-ip', 'unknown@example.invalid'); guard.check('synthetic-ip', 'unknown@example.invalid');
    expect(() => guard.check('synthetic-ip', 'unknown@example.invalid')).toThrow();
    guard.check('synthetic-ip', 'known@example.invalid'); guard.check('synthetic-ip', 'known@example.invalid');
    expect(() => guard.check('synthetic-ip', 'known@example.invalid')).toThrow();
    guard.check('synthetic-ip', 'third@example.invalid');
    expect(() => guard.check('synthetic-ip', 'fourth@example.invalid')).toThrow();
    now = config.windowMs; expect(() => guard.check('synthetic-ip', 'unknown@example.invalid')).not.toThrow();
  });
  it('shares a source quota across IPv4 and mapped IPv6 without merging distinct sources', () => {
    process.env.IDENTITY_AUTH_ATTEMPTS = '1'; process.env.IDENTITY_AUTH_BUCKETS = '100';
    const config = new IdentityConfig(); const guard = new AuthAbuseProtection({ now: () => new Date(0) }, config, new IdentitySecrets(config));
    for (let attempt = 0; attempt < 5; attempt++) guard.check(attempt % 2 ? '::ffff:127.0.0.2' : '127.0.0.2', `review${attempt}@example.invalid`);
    expect(() => guard.check('::ffff:7f00:2', 'next@example.invalid')).toThrow(expect.objectContaining({ status: 429 }));
    expect(() => guard.check('127.0.0.3', 'other@example.invalid')).not.toThrow();
    expect(() => guard.check('127.0.0.4', 'other@example.invalid')).toThrow(expect.objectContaining({ status: 429 }));
  });
  it('accepts only exact configured proxy IPs and fails closed for broad trust settings', () => {
    process.env.IDENTITY_TRUSTED_PROXY_IPS = '127.0.0.1,::ffff:127.0.0.1';
    expect(new IdentityConfig().trustedProxyIPs).toEqual(['127.0.0.1']);
    for (const bad of ['true','*','loopback','172.30.0.0/16']) {
      process.env.IDENTITY_TRUSTED_PROXY_IPS = bad;
      expect(() => new IdentityConfig().assertConfigured()).toThrow();
    }
  });
});
