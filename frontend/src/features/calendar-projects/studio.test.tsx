import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { IdentityProvider } from '../identity/provider';
import { Studio } from './studio';

const projectId = '33333333-3333-4333-8333-333333333333';
const ownerId = '11111111-1111-4111-8111-111111111111';
const mediaId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondMediaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const thirdMediaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const fourthMediaId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const imageIds = [mediaId, secondMediaId, thirdMediaId, fourthMediaId];
const savedProject = { id: projectId, title: 'Family calendar', year: 2027, recipientName: 'Grandma', status: 'WORKING', version: 3,
  stylePresetId: 'classic', baseline: { name: { vi: 'Mẫu gia đình', en: 'Family design' }, layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 } },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', deletionEligible: true };
const monthData = { projectVersion: 3, months: Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1,
  caption: index === 2 ? 'Birthday memories' : null, images: index === 2 ? [{ assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', altText: 'Family photo', crop: null }] : [] })) };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

function renderStudio(options: { status?: 'WORKING' | 'ARCHIVED'; monthVersion?: number; locale?: 'en' | 'vi';
  putStatus?: number; mediaStatus?: 'READY' | 'PENDING' | 'UNAVAILABLE'; availableImages?: number;
  specialEvents?: { id: string; date: string; title: string; note: string | null }[];
  specialDateWriteStatus?: number; specialDateWriteFields?: { path: string; code: string; messageKey: string }[];
  mismatchSpecialDatesAfterProjectWrite?: boolean; loseFirstSpecialDateResponse?: boolean } = {}) {
  const project = { ...savedProject, status: options.status ?? 'WORKING' };
  let currentVersion = 3;
  let currentMonths = { ...monthData, months: monthData.months.map(item => ({ ...item, images: [...item.images] })) };
  let currentSpecialEvents = (options.specialEvents ?? []).map(event => ({ ...event }));
  let lostCreateResponse = false;
  let servedStaleSpecialDates = false;
  if ((options.availableImages ?? 1) > 1) currentMonths.months[1] = { ...currentMonths.months[1], images: imageIds.slice(1, options.availableImages)
    .map((assetId, index) => ({ assetId, altText: `Photo ${index + 2}`, crop: null })) };
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.endsWith(`/projects/${projectId}/ar`) && method === 'GET') return json({ data: { config: null, projectVersion: currentVersion } });
    if (url.endsWith('/auth/session')) return json({ data: { authenticated: true,
      principal: { id: ownerId, email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } });
    if (/\/media\/[a-f0-9-]+$/.test(url) && imageIds.includes(url.split('/').at(-1)!)) {
      const assetId = url.split('/').at(-1)!;
      const status = options.mediaStatus ?? 'READY';
      return json({ data: { id: assetId, category: 'IMAGE', status, verifiedBytes: status === 'READY' ? 100 : null,
        ...(status === 'READY' ? { contentPath: `/api/v1/media/${assetId}/content` } : {}) } });
    }
    if (url.match(new RegExp(`/projects/${projectId}/months/\\d+$`)) && method === 'PUT') {
      if (options.putStatus) return json({ error: { code: options.putStatus === 412 ? 'VERSION_CONFLICT' : options.putStatus === 409 ? 'MEDIA_UNAVAILABLE' : 'VALIDATION_FAILED' } }, options.putStatus);
      const number = Number(url.split('/').at(-1));
      const body = JSON.parse(String(init?.body)) as { caption: string | null; images: typeof monthData.months[number]['images'] };
      currentVersion += 1;
      project.version = currentVersion;
      currentMonths = { projectVersion: currentVersion, months: currentMonths.months.map(item => item.monthNumber === number
        ? { monthNumber: number, caption: body.caption, images: body.images } : item) };
      return json({ data: { monthNumber: number, caption: body.caption, images: body.images, projectVersion: currentVersion } });
    }
    if (url.endsWith(`/projects/${projectId}/special-dates`) && method === 'GET') {
      if (options.mismatchSpecialDatesAfterProjectWrite && currentVersion > 3 && !servedStaleSpecialDates) {
        servedStaleSpecialDates = true;
        return json({ data: { events: currentSpecialEvents, projectVersion: currentVersion - 1 } });
      }
      return json({ data: { events: currentSpecialEvents, projectVersion: currentVersion } });
    }
    if (url.endsWith(`/projects/${projectId}/special-dates`) && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { date: string; title: string; note: string | null };
      if (options.specialDateWriteStatus) return json({ error: {
        code: options.specialDateWriteStatus === 412 ? 'VERSION_CONFLICT' : options.specialDateWriteStatus === 409 ? 'IDEMPOTENCY_CONFLICT' : 'VALIDATION_FAILED',
        fieldErrors: options.specialDateWriteFields ?? [],
      } }, options.specialDateWriteStatus);
      const key = new Headers(init?.headers).get('Idempotency-Key')!;
      const cached = (fetcher as typeof fetch & { createdByKey?: Map<string, { event: typeof currentSpecialEvents[number]; version: number }> }).createdByKey ??= new Map();
      let outcome = cached.get(key);
      if (!outcome) {
        currentVersion += 1;
        project.version = currentVersion;
        const event = { id: `eeeeeeee-eeee-4eee-8eee-${String(currentSpecialEvents.length + 1).padStart(12, '0')}`, ...body };
        currentSpecialEvents = [...currentSpecialEvents, event];
        outcome = { event, version: currentVersion };
        cached.set(key, outcome);
      }
      if (options.loseFirstSpecialDateResponse && !lostCreateResponse) { lostCreateResponse = true; throw new TypeError('connection lost after server commit'); }
      return json({ data: { ...outcome.event, projectVersion: outcome.version } }, 201);
    }
    if (url.match(new RegExp(`/projects/${projectId}/special-dates/[a-f0-9-]+$`)) && method === 'PUT') {
      const eventId = url.split('/').at(-1)!;
      const body = JSON.parse(String(init?.body)) as { date: string; title: string; note: string | null };
      if (options.specialDateWriteStatus) return json({ error: {
        code: options.specialDateWriteStatus === 412 ? 'VERSION_CONFLICT' : options.specialDateWriteStatus === 409 ? 'IDEMPOTENCY_CONFLICT' : 'VALIDATION_FAILED',
        fieldErrors: options.specialDateWriteFields ?? [],
      } }, options.specialDateWriteStatus);
      currentVersion += 1;
      project.version = currentVersion;
      currentSpecialEvents = currentSpecialEvents.map(event => event.id === eventId ? { ...event, ...body } : event);
      return json({ data: { ...currentSpecialEvents.find(event => event.id === eventId)!, projectVersion: currentVersion } });
    }
    if (url.match(new RegExp(`/projects/${projectId}/special-dates/[a-f0-9-]+$`)) && method === 'DELETE') {
      if (options.specialDateWriteStatus) return json({ error: {
        code: options.specialDateWriteStatus === 412 ? 'VERSION_CONFLICT' : options.specialDateWriteStatus === 409 ? 'IDEMPOTENCY_CONFLICT' : 'VALIDATION_FAILED',
        fieldErrors: options.specialDateWriteFields ?? [],
      } }, options.specialDateWriteStatus);
      currentVersion += 1;
      project.version = currentVersion;
      currentSpecialEvents = currentSpecialEvents.filter(event => event.id !== url.split('/').at(-1));
      return new Response(null, { status: 204, headers: { ETag: `"${currentVersion}"` } });
    }
    if (url.endsWith(`/projects/${projectId}/months`)) return json({ data: { ...currentMonths, projectVersion: options.monthVersion ?? currentVersion } });
    if (url.endsWith(`/projects/${projectId}`)) return json({ data: project });
    return json({ error: { code: 'NOT_FOUND' } }, 404);
  });
  vi.stubGlobal('fetch', fetcher);
  const view = render(<PreferencesProvider initial={{ locale: options.locale ?? 'en', theme: 'light' }}>
    <IdentityProvider initial={{ phase: 'authenticated', principal: { id: ownerId, email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' } }}>
      <Studio id={projectId} />
    </IdentityProvider>
  </PreferencesProvider>);
  return { ...view, fetcher };
}

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});

describe('guided Studio shell', () => {
  it('offers all twelve months and moves selection and focus by keyboard without changing saved content', async () => {
    renderStudio();
    const user = userEvent.setup();
    const tabs = await screen.findByRole('tablist', { name: 'Choose a month' });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(12);
    expect(screen.getByText('Loaded saved version 3')).toHaveAttribute('role', 'status');

    const january = within(tabs).getByRole('tab', { name: 'January' });
    january.focus();
    await user.keyboard('{ArrowRight}');
    const february = within(tabs).getByRole('tab', { name: 'February' });
    expect(february).toHaveFocus();
    expect(february).toHaveAttribute('aria-selected', 'true');

    await user.click(within(tabs).getByRole('tab', { name: 'March' }));
    expect(screen.getByRole('heading', { name: 'March 2027' })).toBeVisible();
    expect(screen.getAllByText('Birthday memories')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: '1 selected image / 4' })).toBeVisible();
    expect(screen.getByText('Loaded saved version 3')).toHaveAttribute('role', 'status');
  });

  it('shows archived Projects as read-only while keeping saved Months reviewable', async () => {
    renderStudio({ status: 'ARCHIVED' });
    expect(await screen.findByText('This calendar is archived. You can review its saved months, but editing is unavailable.')).toBeVisible();
    expect(screen.getByRole('tablist', { name: 'Choose a month' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save month' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Upload file' })).not.toBeInTheDocument();
  });

  it('warns when Project and Month reads refer to different persisted versions', async () => {
    renderStudio({ monthVersion: 4 });
    expect(await screen.findByRole('alert')).toHaveTextContent('The Project and Month data are from different saved versions.');
    expect(screen.getAllByText('The Project and Month data are from different saved versions.')
      .some(element => element.getAttribute('role') === 'alert')).toBe(true);
  });

  it('shows a version loading status without a mismatch warning until Months have loaded', async () => {
    const pendingMonths = Promise.withResolvers<Response>();
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith(`/projects/${projectId}/ar`)) return json({ data: { config: null, projectVersion: 3 } });
      if (url.endsWith('/auth/session')) return json({ data: { authenticated: true,
        principal: { id: ownerId, email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'c'.repeat(64) } });
      if (url.endsWith(`/projects/${projectId}/special-dates`)) return json({ data: { events: [], projectVersion: 3 } });
      if (url.endsWith(`/projects/${projectId}/months`)) return pendingMonths.promise;
      if (url.endsWith(`/projects/${projectId}`)) return json({ data: savedProject });
      return json({ error: { code: 'NOT_FOUND' } }, 404);
    }));
    render(<PreferencesProvider initial={{ locale: 'en', theme: 'light' }}>
      <IdentityProvider initial={{ phase: 'authenticated', principal: { id: ownerId, email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' } }}>
        <Studio id={projectId} />
      </IdentityProvider>
    </PreferencesProvider>);

    expect(await screen.findByRole('heading', { name: 'Family calendar' })).toBeVisible();
    expect(screen.getByText('Checking saved Month versions…')).toHaveAttribute('role', 'status');
    expect(screen.getByText('Loading your Studio…')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await act(async () => { pendingMonths.resolve(json({ data: monthData })); });
    await waitFor(() => expect(screen.getByText('Loaded saved version 3')).toBeVisible());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders Vietnamese month names and archived state copy', async () => {
    renderStudio({ locale: 'vi', status: 'ARCHIVED' });
    const tabs = await screen.findByRole('tablist', { name: 'Chọn tháng' });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(12);
    expect(within(tabs).getByRole('tab', { name: 'Tháng 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Lịch đã được lưu trữ. Bạn có thể xem lại các tháng đã lưu nhưng không thể chỉnh sửa.')).toBeVisible();
  });

  it('reuses an existing Ready image from another Month, preserves alt text and saves only the approved ordered payload', async () => {
    const user = userEvent.setup();
    const { fetcher } = renderStudio();
    await user.click(await screen.findByRole('button', { name: 'Use a Ready image 1' }));
    const altText = screen.getByLabelText('Alternative text for image 1');
    await user.type(altText, 'Grandma at the garden');
    await user.click(screen.getByRole('button', { name: 'Save month' }));
    expect(await screen.findByText('Month saved.')).toBeVisible();
    const put = fetcher.mock.calls.find(([url, init]) => String(url).endsWith('/months/1') && init?.method === 'PUT');
    expect(put?.[1]).toMatchObject({ headers: expect.objectContaining({ 'If-Match': '"3"' }) });
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ caption: null, images: [{ assetId: mediaId, altText: 'Grandma at the garden', crop: null }] });
    await user.click(screen.getByRole('tab', { name: 'March' }));
    expect(await screen.findByRole('heading', { name: '1 selected image / 4' })).toBeVisible();
  });

  it('saves an emptied Month with null caption and zero images', async () => {
    const user = userEvent.setup();
    const { fetcher } = renderStudio();
    await user.click(await screen.findByRole('tab', { name: 'March' }));
    await user.clear(screen.getByLabelText(/Month message/));
    await user.click(screen.getByRole('button', { name: /Remove image 1/ }));
    await user.click(screen.getByRole('button', { name: 'Save month' }));
    expect(await screen.findByText('Month saved.')).toBeVisible();
    const put = fetcher.mock.calls.find(([url, init]) => String(url).endsWith('/months/3') && init?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ caption: null, images: [] });
  });

  it('counts caption grapheme clusters and blocks a value over 300', async () => {
    renderStudio();
    const caption = await screen.findByLabelText(/Month message/);
    fireEvent.change(caption, { target: { value: '👨‍👩‍👧‍👦'.repeat(300) } });
    expect(screen.getByText('300/300 characters')).toBeVisible();
    fireEvent.change(caption, { target: { value: '👨‍👩‍👧‍👦'.repeat(301) } });
    expect(screen.getByText('301/300 characters · Shorten the message to 300 visible characters or fewer.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save month' })).toBeDisabled();
  });

  it('allows four images and preserves deliberate ordering when saving', async () => {
    const user = userEvent.setup();
    const { fetcher } = renderStudio({ availableImages: 4 });
    await screen.findByRole('heading', { name: 'Edit this month' });
    const firstCandidate = async () => (await screen.findAllByRole('button', { name: /Use a Ready image/ }))[0];
    for (let index = 0; index < 4; index++) await user.click(await firstCandidate());
    expect(screen.getByRole('heading', { name: '4 selected images / 4' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: /saved images/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Use a Ready image/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Move image 1 later/ }));
    await user.click(screen.getByRole('button', { name: 'Save month' }));
    expect(await screen.findByText('Month saved.')).toBeVisible();
    const put = fetcher.mock.calls.find(([url, init]) => String(url).endsWith('/months/1') && init?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body)).images.map((image: { assetId: string }) => image.assetId))
      .toEqual([thirdMediaId, secondMediaId, fourthMediaId, mediaId]);
  });

  it('retains the draft after a stale Project version rejection', async () => {
    const user = userEvent.setup();
    const { fetcher } = renderStudio({ putStatus: 412 });
    await user.click(await screen.findByRole('tab', { name: 'March' }));
    await user.clear(screen.getByLabelText(/Month message/));
    await user.type(screen.getByLabelText(/Month message/), 'Keep this draft after conflict');
    await user.click(screen.getByRole('button', { name: 'Save month' }));
    expect(await screen.findByText(/This Project changed elsewhere/)).toBeVisible();
    expect(screen.getByLabelText(/Month message/)).toHaveValue('Keep this draft after conflict');
    expect(fetcher.mock.calls.some(([url, init]) => String(url).endsWith('/months/3') && init?.method === 'PUT')).toBe(true);
  });

  it('marks a saved non-Ready image unavailable and lets the owner remove it', async () => {
    const user = userEvent.setup();
    renderStudio({ mediaStatus: 'UNAVAILABLE' });
    await user.click(await screen.findByRole('tab', { name: 'March' }));
    expect((await screen.findAllByText('Unavailable')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Remove image 1/ }));
    expect(screen.getByRole('button', { name: 'Save month' })).toBeEnabled();
  });

  it('keeps the caption draft after backend rejects a media reference', async () => {
    const user = userEvent.setup();
    renderStudio({ putStatus: 409 });
    await user.type(await screen.findByLabelText(/Month message/), 'A retained recovery note');
    await user.click(screen.getByRole('button', { name: 'Save month' }));
    expect(await screen.findByText(/One or more images are not available/)).toBeVisible();
    expect(screen.getByLabelText(/Month message/)).toHaveValue('A retained recovery note');
  });

  it('supports an empty list, validates civil dates, and creates two distinct events on the same day', async () => {
    const user = userEvent.setup();
    const { fetcher } = renderStudio();
    expect(await screen.findByText('No Special Dates yet. This calendar is valid without any.')).toBeVisible();
    await user.type(screen.getByLabelText('Date'), '2027-02-29');
    await user.type(screen.getByLabelText('Title'), 'Grandma birthday');
    await user.click(screen.getByRole('button', { name: 'Save Special Date' }));
    expect(await screen.findByText('Enter a real Gregorian date.')).toBeVisible();
    expect(fetcher.mock.calls.some(([url, init]) => String(url).endsWith('/special-dates') && init?.method === 'POST')).toBe(false);

    await user.clear(screen.getByLabelText('Date'));
    await user.type(screen.getByLabelText('Date'), '2027-02-28');
    await user.click(screen.getByRole('button', { name: 'Save Special Date' }));
    expect(await screen.findByText('Special Date added.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Grandma birthday' })).toBeVisible();

    await user.type(screen.getByLabelText('Date'), '2027-02-28');
    await user.type(screen.getByLabelText('Title'), 'Family celebration');
    await user.click(screen.getByRole('button', { name: 'Save Special Date' }));
    expect(await screen.findByRole('heading', { name: 'Family celebration' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Your dates (2)' })).toBeVisible();
    expect(fetcher.mock.calls.filter(([url, init]) => String(url).endsWith('/special-dates') && init?.method === 'POST')).toHaveLength(2);
  });

  it('edits and confirms deletion of an event without leaving the Studio', async () => {
    const user = userEvent.setup();
    renderStudio({ specialEvents: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', date: '2027-05-06', title: 'School day', note: 'Bring flowers' }] });
    const event = await screen.findByRole('heading', { name: 'School day' });
    const article = event.closest('article')!;
    await user.click(within(article).getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Date')).toHaveValue('2027-05-06');
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Graduation day');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('heading', { name: 'Graduation day' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'School day' })).not.toBeInTheDocument();

    const editedArticle = screen.getByRole('heading', { name: 'Graduation day' }).closest('article')!;
    await user.click(within(editedArticle).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('dialog', { name: 'Delete this Special Date?' })).toBeVisible();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete date' }));
    expect(await screen.findByText('Special Date deleted from this calendar.')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Graduation day' })).not.toBeInTheDocument();
  });

  it('keeps the exact create intent after a lost response and retries with its original body, key and Project version', async () => {
    const user = userEvent.setup();
    const { fetcher } = renderStudio({ loseFirstSpecialDateResponse: true });
    await screen.findByRole('heading', { name: 'Special Dates' });
    await user.type(screen.getByLabelText('Date'), '2027-08-09');
    await user.type(screen.getByLabelText('Title'), 'First day of school');
    await user.type(screen.getByLabelText(/Note/), 'A saved memory');
    await user.click(screen.getByRole('button', { name: 'Save Special Date' }));
    expect(await screen.findByText(/We could not confirm whether this date was added/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry the same request' }));
    expect(await screen.findByText('Special Date added.')).toBeVisible();

    const posts = fetcher.mock.calls.filter(([url, init]) => String(url).endsWith('/special-dates') && init?.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[1][1]?.body).toBe(posts[0][1]?.body);
    expect(new Headers(posts[1][1]?.headers).get('Idempotency-Key')).toBe(new Headers(posts[0][1]?.headers).get('Idempotency-Key'));
    expect(new Headers(posts[1][1]?.headers).get('If-Match')).toBe(new Headers(posts[0][1]?.headers).get('If-Match'));
    expect(screen.getByRole('heading', { name: 'First day of school' })).toBeVisible();
  });

  it('preserves form values on stale-version rejection and keeps archived dates read-only', async () => {
    const user = userEvent.setup();
    const firstView = renderStudio({ specialDateWriteStatus: 412 });
    await screen.findByRole('heading', { name: 'Special Dates' });
    await user.type(screen.getByLabelText('Date'), '2027-10-10');
    await user.type(screen.getByLabelText('Title'), 'Keep this event draft');
    await user.click(screen.getByRole('button', { name: 'Save Special Date' }));
    expect(await screen.findByText(/The calendar changed elsewhere/)).toBeVisible();
    expect(screen.getByLabelText('Date')).toHaveValue('2027-10-10');
    expect(screen.getByLabelText('Title')).toHaveValue('Keep this event draft');

    firstView.unmount();
    renderStudio({ status: 'ARCHIVED' });
    await screen.findByRole('heading', { name: 'Special Dates' });
    expect(screen.getByRole('button', { name: 'Save Special Date' })).toBeDisabled();
    expect(screen.getByLabelText('Date')).toBeDisabled();
  });

  it('shows a conflict message for an idempotency 409 and does not suggest that the date was unavailable', async () => {
    const user = userEvent.setup();
    renderStudio({ specialDateWriteStatus: 409 });
    await screen.findByRole('heading', { name: 'Special Dates' });
    await user.type(screen.getByLabelText('Date'), '2027-11-11');
    await user.type(screen.getByLabelText('Title'), 'Conflict check');
    await user.click(screen.getByRole('button', { name: 'Save Special Date' }));
    expect(await screen.findByText(/The server rejected this change because the saved calendar state changed/)).toBeVisible();
    expect(screen.getByLabelText('Title')).toHaveValue('Conflict check');
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
  });

  it('refreshes Project and Special Dates together after a 3-to-4 mismatch without losing the form draft', async () => {
    const user = userEvent.setup();
    const { fetcher } = renderStudio({ mismatchSpecialDatesAfterProjectWrite: true });
    const specialDates = await screen.findByRole('region', { name: 'Special Dates' });
    await user.type(within(specialDates).getByLabelText('Date'), '2027-09-18');
    await user.type(within(specialDates).getByLabelText('Title'), 'Keep this draft during refresh');

    await user.type(screen.getByLabelText(/Month message/), 'Advance the Project version');
    await user.click(screen.getByRole('button', { name: 'Save month' }));
    expect(await screen.findByText('Month saved.')).toBeVisible();
    expect(await within(specialDates).findByText(/Saved Project and Special Date data have different versions/)).toBeVisible();
    expect(screen.getByText('Loaded saved version 4')).toBeVisible();

    await user.click(within(specialDates).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(within(specialDates).getByLabelText('Date')).toBeEnabled());
    expect(within(specialDates).getByLabelText('Date')).toHaveValue('2027-09-18');
    expect(within(specialDates).getByLabelText('Title')).toHaveValue('Keep this draft during refresh');
    await user.click(within(specialDates).getByRole('button', { name: 'Save Special Date' }));
    expect(await within(specialDates).findByText('Special Date added.')).toBeVisible();
    const create = fetcher.mock.calls.find(([url, init]) => String(url).endsWith('/special-dates') && init?.method === 'POST');
    expect(new Headers(create?.[1]?.headers).get('If-Match')).toBe('"4"');
  });

  it('maps recognized backend 422 field errors and uses a generic message when no field can be identified', async () => {
    const user = userEvent.setup();
    const recognized = renderStudio({ specialDateWriteStatus: 422,
      specialDateWriteFields: [{ path: 'event.title', code: 'OUT_OF_RANGE', messageKey: 'validation.specialDateTitle' }] });
    const firstEditor = await screen.findByRole('region', { name: 'Special Dates' });
    await user.type(within(firstEditor).getByLabelText('Date'), '2027-05-14');
    await user.type(within(firstEditor).getByLabelText('Title'), 'Backend rejects this value');
    await user.click(within(firstEditor).getByRole('button', { name: 'Save Special Date' }));
    expect(await within(firstEditor).findByText('The server rejected this value. Review it and try again.')).toBeVisible();
    expect(within(firstEditor).getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(within(firstEditor).getByLabelText('Date')).toHaveAttribute('aria-invalid', 'false');
    expect(within(firstEditor).getByLabelText('Title')).toHaveValue('Backend rejects this value');

    recognized.unmount();
    renderStudio({ specialDateWriteStatus: 422 });
    const secondEditor = await screen.findByRole('region', { name: 'Special Dates' });
    await user.type(within(secondEditor).getByLabelText('Date'), '2027-05-14');
    await user.type(within(secondEditor).getByLabelText('Title'), 'No field detail');
    await user.click(within(secondEditor).getByRole('button', { name: 'Save Special Date' }));
    expect(await within(secondEditor).findByText('The server could not accept this date request. Review the form and try again.')).toBeVisible();
    expect(within(secondEditor).getByLabelText('Title')).toHaveAttribute('aria-invalid', 'false');
    expect(within(secondEditor).getByLabelText('Date')).toHaveAttribute('aria-invalid', 'false');
  });
});
