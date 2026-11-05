import type { Request, Response } from 'express';
import { demoGateway } from './demo-gateway';

describe('cloud demo gateway', () => {
  const key = 'a'.repeat(64);
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original, RENDER: 'true' };
    delete process.env.LUMICAL_GATEWAY_KEY;
  });
  afterEach(() => {
    process.env = original;
  });

  it('fails startup on Render without a gateway key', () => {
    expect(demoGateway).toThrow('LUMICAL_GATEWAY_KEY');
  });

  it('rejects direct traffic and only trusts the address after checking the key', () => {
    process.env.LUMICAL_GATEWAY_KEY = key;
    const gateway = demoGateway()!;
    const end = jest.fn();
    const res = { locals: {}, status: jest.fn(() => ({ end })) } as unknown as Response;
    const next = jest.fn();
    const request = (credential?: string) => ({
      get: (header: string) => header === 'X-LumiCal-Gateway-Key' ? credential : '192.0.2.1',
    }) as Request;

    gateway(request(), res, next);
    gateway(request('b'.repeat(64)), res, next);
    expect(res.status).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
    expect(res.locals.gatewayClientIp).toBeUndefined();

    gateway(request(key), res, next);
    expect(res.locals.gatewayClientIp).toBe('192.0.2.1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows only the public health probes without a credential', () => {
    process.env.LUMICAL_GATEWAY_KEY = key;
    const gateway = demoGateway()!;
    const end = jest.fn();
    const res = { locals: {}, status: jest.fn(() => ({ end })) } as unknown as Response;
    const next = jest.fn();
    for (const path of ['/api/v1/health/live', '/api/v1/health/ready']) {
      gateway({ method: 'GET', path } as Request, res, next);
    }
    expect(next).toHaveBeenCalledTimes(2);
    for (const [method, path] of [['POST', '/api/v1/health/live'], ['GET', '/api/v1/health/live/extra'], ['GET', '/api/v1/auth/session']]) {
      gateway({ method, path, get: () => undefined } as unknown as Request, res, next);
    }
    expect(res.status).toHaveBeenCalledTimes(3);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
