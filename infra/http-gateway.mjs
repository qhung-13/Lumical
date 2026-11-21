// Shared transport policy for the socket gateway and the Next.js server adapter.
export function trustedOrigin(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password) throw new Error('Invalid trusted proxy origin.');
  return url;
}

const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
export function transportHeaders(source) {
  const extra = String(source.connection ?? '').split(',').map(value => value.trim().toLowerCase());
  return Object.fromEntries(Object.entries(source).filter(([name]) => !hopHeaders.has(name.toLowerCase()) && !extra.includes(name.toLowerCase())));
}

export function upstreamTimeout(pathname) {
  return /^\/api\/v1\/media\/[^/]+\/(?:content|finalize)\/?$/i.test(pathname) ? 30_000 : 15_000;
}

export function gatewayFailure(requestId) {
  return { error: { code: 'PROVIDER_UNAVAILABLE', messageKey: 'errors.unavailable', requestId, retryable: true, fieldErrors: [] } };
}
