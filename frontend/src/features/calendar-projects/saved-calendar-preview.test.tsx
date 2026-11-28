import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectPreview } from '../../api/projects';
import { createSavedCalendarPreview, isCivilDateInYear, PreviewSnapshotError, type SavedCalendarPreview } from './saved-calendar-preview-model';
import { SavedCalendarPreview as Preview } from './saved-calendar-preview';
import { finalizationHandoffHref } from './finalization-handoff';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const emptyMonths = Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1, caption: null, images: [] }));
const project = { id: 'project', version: 4, year: 2028, title: 'Family memories', recipientName: 'Grandma', status: 'ARCHIVED' as const, stylePresetId: 'classic', baseline: { layout: { type: 'PHOTO_FOCUS' } } };
const months = { projectVersion: 4, months: emptyMonths.map((month, index) => index === 0 ? {
  ...month, caption: 'Happy memories', images: [
    { assetId: '11111111-1111-4111-8111-111111111111', altText: 'Family at the beach', contentPath: '/api/v1/media/11111111-1111-4111-8111-111111111111/content' },
    { assetId: '22222222-2222-4222-8222-222222222222', altText: 'Grandma smiling' },
  ],
} : month) };
const events = { projectVersion: 4, events: [{ id: 'event-1', date: '2028-02-29', title: 'Grandma’s birthday', note: 'Celebrate together' }] };
const readiness = { previewReady: true, arReady: false, finalizationContentReady: false, orderReady: false,
  issues: { preview: [], ar: ['AR_SETUP_REQUIRED'], order: ['CALENDAR_IMAGE_REQUIRED', 'AR_REQUIREMENTS_INCOMPLETE', 'PROJECT_REVIEW_REQUIRED'] } } satisfies ProjectPreview['readiness'];
function snapshot(): SavedCalendarPreview { return createSavedCalendarPreview(project, months, events, readiness); }

