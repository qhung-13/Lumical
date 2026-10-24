import { isIP } from 'node:net';

// Normalize socket/verified-proxy addresses, never an arbitrary request header.
export function canonicalIp(address: string): string | undefined {
  const family = isIP(address);
  if (family === 4) return address;
  if (family !== 6) return undefined;
  try {
    const normalized = new URL(`http://[${address}]`).hostname.slice(1, -1);
    const mapped = /^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/.exec(normalized);
    if (!mapped) return normalized;
    const high = parseInt(mapped[1], 16); const low = parseInt(mapped[2], 16);
    return [high >>> 8, high & 255, low >>> 8, low & 255].join('.');
  } catch { return undefined; }
}

// Trust the immediate configured gateway only. A supplied chain cannot add hops.
export function trustedProxy(addresses: readonly string[]) {
  return (address: string, hop: number): boolean => hop === 0 && addresses.includes(canonicalIp(address) ?? '');
}
