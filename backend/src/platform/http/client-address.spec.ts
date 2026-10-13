import { canonicalIp, trustedProxy } from './client-address';

describe('Verified client addresses', () => {
  it.each(['127.0.0.1', '::ffff:127.0.0.1', '::FFFF:7f00:1', '0:0:0:0:0:ffff:7f00:1'])('canonicalizes %s to the same IPv4 identity', address => {
    expect(canonicalIp(address)).toBe('127.0.0.1');
  });
  it('normalizes IPv6 and rejects addresses with ports, CIDRs or fabricated chains', () => {
    expect(canonicalIp('2001:0DB8:0:0:0:0:0:1')).toBe('2001:db8::1');
    for (const bad of ['127.0.0.1:8080', '127.0.0.1, 198.51.100.1', '127.0.0.0/8', 'true']) expect(canonicalIp(bad)).toBeUndefined();
  });
  it('trusts only the configured immediate peer; no default trust or extra proxy hops', () => {
    const proxy = trustedProxy(['127.0.0.1']);
    expect(proxy('::ffff:127.0.0.1', 0)).toBe(true);
    expect(proxy('127.0.0.1', 1)).toBe(false);
    expect(proxy('127.0.0.2', 0)).toBe(false);
    expect(trustedProxy([])('127.0.0.1', 0)).toBe(false);
  });
});
