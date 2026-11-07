import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { IdentityProvider } from '../identity/provider';
import { ProjectWorkspace } from './project-workspace';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
const templateId = '11111111-1111-4111-8111-111111111111';
const projectId = '33333333-3333-4333-8333-333333333333';
const template = { id: templateId, category: 'GENERAL', publishedRevision: {
  id: '22222222-2222-4222-8222-222222222222', version: 1, publishedAt: '2026-01-01T00:00:00.000Z',
  name: { vi: 'Ngày vui', en: 'Bright day' }, description: { vi: 'Mẫu lịch', en: 'A calendar design' },
  layout: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 }, presets: [{ id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } }], price: { currency: 'USD', unitPriceMinor: 1500 },
} };
const created = { id: projectId, title: 'For Mom', year: 2026, recipientName: 'Mom', status: 'WORKING', version: 1, stylePresetId: 'classic',
  baseline: { name: { vi: 'Ngày vui', en: 'Bright day' }, layout: template.publishedRevision.layout }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><PreferencesProvider initial={{ locale: 'en', theme: 'light' }}>
    <IdentityProvider initial={{ phase: 'authenticated', principal: { id: 'actor-1', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' } }}>
      <ProjectWorkspace templateId={templateId} />
    </IdentityProvider>
  </PreferencesProvider></QueryClientProvider>);
}
afterEach(() => { vi.unstubAllGlobals(); push.mockClear(); });

describe('Calendar Project creation experience', () => {
  it('renders published options, preserves draft and reuses the same key/body on retry, then navigates to server ID', async () => {
    const postIntents: { key: string | null; body: unknown }[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/session')) return json({ data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'a'.repeat(64) } });
      if (url.endsWith(`/templates/${templateId}`)) return json({ data: template });
      if (url.endsWith('/projects') && init?.method === 'GET') return json({ data: [], meta: { nextCursor: null, hasMore: false } });
      if (url.endsWith('/projects') && init?.method === 'POST') {
        postIntents.push({ key: new Headers(init.headers).get('Idempotency-Key'), body: JSON.parse(String(init.body)) });
        if (postIntents.length === 1) return json({ error: { code: 'PROVIDER_UNAVAILABLE', requestId: 'req-test', retryable: true, fieldErrors: [] } }, 503);
        return json({ data: created }, 201);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    renderWorkspace();
    expect(await screen.findByText('Bright day')).toBeVisible();
    expect(screen.getByLabelText('Style (required)')).toHaveDisplayValue('Classic');
    fireEvent.change(screen.getByLabelText(/Calendar name/), { target: { value: 'For Mom' } });
    fireEvent.change(screen.getByLabelText(/Made for/), { target: { value: 'Mom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create calendar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your calendar could not be created');
    expect(screen.getByLabelText(/Calendar name/)).toHaveValue('For Mom');
    fireEvent.click(screen.getByRole('button', { name: 'Create calendar' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${projectId}`));
    expect(postIntents).toHaveLength(2);
    expect(postIntents[0]).toEqual(postIntents[1]);
    expect(postIntents[0].body).toEqual({ templateId, title: 'For Mom', year: new Date().getFullYear(), recipientName: 'Mom', stylePresetId: 'classic' });
    expect(new Headers(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')[0][1]?.headers).get('X-CSRF-Token')).toBe('a'.repeat(64));
  });
  it('supports the requested Vietnamese copy', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async input => String(input).endsWith('/auth/session')
      ? json({ data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'b'.repeat(64) } })
      : String(input).endsWith(`/templates/${templateId}`) ? json({ data: template })
        : json({ data: [], meta: { nextCursor: null, hasMore: false } }));
    vi.stubGlobal('fetch', fetcher);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><PreferencesProvider initial={{ locale: 'vi', theme: 'dark' }}>
      <IdentityProvider initial={{ phase: 'authenticated', principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' } }}><ProjectWorkspace templateId={templateId} /></IdentityProvider>
    </PreferencesProvider></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Tạo lịch của bạn' })).toBeVisible();
    expect(screen.getByLabelText(/Tên lịch/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Lịch của bạn' })).toBeVisible();
  });
});
