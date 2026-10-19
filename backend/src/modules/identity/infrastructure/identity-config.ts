import { Injectable } from '@nestjs/common';
import { IdentityError, unavailable } from '../domain/identity';
import { IdentityPolicy } from '../application/ports';
import { canonicalIp } from '../../../platform/http/client-address';

@Injectable()
export class IdentityConfig extends IdentityPolicy {
  readonly key?: Buffer;
  readonly origins: string[] = [];
  readonly trustedProxyIPs: readonly string[] = [];
  readonly cookieName: string;
  readonly secure: boolean;
  readonly attempts: number;
  readonly windowMs: number;
  readonly capacity: number;
  constructor() {
    super();
    const loopback = process.env.IDENTITY_COOKIE_MODE === 'loopback';
    this.secure = !loopback;
    this.cookieName = loopback ? 'lumical_session_dev' : '__Host-lumical_session';
    const integer = (name: string, fallback: number, max: number) => {
      const value = Number(process.env[name] ?? fallback);
      if (!Number.isInteger(value) || value < 1 || value > max) throw unavailable();
      return value;
    };
    try {
      const proxies = (process.env.IDENTITY_TRUSTED_PROXY_IPS ?? '').split(',').map(value => value.trim()).filter(Boolean);
      const addresses = proxies.map(canonicalIp);
      if (addresses.some(value => value === undefined)) throw unavailable();
      this.trustedProxyIPs = Object.freeze([...new Set(addresses as string[])]);
      this.attempts = integer('IDENTITY_AUTH_ATTEMPTS', 10, 1000);
      this.windowMs = integer('IDENTITY_AUTH_WINDOW_SECONDS', 600, 3600) * 1000;
      this.capacity = integer('IDENTITY_AUTH_BUCKETS', 10000, 50000);
      const mode = process.env.IDENTITY_COOKIE_MODE ?? 'https';
      if (!['https', 'loopback'].includes(mode) || (loopback && process.env.NODE_ENV !== 'development')) throw unavailable();
      const key = process.env.IDENTITY_SECRET_KEY;
      if (!key || !/^[a-f0-9]{64}$/i.test(key) || /^([a-f0-9])\1+$/i.test(key)) throw unavailable();
      const origins = (process.env.IDENTITY_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim());
      if (!origins.length || origins.some((value) => {
        const url = new URL(value);
        return url.origin !== value || (loopback
          ? url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
          : url.protocol !== 'https:');
      })) throw unavailable();
      this.origins = [...new Set(origins)];
      this.key = Buffer.from(key, 'hex');
    } catch {
      // Test composition and technical liveness can exist without identity config.
      // The real startup asserts configuration before accepting any traffic.
    }
  }
  assertConfigured(): void { if (!this.key) throw unavailable(); }
  assertOrigin(value: string | undefined): void {
    this.assertConfigured();
    if (!value || !this.origins.includes(value)) throw new IdentityError('ORIGIN_REJECTED', 403, 'errors.originRejected');
  }
}