describe('saved calendar preview', () => {
  it('only composes persisted projections when every source has the same revision', () => {
    expect(snapshot()).toMatchObject({ projectVersion: 4, year: 2028 });
    expect(snapshot().months).toHaveLength(12);
    expect(() => createSavedCalendarPreview(project, { ...months, projectVersion: 3 }, events, readiness)).toThrow(PreviewSnapshotError);
    expect(() => createSavedCalendarPreview(project, months, { ...events, projectVersion: 5 }, readiness)).toThrow(PreviewSnapshotError);
  });

  it('validates civil Special Dates without timezone conversion and handles leap years', () => {
    expect(isCivilDateInYear('2028-02-29', 2028)).toBe(true);
    expect(isCivilDateInYear('2027-02-29', 2027)).toBe(false);
    expect(isCivilDateInYear('2028-13-01', 2028)).toBe(false);
    expect(isCivilDateInYear('2029-01-01', 2028)).toBe(false);
    expect(() => createSavedCalendarPreview(project, months, { projectVersion: 4,
      events: [{ id: 'out-of-year', date: '2029-01-01', title: 'Wrong year' }] }, readiness)).toThrow(PreviewSnapshotError);
  });

  it('renders all twelve persisted months, saved details and truthful empty placeholders', () => {
    const { rerender } = render(<Preview snapshot={snapshot()} locale="en" actorId="owner-a" />);
    expect(screen.getByRole('heading', { name: 'Family memories' })).toBeVisible();
    expect(screen.getByText('Saved revision 4')).toBeVisible();
    expect(screen.getByText('Archived · read-only')).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.getByAltText('Family at the beach')).toBeVisible();
    expect(screen.getAllByText('Happy memories')).toHaveLength(2);
    expect(screen.getByRole('article', { name: 'February 2028' })).toHaveTextContent('Grandma’s birthday');
    expect(within(screen.getByRole('article', { name: 'February 2028' })).getByText('No saved photo yet')).toBeVisible();
    expect(within(screen.getByRole('article', { name: 'February 2028' })).getByText('No saved message yet')).toBeVisible();
    expect(screen.getByText('Saved revision checks')).toBeVisible();
    expect(screen.getByText('AR content has not been set up')).toBeVisible();
    expect(screen.getByText(/do not confirm finalization or checkout eligibility/i)).toBeVisible();
    rerender(<Preview snapshot={snapshot()} locale="vi" actorId="owner-a" />);
    const january = screen.getByRole('article', { name: 'Tháng 1 2028' });
    expect(within(january).getByRole('columnheader', { name: 'Thứ Hai' })).toHaveTextContent('T2');
    expect(within(january).getByRole('columnheader', { name: 'Thứ Ba' })).toHaveTextContent('T3');
    expect(within(january).getByRole('columnheader', { name: 'Thứ Tư' })).toHaveTextContent('T4');
    expect(within(january).getByRole('columnheader', { name: 'Thứ Năm' })).toHaveTextContent('T5');
    expect(within(january).getByRole('columnheader', { name: 'Thứ Sáu' })).toHaveTextContent('T6');
    expect(within(january).getByRole('columnheader', { name: 'Thứ Bảy' })).toHaveTextContent('T7');
    expect(within(january).getByRole('columnheader', { name: 'Chủ Nhật' })).toHaveTextContent('CN');
  });

  it('offers keyboard-operable year/month selection and a separate ordered readable list', async () => {
    const user = userEvent.setup();
    render(<Preview snapshot={snapshot()} locale="vi" actorId="owner-a" />);
    const group = screen.getByRole('group', { name: 'Bản xem trước lịch đã lưu' });
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cả năm' })).toHaveFocus();
    await user.keyboard('{Tab}{Enter}');
    expect(screen.getByRole('button', { name: 'Tháng đã chọn' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('navigation', { name: 'Tháng đã chọn' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Tháng 2' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Tháng 2 2028' })).toBeVisible();
    const readable = screen.getByText('Danh sách nội dung lịch');
    await user.click(readable);
    const details = readable.closest('details');
    expect(details).not.toBeNull();
    const lists = within(details as HTMLElement).getAllByRole('list');
    expect(lists[0].querySelectorAll(':scope > li')).toHaveLength(12);
    expect(group).toBeVisible();
  });

  it('rejects more than four persisted photos instead of silently truncating', () => {
    const tooMany = { ...months, months: months.months.map((month, index) => index === 0 ? { ...month, images: Array.from({ length: 5 }, (_, i) => ({ assetId: `id-${i}`, altText: '' })) } : month) };
    expect(() => createSavedCalendarPreview(project, tooMany, events, readiness)).toThrow(PreviewSnapshotError);
  });

  it('uses a neutral localized label for an unrecognized saved style preset', () => {
    const custom = { ...snapshot(), stylePresetId: 'internal-style-id' };
    const { rerender } = render(<Preview snapshot={custom} locale="vi" actorId="owner-a" />);
    expect(screen.getByText('Phong cách đã lưu')).toBeVisible();
    expect(screen.queryByText('internal-style-id')).not.toBeInTheDocument();
    rerender(<Preview snapshot={custom} locale="en" actorId="owner-a" />);
    expect(screen.getByText('Saved custom style')).toBeVisible();
    expect(screen.queryByText('internal-style-id')).not.toBeInTheDocument();
  });

  it('binds the review acknowledgement to the displayed Project revision and actor', async () => {
    const user = userEvent.setup();
    const saved = snapshot();
    const working = { ...saved, status: 'WORKING' as const };
    const { rerender } = render(<Preview snapshot={working} locale="en" actorId="owner-a" />);
    expect(screen.getByRole('button', { name: 'I reviewed saved revision 4' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Continue to Finalization' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'I reviewed saved revision 4' }));
    expect(screen.getByRole('status')).toHaveTextContent('You confirmed that you reviewed saved revision 4.');

    rerender(<Preview snapshot={{ ...working, projectVersion: 5 }} locale="en" actorId="owner-a" />);
    expect(screen.getByRole('status')).toHaveTextContent('The saved Project revision changed. Refresh and review the current revision again.');
    rerender(<Preview snapshot={working} locale="en" actorId="owner-a" />);
    expect(screen.getByRole('status')).toHaveTextContent('The saved Project revision changed. Refresh and review the current revision again.');
    await user.click(screen.getByRole('button', { name: 'I reviewed saved revision 4' }));
    expect(screen.getByRole('status')).toHaveTextContent('You confirmed that you reviewed saved revision 4.');
    rerender(<Preview snapshot={{ ...working, projectVersion: 5 }} locale="en" actorId="owner-a" />);
    expect(screen.getByRole('status')).toHaveTextContent('The saved Project revision changed. Refresh and review the current revision again.');
    await user.click(screen.getByRole('button', { name: 'I reviewed saved revision 5' }));
    expect(screen.getByRole('status')).toHaveTextContent('You confirmed that you reviewed saved revision 5.');

    rerender(<Preview snapshot={{ ...working, projectVersion: 5 }} locale="en" actorId="owner-b" />);
    expect(screen.getByRole('status')).toHaveTextContent('The saved Project revision changed. Refresh and review the current revision again.');
  });

  it('enables the typed handoff only after current-revision review and authoritative content readiness', async () => {
    const user = userEvent.setup();
    push.mockClear();
    const eligible = { ...snapshot(), status: 'WORKING' as const, readiness: {
      ...readiness,
      finalizationContentReady: true,
      // Full readiness can still be false because UI acknowledgement is separate.
      orderReady: false,
      issues: { ...readiness.issues, order: ['PROJECT_REVIEW_REQUIRED' as const] },
    } };
    render(<Preview snapshot={eligible} locale="en" actorId="owner-a" />);
    const handoff = screen.getByRole('button', { name: 'Continue to Finalization' });
    expect(handoff).toBeDisabled();
    expect(screen.getByText('Review and confirm this saved revision before continuing.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'I reviewed saved revision 4' }));
    expect(handoff).toBeEnabled();
    expect(screen.getByText('This saved revision is eligible to continue. The next step will verify it again.')).toBeVisible();
    await user.click(handoff);
    expect(push).toHaveBeenCalledWith('/projects/project/finalize?reviewedProjectVersion=4');
  });

  it('builds the typed Finalization handoff with the exact reviewed revision', () => {
    expect(finalizationHandoffHref('project/with space', 7)).toBe('/projects/project%2Fwith%20space/finalize?reviewedProjectVersion=7');
    expect(() => finalizationHandoffHref('project-1', 0)).toThrow();
    expect(() => finalizationHandoffHref('', 7)).toThrow();
  });
});
