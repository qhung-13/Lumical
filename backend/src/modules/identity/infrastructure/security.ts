import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { AuthAttempts, Clock, PasswordHash, Secrets } from '../application/ports';
import { IdentityError, unavailable } from '../domain/identity';
import { IdentityConfig } from './identity-config';
import { canonicalIp } from '../../../platform/http/client-address';

@Injectable()
export class SystemClock extends Clock { now(): Date { return new Date(); } }

@Injectable()
export class IdentitySecrets extends Secrets {
  constructor(@Inject(IdentityConfig) private readonly config: IdentityConfig) { super(); }
  random(): string { return randomBytes(32).toString('base64url'); }
  digest(kind: string, value: string): string {
    this.config.assertConfigured();
    return createHmac('sha256', this.config.key!).update(`${kind}\0`).update(value).digest('hex');
  }
  csrf(secret: string): string { return this.digest('csrf-token', secret); }
  equal(left: string, right: string): boolean {
    const a = Buffer.from(left); const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  encrypt(value: string, binding: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(this.digest('replay-key', ''), 'hex'), iv);
    cipher.setAAD(Buffer.from(binding));
    return Buffer.concat([iv, cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  }
  decrypt(value: Uint8Array, binding: string): string {
    const bytes = Buffer.from(value);
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(this.digest('replay-key', ''), 'hex'), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(binding)); decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8');
  }
}

// Stable Node/OpenSSL scrypt: OWASP baseline N=2^17,r=8,p=1; 16-byte salt.
// Two active hashes and at most 16 waiting requests bound CPU/memory pressure.
@Injectable()
export class ScryptPasswordHash extends PasswordHash {
  private active = 0;
  private readonly waiters: (() => void)[] = [];
  private async derive(password: string, salt: Buffer): Promise<Buffer> {
    if (this.active >= 2) {
      if (this.waiters.length >= 16) throw new IdentityError('RATE_LIMITED', 429, 'errors.rateLimited');
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    } else this.active += 1;
    try {
      return await new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64,
        { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
        (error, key) => error ? reject(unavailable()) : resolve(key)));
    } finally {
      const next = this.waiters.shift();
      if (next) next(); else this.active -= 1;
    }
  }
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await this.derive(password, salt);
    return `scrypt$131072$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
  }
  async verify(password: string, encoded: string | undefined): Promise<boolean> {
    const match = /^scrypt\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded ?? '');
    // Unknown/disabled synthetic hashes perform exactly the same expensive work.
    const derived = await this.derive(password, match ? Buffer.from(match[1], 'hex') : Buffer.alloc(16));
    const expected = match ? Buffer.from(match[2], 'hex') : Buffer.alloc(64);
    return timingSafeEqual(derived, expected) && !!match;
  }
}

@Injectable()
export class AuthAbuseProtection extends AuthAttempts {
  private readonly buckets = new Map<string, { count: number; until: number }>();
  constructor(@Inject(Clock) private readonly clock: Clock, @Inject(IdentityConfig) private readonly config: IdentityConfig, @Inject(IdentitySecrets) private readonly secrets: IdentitySecrets) { super(); }
  check(ip: string, email: string): void {
    this.config.assertConfigured();
    const now = this.clock.now().getTime();
    for (const [key, value] of this.buckets) if (value.until <= now) this.buckets.delete(key);
    // An IP aggregate and an email aggregate apply equally to existing/unknown accounts.
    for (const [kind, value, limit] of [['ip', canonicalIp(ip) ?? 'unknown', this.config.attempts * 5], ['email', email, this.config.attempts]] as const) {
      const key = this.secrets.digest(`abuse-${kind}`, value);
      const bucket = this.buckets.get(key);
      if ((!bucket && this.buckets.size >= this.config.capacity) || (bucket && bucket.count >= limit)) throw new IdentityError('RATE_LIMITED', 429, 'errors.rateLimited');
      this.buckets.set(key, { count: (bucket?.count ?? 0) + 1, until: bucket?.until ?? now + this.config.windowMs });
    }
  }
}
