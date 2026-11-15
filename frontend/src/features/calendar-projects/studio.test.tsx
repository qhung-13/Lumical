import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { IdentityProvider } from '../identity/provider';
import { Studio } from './studio';

const projectId = '33333333-3333-4333-8333-333333333333';
const ownerId = '11111111-1111-4111-8111-111111111111';
const savedProject = { id: projectId, title: 'Family calendar', year: 2027, recipientName: 'Grandma', status: 'WORKING', version: 3,
  stylePresetId: 'classic', baseline: { name: { vi: 'Mẫu gia đình', en: 'Family design' }, layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 } },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', deletionEligible: true };
const monthData = { projectVersion: 3, months: Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1,
  caption: index === 2 ? 'Birthday memories' : null, images: index === 2 ? [{ assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', altText: 'Family photo', crop: null }] : [] })) };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

function renderStudio(options: { status?: 'WORKING' | 'ARCHIVED'; monthVersion?: number; locale?: 'en' | 'vi' } = {}) {
  const project = { ...savedProject, status: options.status ?? 'WORKING' };
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async input => {
    const url = String(input);
    if (url.endsWith('/auth/session')) return json({ data: { authenticated: true,
      principal: { id: ownerId, email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } });
    if (url.endsWith(`/projects/${projectId}/months`)) return json({ data: { ...monthData, projectVersion: options.monthVersion ?? 3 } });
    if (url.endsWith(`/projects/${projectId}`)) return json({ data: project });
    return json({ error: { code: 'NOT_FOUND' } }, 404);
  }));
  return render(<PreferencesProvider initial={{ locale: options.locale ?? 'en', theme: 'light' }}>
    <IdentityProvider initial={{ phase: 'authenticated', principal: { id: ownerId, email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' } }}>
      <Studio id={projectId} />
    </IdentityProvider>
  </PreferencesProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe('guided Studio shell', () => {
  it('offers all twelve months and moves selection and focus by keyboard without changing saved content', async () => {
    renderStudio();
    const user = userEvent.setup();
    const tabs = await screen.findByRole('tablist', { name: 'Choose a month' });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(12);
    expect(screen.getByRole('status')).toHaveTextContent('Loaded saved version 3');

    const january = within(tabs).getByRole('tab', { name: 'January' });
    january.focus();
    await user.keyboard('{ArrowRight}');
    const february = within(tabs).getByRole('tab', { name: 'February' });
    expect(february).toHaveFocus();
    expect(february).toHaveAttribute('aria-selected', 'true');

    await user.click(within(tabs).getByRole('tab', { name: 'March' }));
    expect(screen.getByRole('heading', { name: 'March 2027' })).toBeVisible();
    expect(screen.getAllByText('Birthday memories')).toHaveLength(2);
    expect(screen.getByText('1 saved image')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Loaded saved version 3');
  });

  it('shows archived Projects as read-only while keeping saved Months reviewable', async () => {
    renderStudio({ status: 'ARCHIVED' });
    expect(await screen.findByText('This calendar is archived. You can review its saved months, but editing is unavailable.')).toBeVisible();
    expect(screen.getByRole('tablist', { name: 'Choose a month' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /edit|save|upload/i })).not.toBeInTheDocument();
  });

  it('warns when Project and Month reads refer to different persisted versions', async () => {
    renderStudio({ monthVersion: 4 });
    expect(await screen.findByRole('alert')).toHaveTextContent('The Project and Month data are from different saved versions.');
    expect(screen.getByRole('status')).toHaveTextContent('different saved versions');
  });

  it('renders Vietnamese month names and archived state copy', async () => {
    renderStudio({ locale: 'vi', status: 'ARCHIVED' });
    const tabs = await screen.findByRole('tablist', { name: 'Chọn tháng' });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(12);
    expect(within(tabs).getByRole('tab', { name: 'Tháng 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Lịch đã được lưu trữ. Bạn có thể xem lại các tháng đã lưu nhưng không thể chỉnh sửa.')).toBeVisible();
  });
});
