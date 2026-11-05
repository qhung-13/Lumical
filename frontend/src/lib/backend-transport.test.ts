import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendFetch } from './backend-transport';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('demo server transport', () => {
  it('injects the server credential only for the fixed HTTPS backend and prevents caching/redirects', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('BACKEND_URL', 'https://backend.example.test');
    vi.stubEnv('LUMICAL_GATEWAY_KEY', 'a'.repeat(64));
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetcher);
    await backendFetch(new URL('https://backend.example.test/api/v1/auth/session'), {
      headers: { Cookie: '__Host-lumical_session=synthetic', 'X-LumiCal-Gateway-Key': 'untrusted' },
      cache: 'force-cache', redirect: 'follow',
    });
    const init = fetcher.mock.calls[0][1];
    expect(init.cache).toBe('no-store');
    expect(init.redirect).toBe('error');
    expect(init.headers.get('X-LumiCal-Gateway-Key')).toBe('a'.repeat(64));
    expect(init.headers.get('Cookie')).toBe('__Host-lumical_session=synthetic');
    expect(() => backendFetch(new URL('https://attacker.example/api/v1/auth/session'))).toThrow('Invalid backend destination');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fails closed with missing secret or plaintext cloud backend', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('BACKEND_URL', 'https://backend.example.test');
    vi.stubEnv('LUMICAL_GATEWAY_KEY', '');
    expect(() => backendFetch(new URL('https://backend.example.test/api/v1/auth/session'))).toThrow('Invalid demo gateway key');
    vi.stubEnv('BACKEND_URL', 'http://backend.example.test');
    expect(() => backendFetch(new URL('http://backend.example.test/api/v1/auth/session'))).toThrow('Invalid backend origin');
  });
});
