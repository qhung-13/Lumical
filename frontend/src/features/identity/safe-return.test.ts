import { describe, expect, it } from 'vitest';
import { safeReturnTo, safeTemplateId, singleSearchParam } from './safe-return';

const id = '11111111-1111-4111-8111-111111111111';
describe('safe auth return context', () => {
  it('preserves only the supported local account destination and template UUID', () => {
    expect(safeReturnTo(`/account?templateId=${id}`)).toBe(`/account?templateId=${id}`);
    expect(safeReturnTo('/account')).toBe('/account');
    expect(safeTemplateId(id)).toBe(id);
    expect(safeTemplateId('not-a-uuid')).toBeUndefined();
    expect(singleSearchParam(id)).toBe(id);
    expect(singleSearchParam([id, id])).toBeUndefined();
  });
  it('rejects external, unsupported, ambiguous and malformed destinations', () => {
    for (const value of ['https://evil.invalid', '//evil.invalid/account', '/projects', '/account#section', `/account?templateId=${id}&next=https://evil.invalid`, `/account?templateId=${id}&templateId=${id}`, '/account?templateId=bad', '/account\\@evil.invalid']) {
      expect(safeReturnTo(value)).toBe('/account');
    }
    expect(safeReturnTo(null)).toBe('/account');
  });
});
