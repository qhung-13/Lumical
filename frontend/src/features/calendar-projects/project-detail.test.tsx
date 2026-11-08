import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { IdentityProvider } from '../identity/provider';
import { ProjectDetail } from './project-detail';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const id = '33333333-3333-4333-8333-333333333333';
const stored = { id, title: 'Persisted title', year: 2027, recipientName: 'Grandma', status: 'WORKING', version: 3, stylePresetId: 'minimal',
  baseline: { name: { vi: 'Mẫu gốc', en: 'Captured design' }, layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 } },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', deletionEligible: true };
const months = { projectVersion: 3, months: Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1, caption: index === 0 ? 'January memory' : null })) };
afterEach(() => vi.unstubAllGlobals());
describe('persisted Project reopen view', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  });
  it('loads the Project through GET detail and renders only the persisted response', async () => {
    let currentStatus = 'WORKING'; let currentVersion = 3;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/session')) return new Response(JSON.stringify({ data: { authenticated: true,
        principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } }), { status: 200 });
      if (url.endsWith(`/projects/${id}/months`)) return new Response(JSON.stringify({ data: { ...months, projectVersion: currentVersion } }), { status: 200 });
      if (url.endsWith(`/projects/${id}`) && init?.method === 'GET') return new Response(JSON.stringify({ data: { ...stored, status: currentStatus, version: currentVersion } }), { status: 200 });
      if (url.endsWith(`/projects/${id}/archive`) && init?.method === 'POST') { currentStatus = 'ARCHIVED'; currentVersion++; return new Response(JSON.stringify({ data: { ...stored, status: currentStatus, version: currentVersion } }), { status: 200 }); }
      if (url.endsWith(`/projects/${id}/restore`) && init?.method === 'POST') { currentStatus = 'WORKING'; currentVersion++; return new Response(JSON.stringify({ data: { ...stored, status: currentStatus, version: currentVersion } }), { status: 200 }); }
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
    const tablist = await screen.findByRole('tablist', { name: 'Calendar months' });
    expect(within(tablist).getAllByRole('tab')).toHaveLength(12);
    expect(screen.getByText('January memory')).toBeVisible();
    await userEvent.click(within(tablist).getByRole('tab', { name: 'March' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('No saved notes for this month yet.');
    expect(within(tablist).getByRole('tab', { name: 'March' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(within(tablist).getByRole('tab', { name: 'April' })).toHaveFocus();
    expect(within(tablist).getByRole('tab', { name: 'April' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Archive calendar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Archive calendar' }));
    expect(screen.getByRole('dialog', { name: 'Archive this calendar?' })).toBeVisible();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Archive calendar' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Archived')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Restore calendar' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('In progress')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(screen.getByRole('dialog', { name: 'Permanently delete this calendar?' })).toBeVisible();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    expect(fetcher.mock.calls.some(([url]) => String(url) === `/api/v1/projects/${id}`)).toBe(true);
    expect(fetcher.mock.calls.some(([url]) => String(url) === `/api/v1/projects/${id}/months`)).toBe(true);
    client.clear();
  });
});
