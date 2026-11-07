import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { IdentityProvider } from '../identity/provider';
import { ProjectDetail } from './project-detail';

const id = '33333333-3333-4333-8333-333333333333';
const stored = { id, title: 'Persisted title', year: 2027, recipientName: 'Grandma', status: 'WORKING', version: 3, stylePresetId: 'minimal',
  baseline: { name: { vi: 'Mẫu gốc', en: 'Captured design' }, layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 } },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' };
afterEach(() => vi.unstubAllGlobals());
describe('persisted Project reopen view', () => {
  it('loads the Project through GET detail and renders only the persisted response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/auth/session')) return new Response(JSON.stringify({ data: { authenticated: true,
        principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } }), { status: 200 });
      if (url.endsWith(`/projects/${id}`)) return new Response(JSON.stringify({ data: stored }), { status: 200 });
      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><PreferencesProvider initial={{ locale: 'en', theme: 'light' }}>
      <IdentityProvider initial={{ phase: 'authenticated', principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' } }}><ProjectDetail id={id} /></IdentityProvider>
    </PreferencesProvider></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Persisted title' })).toBeVisible();
    expect(screen.getByText('Captured design')).toBeVisible();
    expect(screen.getByText('Grandma')).toBeVisible();
    expect(fetcher.mock.calls.some(([url]) => String(url) === `/api/v1/projects/${id}`)).toBe(true);
    client.clear();
  });
});
