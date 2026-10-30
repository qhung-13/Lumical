import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  templateApi, templateDetailOptions, templateKeys, templateListOptions, TemplateApiError,
  type PublicTemplate,
} from './templates';

const sample: PublicTemplate = {
  id: '11111111-1111-4111-8111-111111111111',
  category: 'BIRTHDAY',
  publishedRevision: {
    id: '22222222-2222-4222-8222-222222222222', version: 3, publishedAt: '2026-01-02T03:04:05.000Z',
    name: { vi: 'Ngày vui', en: 'Bright day' }, description: { vi: 'Thiết kế vui', en: 'A joyful design' },
    layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 },
    presets: [{ id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } }],
    price: { currency: 'USD', unitPriceMinor: 1450 },
  },
};
const envelope = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
const clients: QueryClient[] = [];
const client = () => {
  const value = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(value);
  return value;
};
afterEach(() => { clients.forEach(queryClient => queryClient.clear()); clients.length = 0; });

describe('typed public Template API and query integration', () => {
  it('requests a filtered cursor page with generated contract parameters and returns only its data/meta projection', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(envelope({ data: [sample], meta: { nextCursor: 'opaque-next', hasMore: true } }));
    const result = await templateApi(fetcher).list({ category: 'BIRTHDAY', query: '  party  ', cursor: 'opaque', limit: 7 });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('/api/v1/templates?category=BIRTHDAY&query=++party++&cursor=opaque&limit=7');
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' } });
    expect(result).toEqual({ data: [sample], meta: { nextCursor: 'opaque-next', hasMore: true } });
  });

  it('loads detail by an encoded ID and maps unavailable detail to a safe 404 error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(envelope(sample))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 }));
    expect(await templateApi(fetcher).detail(sample.id)).toEqual(sample);
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/templates/${sample.id}`);
    await expect(templateApi(fetcher).detail('bad/id')).rejects.toMatchObject({ name: 'TemplateApiError', code: 'NOT_FOUND', status: 404 });
    expect(fetcher.mock.calls[1][0]).toBe('/api/v1/templates/bad%2Fid');
  });

  it('rejects malformed DTOs and malformed envelopes without exposing response contents', async () => {
    const bad = structuredClone(sample) as { publishedRevision: { price: { currency: string; unitPriceMinor: number } } };
    bad.publishedRevision.price.unitPriceMinor = 0;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(envelope({ data: [bad], meta: { nextCursor: null, hasMore: false } }));
    await expect(templateApi(fetcher).list()).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 502 });
  });

  it('keys list cache by category, query, cursor and limit, and keeps detail IDs separate', () => {
    expect(templateKeys.list({ category: 'GENERAL', query: 'x', cursor: 'a', limit: 10 }))
      .not.toEqual(templateKeys.list({ category: 'GENERAL', query: 'x', cursor: 'b', limit: 10 }));
    expect(templateKeys.list({ category: 'GENERAL', query: 'x', cursor: 'a', limit: 10 }))
      .not.toEqual(templateKeys.list({ category: 'BIRTHDAY', query: 'x', cursor: 'a', limit: 10 }));
    expect(templateKeys.detail(sample.id)).not.toEqual(templateKeys.detail('33333333-3333-4333-8333-333333333333'));
  });

  it('retries transient list failures and returns cursor metadata for load-more orchestration', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(envelope({ data: [sample], meta: { nextCursor: 'next', hasMore: true } }));
    const queryClient = client();
    const page = await queryClient.fetchQuery(templateListOptions({ limit: 1 }, fetcher));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(page.meta).toEqual({ nextCursor: 'next', hasMore: true });
    expect('previousCursor' in page.meta).toBe(false);
  });

  it('does not automatically retry a 404 detail response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }));
    const queryClient = client();
    await expect(queryClient.fetchQuery(templateDetailOptions('missing-id', fetcher))).rejects.toBeInstanceOf(TemplateApiError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
