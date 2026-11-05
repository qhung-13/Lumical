// Server-side transport for the isolated cloud demo and the existing internal SSR origin.
export function demoGatewayEnabled(): boolean {
  return process.env.VERCEL === '1' || process.env.LUMICAL_GATEWAY_KEY !== undefined;
}

export function backendOrigin(): string {
  const origin = process.env.BACKEND_URL ?? 'http://localhost:3001';
  const parsed = new URL(origin);
  if (origin !== parsed.origin || !['https:', 'http:'].includes(parsed.protocol) ||
      (demoGatewayEnabled() && parsed.protocol !== 'https:')) {
    throw new Error('Invalid backend origin.');
  }
  return origin;
}

export const backendFetch: typeof fetch = (input, init) => {
  if (!(input instanceof URL) || input.origin !== backendOrigin()) {
    throw new Error('Invalid backend destination.');
  }
  const headers = new Headers(init?.headers);
  if (demoGatewayEnabled()) {
    const key = process.env.LUMICAL_GATEWAY_KEY;
    if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid demo gateway key.');
    headers.set('X-LumiCal-Gateway-Key', key);
  }
  return fetch(input, { ...init, headers, cache: 'no-store', redirect: 'error' });
};
