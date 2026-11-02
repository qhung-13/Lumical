import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminTemplateError, adminTemplateApi, adminTemplateDetailOptions, adminTemplateListOptions } from './admin-templates';

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  category: 'GENERAL',
  availability: 'INACTIVE',
  version: 2,
  currentPublishedRevisionId: null,
  publishedRevision: null,
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const apiWith = (fetcher: typeof fetch) => adminTemplateApi({ csrf: () => 'csrf-token', fetcher });

afterEach(() => vi.unstubAllGlobals());

describe('admin template boundary (contract §17)', () => {
  it('parses the list envelope and passes query parameters', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [row], meta: { nextCursor: null, hasMore: false } }));
    const result = await apiWith(fetcher).list({ state: 'ACTIVE', limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.hasMore).toBe(false);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe('/api/v1/admin/templates?state=ACTIVE&limit=20');
    expect(init?.method).toBe('GET');
  });

  it('sends CSRF, Idempotency-Key and parses the 201 envelope on create', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: row }, 201));
    const body = { category: 'GENERAL', revision: { name: { vi: 'A', en: 'B' } } };
    const result = await apiWith(fetcher).create(body as never, 'key-1');
    expect(result.id).toBe(row.id);
    const [, init] = fetcher.mock.calls[0];
    expect(init?.headers).toMatchObject({ 'X-CSRF-Token': 'csrf-token', 'Idempotency-Key': 'key-1', 'Content-Type': 'application/json' });
  });

  it('formats If-Match as a quoted version on publish and availability', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(jsonResponse({ data: row }, 201)));
    const api = apiWith(fetcher);
    await api.publish(row.id, { revision: {} as never }, 'k1', 5);
    await api.availability(row.id, { availability: 'ACTIVE', reason: 'why' }, 'k2', 6);
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/admin/templates/${row.id}/revisions`);
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ 'If-Match': '"5"' });
    expect(fetcher.mock.calls[1][0]).toBe(`/api/v1/admin/templates/${row.id}/availability`);
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ 'If-Match': '"6"' });
    expect(fetcher.mock.calls[1][1]?.method).toBe('PUT');
  });

  it('surfaces 412 with currentVersion for conflict handling', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      error: { code: 'VERSION_CONFLICT', messageKey: 'errors.versionConflict', requestId: 'r1', retryable: false, currentVersion: 7, fieldErrors: [] },
    }, 412));
    const failure = await apiWith(fetcher).publish(row.id, { revision: {} as never }, 'k', 5).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AdminTemplateError);
    expect(failure).toMatchObject({ code: 'VERSION_CONFLICT', status: 412, currentVersion: 7, requestId: 'r1' });
  });

  it('extracts safe field paths from 422 fieldErrors', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      error: {
        code: 'VALIDATION_FAILED', messageKey: 'errors.validationFailed', requestId: 'r2', retryable: false,
        fieldErrors: [{ path: 'price.unitPriceMinor', code: 'INVALID', messageKey: 'validation.price.unitPriceMinor' }],
      },
    }, 422));
    const failure = await apiWith(fetcher).create({} as never, 'k').catch((error: unknown) => error) as AdminTemplateError;
    expect(failure.status).toBe(422);
    expect(failure.fields).toEqual([{ path: 'price.unitPriceMinor', messageKey: 'validation.price.unitPriceMinor' }]);
  });

  it('rejects malformed success payloads instead of trusting the wire', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { ...row, availability: 'PAUSED' } }));
    const failure = await apiWith(fetcher).list().catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 502 });
  });

  it('maps transport failures to a retryable provider error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network down'));
    const failure = await apiWith(fetcher).list().catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 503 });
  });
});

describe('react query options', () => {
  it('includes state and cursor in the list key', () => {
    expect(adminTemplateListOptions({ state: 'ACTIVE', cursor: 'c1' }).queryKey)
      .toEqual(['admin-templates', 'list', 'ACTIVE', 'c1', null]);
  });

  it('walks cursor pages to find one template by id', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: [], meta: { nextCursor: 'next', hasMore: true } }))
      .mockResolvedValueOnce(jsonResponse({ data: [row], meta: { nextCursor: null, hasMore: false } }));
    const options = adminTemplateDetailOptions(row.id, adminTemplateApi({ csrf: () => undefined, fetcher }));
    const found = await options.queryFn({ signal: new AbortController().signal });
    expect(found?.id).toBe(row.id);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1][0])).toContain('cursor=next');
  });

  it('returns null when the template is not in any page', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [], meta: { nextCursor: null, hasMore: false } }));
    const options = adminTemplateDetailOptions('missing', adminTemplateApi({ csrf: () => undefined, fetcher }));
    await expect(options.queryFn({ signal: new AbortController().signal })).resolves.toBeNull();
  });
});
