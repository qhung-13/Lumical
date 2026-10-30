import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicTemplate } from '../../api/templates';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { TemplateCatalogScreen, TemplateDetailScreen } from './template-screens';

const identityMock = vi.hoisted(() => ({ phase: 'unauthenticated' }));
vi.mock('../identity/provider', () => ({ useIdentity: () => ({ state: { phase: identityMock.phase } }) }));

const item: PublicTemplate = {
  id: '11111111-1111-4111-8111-111111111111', category: 'BIRTHDAY',
  publishedRevision: {
    id: '22222222-2222-4222-8222-222222222222', version: 1, publishedAt: '2026-02-01T00:00:00.000Z',
    name: { vi: 'Ngày vui', en: 'Bright day' }, description: { vi: 'Thiết kế cho sinh nhật', en: 'A birthday calendar design' },
    layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 },
    presets: [{ id: 'minimal', name: { vi: 'Tối giản', en: 'Minimal' } }], price: { currency: 'USD', unitPriceMinor: 1450 },
  },
};
const page = (data: PublicTemplate[] = [], nextCursor: string | null = null, hasMore = false) => ({ data, meta: { nextCursor, hasMore } });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(status >= 400 ? { error: { code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_FAILED' } } : { data }), {
  status, headers: { 'Content-Type': 'application/json' },
});
function renderWithProviders(node: React.ReactNode, locale: 'en' | 'vi' = 'en') {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={queries}><PreferencesProvider initial={{ locale, theme: 'light' }}>{node}</PreferencesProvider></QueryClientProvider>);
}
afterEach(() => { vi.unstubAllGlobals(); identityMock.phase = 'unauthenticated'; });

describe('public Template catalog and detail screens', () => {
  it('renders bilingual design information, USD price and a clearly labeled neutral illustration', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(page([item])));
    vi.stubGlobal('fetch', fetcher);
    renderWithProviders(<TemplateCatalogScreen />, 'vi');
    expect(await screen.findByRole('heading', { name: 'Ngày vui' })).toBeVisible();
    expect(screen.getAllByText('Sinh nhật').length).toBeGreaterThan(1);
    expect(screen.getByText('Ảnh ghép')).toBeVisible();
    expect(screen.getByText('Tối giản')).toBeVisible();
    expect(screen.getByText(/14,50\s?US\$/u)).toBeVisible();
    expect(screen.getByRole('img', { name: /Minh họa bố cục trung tính/ })).toBeVisible();
    expect(screen.getByText('Chỉ là minh họa')).toBeVisible();
  });

  it('distinguishes loading, empty catalog and empty filter results', async () => {
    let finish!: (value: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetcher);
    const view = renderWithProviders(<TemplateCatalogScreen />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading designs');
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    finish(response(page()));
    expect(await screen.findByRole('heading', { name: 'No designs are published yet' })).toBeVisible();

    view.unmount();
    const filteredFetcher = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(response(page())));
    vi.stubGlobal('fetch', filteredFetcher);
    renderWithProviders(<TemplateCatalogScreen />);
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'BIRTHDAY' } });
    await waitFor(() => expect(filteredFetcher).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('heading', { name: 'No designs match these filters' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  });

  it('applies category and search filters through contract query parameters', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(page([item])));
    vi.stubGlobal('fetch', fetcher);
    renderWithProviders(<TemplateCatalogScreen />);
    await screen.findByRole('heading', { name: 'Bright day' });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'BIRTHDAY' } });
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).includes('category=BIRTHDAY'))).toBe(true));
    fireEvent.change(screen.getByLabelText(/Search designs/), { target: { value: 'birthday' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).includes('query=birthday') && String(url).includes('category=BIRTHDAY'))).toBe(true));
  });

  it('shows an initial catalog error with an explicit retry action', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({}, 422)).mockImplementationOnce(() => Promise.resolve(response(page([item]))));
    vi.stubGlobal('fetch', fetcher);
    renderWithProviders(<TemplateCatalogScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Designs could not be loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Bright day' })).toBeVisible();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps loaded results visible when loading another cursor fails and retries that cursor', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(page([item], 'next-cursor', true)))
      .mockResolvedValueOnce(response({}, 422)).mockResolvedValueOnce(response(page([], null, false)));
    vi.stubGlobal('fetch', fetcher);
    renderWithProviders(<TemplateCatalogScreen />);
    expect(await screen.findByRole('heading', { name: 'Bright day' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText(/More designs could not be loaded/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Bright day' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(screen.queryByText(/More designs could not be loaded/)).not.toBeInTheDocument();
  });

  it('renders detail specs in the selected locale and handles an unavailable detail safely', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(item))
      .mockResolvedValueOnce(response({}, 404));
    vi.stubGlobal('fetch', fetcher);
    const view = renderWithProviders(<TemplateDetailScreen id={item.id} />, 'vi');
    expect(await screen.findByRole('heading', { name: 'Ngày vui' })).toBeVisible();
    expect(screen.getByText('Ảnh ghép')).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
    expect(screen.getByText(/14,50\s?US\$/u)).toBeVisible();
    view.unmount();
    renderWithProviders(<TemplateDetailScreen id="missing" />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('not found or is no longer available'));
  });

  it('routes the temporary CTA through login for guests and to account for an authenticated user', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(response(item)));
    vi.stubGlobal('fetch', fetcher);
    const view = renderWithProviders(<TemplateDetailScreen id={item.id} />);
    const cta = await screen.findByRole('link', { name: 'Continue with this design' });
    expect(cta).toHaveAttribute('href', `/login?next=${encodeURIComponent(`/account?templateId=${item.id}`)}`);
    view.unmount();
    identityMock.phase = 'authenticated';
    renderWithProviders(<TemplateDetailScreen id={item.id} />);
    expect(await screen.findByRole('link', { name: 'Continue with this design' })).toHaveAttribute('href', `/account?templateId=${item.id}`);
  });
});
