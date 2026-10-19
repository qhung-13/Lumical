import { parseSession } from '../api/identity';
import type { SafeBootstrap } from '../features/identity/session-manager';

// Pure server transport helper, tested without rendering or serializing raw cookies.
export async function serverBootstrap(cookieHeader: string | null, origin: string, cookieName: string, fetcher: typeof fetch = fetch): Promise<SafeBootstrap> {
  try {
    const trusted = new URL(origin);
    if (!['http:', 'https:'].includes(trusted.protocol) || trusted.origin !== origin || trusted.username || trusted.password) throw new Error();
    const relevant = (cookieHeader ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${cookieName}=`));
    const cookie = relevant.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(relevant[0].slice(cookieName.length + 1)) ? relevant[0] : undefined;
    const response = await fetcher(new URL('/api/v1/auth/session', trusted), { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) } });
    if (response.status === 401) return { phase: 'unauthenticated' };
    if (!response.ok) return { phase: 'unavailable' };
    const envelope: unknown = await response.json();
    if (!envelope || typeof envelope !== 'object' || !('data' in envelope)) throw new Error();
    const session = parseSession(envelope.data);
    // CSRF is acquired by the browser bootstrap; neither token nor cookie is a client prop.
    return session.authenticated ? { phase: 'authenticated', principal: session.principal } : { phase: 'unauthenticated' };
  } catch { return { phase: 'unavailable' }; }
}
