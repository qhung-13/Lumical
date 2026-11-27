import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { projectKeys, type ARRevision, type ProjectMonths, type SpecialDate } from '../../api/projects';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { studioCopy } from '../../i18n/studio';
import { arAuthoringCopy } from '../../i18n/ar-authoring';
import { IdentityProvider, useIdentity } from '../identity/provider';
import type { SessionManager } from '../identity/session-manager';
import { Studio } from './studio';

// The Studio guard navigates with the App Router; tests assert the push itself.
const routerPush = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush }) }));

const projectId = '33333333-3333-4333-8333-333333333333';
const ownerId = '11111111-1111-4111-8111-111111111111';
const mediaId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondMediaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const thirdMediaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const fourthMediaId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const imageIds = [mediaId, secondMediaId, thirdMediaId, fourthMediaId];
const savedProject = { id: projectId, title: 'Family calendar', year: 2027, recipientName: 'Grandma', status: 'WORKING', version: 3,
  stylePresetId: 'classic', baseline: { name: { vi: 'Mẫu gia đình', en: 'Family design' }, layout: { version: 1, type: 'COLLAGE', monthCount: 12, maxImagesPerMonth: 4 } },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', deletionEligible: true,
  stylePresets: [
    { id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } },
    { id: 'minimal', name: { vi: 'Tối giản', en: 'Minimal' } },
  ] };
const monthData = { projectVersion: 3, months: Array.from({ length: 12 }, (_, index) => ({ monthNumber: index + 1,
  caption: index === 2 ? 'Birthday memories' : null, images: index === 2 ? [{ assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', altText: 'Family photo', crop: null }] : [] })) };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

function renderStudio(options: { status?: 'WORKING' | 'ARCHIVED'; monthVersion?: number; locale?: 'en' | 'vi'; projectReadStatus?: 404 | 503;
  putStatus?: number; putStatusOnce?: boolean; mediaStatus?: 'READY' | 'PENDING' | 'UNAVAILABLE'; availableImages?: number;
  patchPlan?: 'conflictOnce' | 'errorOnce' | 'rejectAlways';
  specialEvents?: { id: string; date: string; title: string; note: string | null }[];
  specialDateWriteStatus?: number; specialDateWriteFields?: { path: string; code: string; messageKey: string }[];
  mismatchSpecialDatesAfterProjectWrite?: boolean; loseFirstSpecialDateResponse?: boolean;
  arConfig?: ARRevision['config']; loseFirstARResponse?: boolean } = {}) {
  const project = { ...savedProject, status: options.status ?? 'WORKING' };
  let currentVersion = 3;
  let currentMonths = { ...monthData, months: monthData.months.map(item => ({ ...item, images: [...item.images] })) };
  let currentSpecialEvents = (options.specialEvents ?? []).map(event => ({ ...event }));
  let lostCreateResponse = false;
  let servedStaleSpecialDates = false;
  let putAttempts = 0;
  let patchAttempts = 0;
  let queryClient: QueryClient;
  let identity: SessionManager;
  let session: 'owner' | 'unavailable' | 'signedOut' | 'unauthorized' | 'otherOwner' = 'owner';
  let sessionToken = 'c'.repeat(64);
  let beforeWrite: (() => void) | undefined;
  let failReviewReads = false;
  function CaptureQueries() { queryClient = useQueryClient(); identity = useIdentity().manager; return null; }
  // P07/T19: the reveal configuration is persisted like any other child write,
  // so a Project with no Special Dates can still carry one.
  let arConfig: ARRevision['config'] = options.arConfig ?? null;
  const arIntents = new Map<string, { data: object }>();
  let lostARResponse = false;
  if ((options.availableImages ?? 1) > 1) currentMonths.months[1] = { ...currentMonths.months[1], images: imageIds.slice(1, options.availableImages)
    .map((assetId, index) => ({ assetId, altText: `Photo ${index + 2}`, crop: null })) };
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.endsWith('/auth/session')) {
      if (method === 'DELETE') { session = 'signedOut'; return new Response(null, { status: 204 }); }
      if (session === 'unavailable') return json({ error: { code: 'PROVIDER_UNAVAILABLE' } }, 503);
      if (session === 'unauthorized') return json({ error: { code: 'UNAUTHENTICATED' } }, 401);
      if (session === 'signedOut') return json({ data: { authenticated: false } });
      return json({ data: { authenticated: true, principal: { id: session === 'otherOwner' ? '22222222-2222-4222-8222-222222222222' : ownerId,
        email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: sessionToken } });
    }
    if (options.projectReadStatus && url.endsWith(`/projects/${projectId}`)) {
      return json({ error: { code: options.projectReadStatus === 404 ? 'NOT_FOUND' : 'PROVIDER_UNAVAILABLE' } }, options.projectReadStatus);
    }
    if (session === 'otherOwner' && (url.includes(`/projects/${projectId}`) || url.includes('/media/'))) {
      return json({ error: { code: 'NOT_FOUND' } }, 404);
    }
    if (method !== 'GET' && beforeWrite) { const work = beforeWrite; beforeWrite = undefined; work(); }
    if (failReviewReads && method === 'GET' && [projectId, 'months', 'special-dates'].some(part => url.endsWith(`/${part}`))) {
      return json({ error: { code: 'PROVIDER_UNAVAILABLE' } }, 503);
    }
    if (url.endsWith(`/projects/${projectId}/ar/config`) && method === 'GET') return json({ data: { config: arConfig, projectVersion: currentVersion } });
    if (url.endsWith(`/projects/${projectId}/ar/preview`) && method === 'GET') return json({ data: { config: arConfig, projectVersion: currentVersion, target: null, reveal: null } });
    if (url.endsWith(`/projects/${projectId}/ar`) && method === 'PUT') {
      const key = new Headers(init?.headers).get('Idempotency-Key')!;
      const replay = arIntents.get(key);
      if (replay) return json(replay);
      if (new Headers(init?.headers).get('If-Match') !== `"${currentVersion}"`) {
        return json({ error: { code: 'VERSION_CONFLICT', currentVersion } }, 412);
      }
      const body = JSON.parse(String(init?.body)) as { monthNumber: number; revealAssetId: string; readableText: string };
      currentVersion += 1;
      project.version = currentVersion;
      arConfig = { ...body, status: 'PREPARING' };
      const result = { data: { ...arConfig, projectVersion: currentVersion } };
      arIntents.set(key, result);
      if (options.loseFirstARResponse && !lostARResponse) { lostARResponse = true; throw new TypeError('lost AR response after commit'); }
      return json(result);
    }
    if (url.endsWith(`/projects/${projectId}/ar`) && method === 'DELETE') {
      arConfig = null; currentVersion += 1; project.version = currentVersion;
      return new Response(null, { status: 204, headers: { ETag: `"${currentVersion}"` } });
    }
    if (/\/media\/[a-f0-9-]+$/.test(url) && imageIds.includes(url.split('/').at(-1)!)) {
      const assetId = url.split('/').at(-1)!;
      const status = options.mediaStatus ?? 'READY';
      return json({ data: { id: assetId, category: 'IMAGE', status, verifiedBytes: status === 'READY' ? 100 : null,
        ...(status === 'READY' ? { contentPath: `/api/v1/media/${assetId}/content` } : {}) } });
    }
    if (url.match(new RegExp(`/projects/${projectId}/months/\\d+$`)) && method === 'PUT') {
      putAttempts += 1;
      if (options.putStatus && (!options.putStatusOnce || putAttempts === 1)) {
        if (options.putStatus === 412) {
          // Concurrent owner editing: another session commits while this draft waits.
          currentVersion += 1;
          project.version = currentVersion;
          return json({ error: { code: 'VERSION_CONFLICT', currentVersion } }, 412);
        }
        return json({ error: { code: options.putStatus === 409 ? 'MEDIA_UNAVAILABLE' : 'VALIDATION_FAILED' } }, options.putStatus);
      }
      const number = Number(url.split('/').at(-1));
      if (new Headers(init?.headers).get('If-Match') !== `"${currentVersion}"`) {
        return json({ error: { code: 'VERSION_CONFLICT', currentVersion } }, 412);
      }
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
      if (new Headers(init?.headers).get('If-Match') !== `"${currentVersion}"`) {
        return json({ error: { code: 'VERSION_CONFLICT', currentVersion } }, 412);
      }
      if (!currentSpecialEvents.some(event => event.id === eventId)) return json({ error: { code: 'NOT_FOUND' } }, 404);
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
    if (url.endsWith(`/projects/${projectId}`) && method === 'PATCH') {
      patchAttempts += 1;
      // The real backend is conditional: a stale If-Match is a 412, never a silent overwrite.
      const ifMatch = new Headers(init?.headers).get('If-Match');
      if (ifMatch && ifMatch !== `"${currentVersion}"`) {
        return json({ error: { code: 'VERSION_CONFLICT', currentVersion } }, 412);
      }
      const body = JSON.parse(String(init?.body)) as { stylePresetId?: string };
      if (options.patchPlan === 'conflictOnce' && patchAttempts === 1) {
        // Concurrent owner editing: the other session committed version 4 first.
        currentVersion += 1;
        project.version = currentVersion;
        return json({ error: { code: 'VERSION_CONFLICT', currentVersion } }, 412);
      }
      if (options.patchPlan === 'rejectAlways') return json({ error: { code: 'VALIDATION_FAILED',
        fieldErrors: [{ path: 'stylePresetId', code: 'VALIDATION_FAILED', messageKey: 'errors.validationFailed' }] } }, 422);
      if (options.patchPlan === 'errorOnce' && patchAttempts === 1) return json({ error: { code: 'PROVIDER_UNAVAILABLE', retryable: true } }, 503);
      currentVersion += 1;
      project.version = currentVersion;
      if (body.stylePresetId) project.stylePresetId = body.stylePresetId;
      return json({ data: { ...project } });
    }
    if (url.endsWith(`/projects/${projectId}`)) return json({ data: project });
    return json({ error: { code: 'NOT_FOUND' } }, 404);
  });
  vi.stubGlobal('fetch', fetcher);
  const tree = <PreferencesProvider initial={{ locale: options.locale ?? 'en', theme: 'light' }}>
    <IdentityProvider initial={{ phase: 'authenticated', principal: { id: ownerId, email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' } }}>
      <CaptureQueries />
      <Studio id={projectId} />
    </IdentityProvider>
  </PreferencesProvider>;
  const view = render(tree);
  // P07/AC1: a reopen is a brand-new Studio tree (fresh query cache) whose
  // only source of truth is the same server answer the mock still holds.
  return { ...view, fetcher, remount: () => render(tree),
    remote: (change: { month?: ProjectMonths['months'][number]; events?: SpecialDate[]; style?: string; status?: 'WORKING' | 'ARCHIVED' }) => {
      currentVersion += 1; project.version = currentVersion;
      if (change.month) currentMonths.months = currentMonths.months.map(month => month.monthNumber === change.month!.monthNumber ? change.month! : month);
      if (change.events) currentSpecialEvents = change.events.map(event => ({ ...event, note: event.note ?? null }));
      if (change.style) project.stylePresetId = change.style;
      if (change.status) project.status = change.status;
    },
    refresh: () => act(async () => { await queryClient.invalidateQueries({ queryKey: projectKeys.all(ownerId) }); }),
    beforeNextWrite: (work: () => void) => { beforeWrite = work; },
    failReads: (fail: boolean) => { failReviewReads = fail; },
    session: (value: typeof session) => { session = value; },
    verifySession: () => act(async () => { await identity.bootstrap(); }),
    logout: () => act(async () => { await identity.logout(); }),
    privateQueries: () => queryClient.getQueryCache().getAll().filter(query => query.queryKey[0] === 'private'),
    replaceSession: () => { sessionToken = 'd'.repeat(64); },
  };
}

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  routerPush.mockClear();
});

describe('Batch 3 unavailable accessibility', () => {
  it.each([
    ['en', 404], ['vi', 404], ['en', 503], ['vi', 503],
  ] as const)('F06 renders a safe localized page heading for %s / %s', async (locale, projectReadStatus) => {
    renderStudio({ locale, projectReadStatus });
    const heading = await screen.findByRole('heading', { level: 1, name: studioCopy[locale].title }, { timeout: 4000 });
    expect(heading).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText(projectReadStatus === 404 ? studioCopy[locale].notFound : studioCopy[locale].error)).toBeVisible();
    expect(screen.queryByText(savedProject.title)).not.toBeInTheDocument();
    expect(screen.queryByText('Birthday memories')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: studioCopy[locale].retry })).toBeEnabled();
  });
});

describe('Batch 2 draft preservation', () => {
  const savedAR = { monthNumber: 1, revealAssetId: mediaId, readableText: 'Saved AR message', status: 'PREPARING' as const };
  const unloadWarns = () => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; };
  it('F04 protects an AR-only text draft on Back and beforeunload, then preserves it on Stay', async () => {
    renderStudio();
    const text = await screen.findByLabelText('Meaningful image message');
    fireEvent.change(text, { target: { value: 'AR-only private draft' } });
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: /Back to calendar/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Leave with unsaved changes?' });
    expect(routerPush).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stay and keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(text).toHaveValue('AR-only private draft');
  });

  it('F01 preserves a Month draft after temporary session verification failure and same-owner recovery', async () => {
    const view = renderStudio();
    fireEvent.change(await screen.findByLabelText(/Month message/), { target: { value: 'Keep during session outage' } });
    view.session('unavailable'); await view.verifySession();
    view.session('owner'); await view.verifySession();
    expect(await screen.findByLabelText(/Month message/)).toHaveValue('Keep during session outage');
  });

  it.each(['month', 'media', 'text'] as const)('guards an AR-only %s change and clears the warning after reverting', async field => {
    renderStudio({ arConfig: savedAR, availableImages: 2 });
    await screen.findByDisplayValue('Saved AR message');
    const control = screen.getByLabelText(field === 'month' ? 'Reveal Month' : field === 'media' ? 'Ready reveal media' : 'Meaningful image message');
    fireEvent.change(control, { target: { value: field === 'month' ? '2' : field === 'media' ? secondMediaId : 'Local readable text' } });
    expect(unloadWarns()).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: /Back to calendar/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Leave with unsaved changes?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stay and keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.change(control, { target: { value: field === 'month' ? '1' : field === 'media' ? mediaId : savedAR.readableText } });
    expect(unloadWarns()).toBe(false);
    expect(screen.queryByText('Unsaved AR draft')).not.toBeInTheDocument();
  });

  it('navigates only after explicit Leave for a Vietnamese AR-only draft', async () => {
    renderStudio({ locale: 'vi' });
    fireEvent.change(await screen.findByLabelText(arAuthoringCopy.vi.text.IMAGE), { target: { value: 'Bản nháp AR chưa lưu' } });
    fireEvent.click(screen.getByRole('link', { name: /Quay lại lịch/ }));
    const dialog = await screen.findByRole('dialog', { name: studioCopy.vi.unsavedNav.title });
    expect(routerPush).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: studioCopy.vi.unsavedNav.leave }));
    expect(routerPush).toHaveBeenCalledExactlyOnceWith(`/projects/${projectId}`);
  });

  it('protects an uncertain AR intent even without a local edit, retaining its exact key/body/version through Stay and session recovery', async () => {
    const view = renderStudio({ arConfig: savedAR, loseFirstARResponse: true });
    const panel = await screen.findByRole('region', { name: 'AR reveal' });
    const save = within(panel).getByRole('button', { name: 'Save AR reveal' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await within(panel).findByText(/Your draft is preserved/);
    expect(unloadWarns()).toBe(true);
    // Refetch can already show the committed result; the unresolved original intent still needs protection.
    fireEvent.click(within(panel).getByRole('button', { name: 'Reload AR configuration' }));
    await screen.findByText('Loaded saved version 4');
    fireEvent.click(screen.getByRole('link', { name: /Back to calendar/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Leave with unsaved changes?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stay and keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    view.session('unavailable'); await view.verifySession();
    view.session('owner'); await view.verifySession();
    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Save AR reveal' })).toBeEnabled());
    expect(unloadWarns()).toBe(true);
    fireEvent.click(save);
    await within(panel).findByText('AR configuration saved.');
    const writes = view.fetcher.mock.calls.filter(([url, init]) => String(url).endsWith('/ar') && init?.method === 'PUT');
    expect(writes).toHaveLength(2);
    expect(writes[0][1]?.body).toBe(writes[1][1]?.body);
    expect(writes.map(([, init]) => new Headers(init?.headers).get('If-Match'))).toEqual(['"3"', '"3"']);
    expect(new Headers(writes[0][1]?.headers).get('Idempotency-Key')).toBe(new Headers(writes[1][1]?.headers).get('Idempotency-Key'));
    expect(unloadWarns()).toBe(false);
  });

  it('clears AR dirty state after successful save or intentional configuration removal', async () => {
    renderStudio({ arConfig: savedAR });
    const text = await screen.findByLabelText('Meaningful image message');
    fireEvent.change(text, { target: { value: 'Saved after editing' } });
    expect(unloadWarns()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    await screen.findByText('AR configuration saved.');
    await screen.findByText('Loaded saved version 4');
    expect(unloadWarns()).toBe(false);
    fireEvent.change(text, { target: { value: 'Discarded by intentional removal' } });
    expect(unloadWarns()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove current AR reveal' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove current AR reveal' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove configuration' }));
    await screen.findByText('Current AR configuration removed.');
    await screen.findByText('Loaded saved version 5');
    expect(unloadWarns()).toBe(false);
  });

  it('retains every editor in memory, hides private content, blocks mutations, and recovers through Retry for the same session', async () => {
    const view = renderStudio();
    const january = await screen.findByLabelText(/Month message/);
    fireEvent.change(january, { target: { value: 'Private January draft' } });
    fireEvent.click(screen.getByRole('tab', { name: 'February' }));
    fireEvent.change(january, { target: { value: 'Private February draft' } });
    const style = screen.getByLabelText('Style preset');
    fireEvent.change(style, { target: { value: 'minimal' } });
    const dates = await screen.findByRole('region', { name: 'Special Dates' });
    fireEvent.change(within(dates).getByLabelText('Date'), { target: { value: '2027-02-01' } });
    fireEvent.change(within(dates).getByLabelText('Title'), { target: { value: 'Private event draft' } });
    fireEvent.change(within(dates).getByLabelText(/Note/), { target: { value: 'Private event note' } });
    const ar = await screen.findByRole('region', { name: 'AR reveal' });
    fireEvent.change(within(ar).getByLabelText('Reveal Month'), { target: { value: '2' } });
    fireEvent.change(within(ar).getByLabelText('Ready reveal media'), { target: { value: mediaId } });
    fireEvent.change(within(ar).getByLabelText('Meaningful image message'), { target: { value: 'Private AR draft' } });
    const saves = ['Save month', 'Save style', 'Save Special Date', 'Save AR reveal'].map(name => screen.getByRole('button', { name }));
    view.session('unavailable'); await view.verifySession();
    expect(january.isConnected).toBe(true);
    expect(january.closest('[hidden]')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: 'Family calendar' })).not.toBeInTheDocument();
    for (const save of saves) { expect(save).toBeDisabled(); fireEvent.click(save); }
    fireEvent.submit(within(dates).getByLabelText('Title').closest('form')!);
    fireEvent.submit(within(ar).getByLabelText('Meaningful image message').closest('form')!);
    expect(view.fetcher.mock.calls.filter(([, init]) => ['PUT', 'PATCH', 'POST'].includes(init?.method ?? 'GET'))).toHaveLength(0);
    view.session('owner');
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { name: 'Family calendar' });
    expect(january).toHaveValue('Private February draft');
    expect(style).toHaveValue('minimal');
    expect(within(dates).getByLabelText('Title')).toHaveValue('Private event draft');
    expect(within(dates).getByLabelText(/Note/)).toHaveValue('Private event note');
    expect(within(ar).getByLabelText('Reveal Month')).toHaveValue('2');
    expect(within(ar).getByLabelText('Ready reveal media')).toHaveValue(mediaId);
    expect(within(ar).getByLabelText('Meaningful image message')).toHaveValue('Private AR draft');
    fireEvent.click(screen.getByRole('tab', { name: 'January' }));
    expect(january).toHaveValue('Private January draft');
    expect(unloadWarns()).toBe(true);
  });

  it('disposes private drafts on confirmed logout, including a later login by the same actor', async () => {
    const view = renderStudio();
    const caption = await screen.findByLabelText(/Month message/);
    fireEvent.change(caption, { target: { value: 'Never restore after logout' } });
    fireEvent.change(await screen.findByLabelText('Meaningful image message'), { target: { value: 'Private old AR text' } });
    await view.logout();
    expect(caption.isConnected).toBe(false);
    expect(screen.queryByDisplayValue('Private old AR text')).not.toBeInTheDocument();
    expect(view.privateQueries().filter(query => query.queryKey[1] === ownerId && query.state.data !== undefined)).toHaveLength(0);
    view.session('owner'); await view.verifySession();
    expect(await screen.findByLabelText(/Month message/)).toHaveValue('');
    expect(await screen.findByLabelText('Meaningful image message')).toHaveValue('');
    expect(unloadWarns()).toBe(false);
  });

  it.each(['signedOut', 'unauthorized'] as const)('clears drafts when verification confirms session revocation/disable (%s)', async session => {
    const view = renderStudio();
    const caption = await screen.findByLabelText(/Month message/);
    fireEvent.change(caption, { target: { value: 'Private revoked-session draft' } });
    view.session(session); await view.verifySession();
    expect(caption.isConnected).toBe(false);
    expect(view.privateQueries().filter(query => query.queryKey[1] === ownerId && query.state.data !== undefined)).toHaveLength(0);
    view.session('owner'); await view.verifySession();
    expect(await screen.findByLabelText(/Month message/)).toHaveValue('');
  });

  it('never restores another owner\'s drafts after an account switch during an outage', async () => {
    const view = renderStudio();
    fireEvent.change(await screen.findByLabelText(/Month message/), { target: { value: 'Owner A only draft' } });
    fireEvent.change(await screen.findByLabelText('Meaningful image message'), { target: { value: 'Owner A AR draft' } });
    view.session('unavailable'); await view.verifySession();
    view.session('otherOwner'); await view.verifySession();
    await screen.findByText('This calendar is unavailable.');
    expect(screen.queryByDisplayValue('Owner A only draft')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Owner A AR draft')).not.toBeInTheDocument();
    expect(screen.queryByText('Family calendar')).not.toBeInTheDocument();
    expect(view.privateQueries().filter(query => query.queryKey[1] === ownerId && query.state.data !== undefined)).toHaveLength(0);
  });

  it('respects Identity\'s new-session epoch even if the actor ID stays the same', async () => {
    const view = renderStudio();
    const caption = await screen.findByLabelText(/Month message/);
    fireEvent.change(caption, { target: { value: 'Old session draft' } });
    view.replaceSession(); await view.verifySession();
    expect(caption.isConnected).toBe(false);
    expect(await screen.findByLabelText(/Month message/)).toHaveValue('');
  });

  it('retains pinned Month content and required conflict review through a verification outage', async () => {
    const view = renderStudio();
    fireEvent.change(await screen.findByLabelText(/Month message/), { target: { value: 'Keep pinned conflict draft' } });
    view.remote({ month: { monthNumber: 1, caption: 'Current saved Month', images: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    let dialog = await screen.findByRole('dialog', { name: studioCopy.en.conflictReview.title });
    await within(dialog).findByText('Current saved Month');
    view.session('unavailable'); await view.verifySession();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.session('owner'); await view.verifySession();
    dialog = await screen.findByRole('dialog', { name: studioCopy.en.conflictReview.title });
    await within(dialog).findByText('Current saved Month');
    expect(screen.getByLabelText(/Month message/)).toHaveValue('Keep pinned conflict draft');
    expect(screen.getByRole('button', { name: 'Save month' })).toBeDisabled();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(dialog).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    await screen.findByText('Month saved.');
    const writes = view.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(writes.map(([, init]) => new Headers(init?.headers).get('If-Match'))).toEqual(['"3"', '"4"']);
  });
});

describe('Batch 1 concurrency recovery', () => {
  const reviewName = 'Review the refreshed calendar before saving again';
  const event = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', date: '2027-02-01', title: 'Original event', note: 'Original note' };

  it('F02 reviews a Month draft against real saved content after a refetch, before using a newer version', async () => {
    const view = renderStudio();
    fireEvent.change(await screen.findByLabelText(/Month message/), { target: { value: 'Local January draft' } });
    view.remote({ month: { monthNumber: 1, caption: 'Remote January caption', images: [] } });
    await view.refresh();
    await screen.findByText('Loaded saved version 4');
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    const dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText('Remote January caption');
    expect(screen.getByLabelText(/Month message/)).toHaveValue('Local January draft');
    expect(view.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    await screen.findByText('Month saved.');
    const writes = view.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(writes).toHaveLength(1);
    expect(new Headers(writes[0][1]?.headers).get('If-Match')).toBe('"4"');
  });

  it('F07 keeps the original caption as a pinned draft when persisted Month content changed after refetch', async () => {
    const view = renderStudio();
    const original = 'Birthday memories'; // A: persisted March caption at v3.
    fireEvent.click(await screen.findByRole('tab', { name: 'March' }));
    const caption = screen.getByLabelText(/Month message/);
    expect(caption).toHaveValue(original);
    expect(screen.getByText('Loaded saved version 3')).toBeVisible();
    fireEvent.change(caption, { target: { value: 'B: local draft' } });
    view.remote({ month: { monthNumber: 3, caption: 'C: concurrent server update', images: monthData.months[2].images } });
    await view.refresh();
    await screen.findByText('Loaded saved version 4');
    expect(caption).toHaveValue('B: local draft');

    fireEvent.change(caption, { target: { value: original } });
    expect(caption).toHaveValue(original);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    const dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText('C: concurrent server update');
    expect(caption).toHaveValue(original);
    const writes = () => view.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(writes()).toHaveLength(0); // The v3 pin must require review of v4 first.
    fireEvent.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    await screen.findByText('Month saved.');
    expect(writes()).toHaveLength(1);
    expect(new Headers(writes()[0][1]?.headers).get('If-Match')).toBe('"4"');
    expect(JSON.parse(String(writes()[0][1]?.body)).caption).toBe(original);
  });

  it('F03 preserves an existing event edit and requires review after a refetch', async () => {
    const view = renderStudio({ specialEvents: [event] });
    const editor = await screen.findByRole('region', { name: 'Special Dates' });
    await waitFor(() => expect(within(editor).getByRole('button', { name: 'Edit' })).toBeEnabled());
    fireEvent.click(within(editor).getByRole('button', { name: 'Edit' }));
    fireEvent.change(within(editor).getByLabelText('Title'), { target: { value: 'Local event draft' } });
    view.remote({ events: [{ ...event, title: 'Remote event title', note: 'Remote note' }] });
    await view.refresh();
    await screen.findByText('Loaded saved version 4');
    await within(editor).findByRole('heading', { name: 'Remote event title' });
    fireEvent.click(within(editor).getByRole('button', { name: 'Save changes' }));
    const dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText('Remote event title');
    expect(dialog).toHaveTextContent('Remote note');
    expect(within(editor).getByLabelText('Title')).toHaveValue('Local event draft');
    expect(view.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')).toEqual([]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(within(editor).getByRole('button', { name: 'Save changes' }));
    await within(editor).findByText('Special Date updated.');
    const writes = view.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(writes).toHaveLength(1);
    expect(new Headers(writes[0][1]?.headers).get('If-Match')).toBe('"4"');
  });

  it('F05 shows refreshed Month caption and ordered image metadata inside the 412 review', async () => {
    const view = renderStudio();
    fireEvent.change(await screen.findByLabelText(/Month message/), { target: { value: 'Keep this local draft' } });
    view.remote({ month: { monthNumber: 1, caption: 'Persisted remote caption', images: [
      { assetId: secondMediaId, altText: 'Remote second photo first', crop: null },
      { assetId: mediaId, altText: 'Remote family photo last', crop: null },
    ] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    const dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText('Persisted remote caption');
    expect(dialog).toHaveTextContent(secondMediaId);
    expect(dialog).toHaveTextContent('Remote second photo first');
    expect(dialog).toHaveTextContent('Remote family photo last');
    expect(screen.getByLabelText(/Month message/)).toHaveValue('Keep this local draft');
    expect(screen.getByRole('button', { name: 'Save month' })).toBeDisabled();
  });

  it('keeps two Month drafts and image metadata pinned independently across refresh and separate reviews', async () => {
    const view = renderStudio({ availableImages: 3 });
    fireEvent.change(await screen.findByLabelText(/Month message/), { target: { value: 'January local' } });
    fireEvent.click(screen.getByRole('tab', { name: 'March' }));
    fireEvent.change(screen.getByLabelText(/Month message/), { target: { value: 'March local' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use a Ready image 1' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Use a Ready image 1' }));
    fireEvent.change(screen.getByLabelText('Alternative text for image 1'), { target: { value: 'Local family alt' } });
    fireEvent.change(screen.getByLabelText('Alternative text for image 2'), { target: { value: 'Local second alt' } });
    fireEvent.click(screen.getByRole('button', { name: /Move up — Move image 2 earlier/ }));
    view.remote({ month: { monthNumber: 1, caption: 'January remote', images: [] } });
    await view.refresh();
    await screen.findByText('Loaded saved version 4');
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    let dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText('Birthday memories');
    expect(screen.getByLabelText(/Month message/)).toHaveValue('March local');
    expect(screen.getByLabelText('Alternative text for image 1')).toHaveValue('Local second alt');
    fireEvent.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    await screen.findByText('Month saved.');
    await screen.findByText('Loaded saved version 5');
    const writes = () => view.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(writes()[0][1]?.body))).toEqual({ caption: 'March local', images: [
      { assetId: secondMediaId, altText: 'Local second alt', crop: null },
      { assetId: mediaId, altText: 'Local family alt', crop: null },
    ] });
    fireEvent.click(screen.getByRole('tab', { name: 'January' }));
    expect(screen.getByLabelText(/Month message/)).toHaveValue('January local');
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText('January remote');
    expect(writes()).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    await screen.findByText('Month saved.');
    expect(writes().map(([, init]) => new Headers(init?.headers).get('If-Match'))).toEqual(['"4"', '"5"']);
  });

  it('starts a fresh Month version pin after reverting or successfully saving a draft', async () => {
    const view = renderStudio();
    const caption = await screen.findByLabelText(/Month message/);
    fireEvent.change(caption, { target: { value: 'Reverted local draft' } });
    fireEvent.change(caption, { target: { value: '' } });
    view.remote({ month: { monthNumber: 1, caption: 'New server baseline', images: [] } });
    await view.refresh();
    await waitFor(() => expect(caption).toHaveValue('New server baseline'));
    fireEvent.change(caption, { target: { value: 'Fresh draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    await screen.findByText('Month saved.');
    await screen.findByText('Loaded saved version 5');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.remote({ month: { monthNumber: 1, caption: 'Another server baseline', images: [] } });
    await view.refresh();
    await waitFor(() => expect(caption).toHaveValue('Another server baseline'));
    fireEvent.change(caption, { target: { value: 'Fresh draft after save' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    await screen.findByText('Loaded saved version 7');
    const writes = view.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(writes.map(([, init]) => new Headers(init?.headers).get('If-Match'))).toEqual(['"4"', '"6"']);
  });

  it('requires real current-event review after server 412 and retries the unchanged draft with the reviewed version', async () => {
    const view = renderStudio({ specialEvents: [event] });
    const editor = await screen.findByRole('region', { name: 'Special Dates' });
    await waitFor(() => expect(within(editor).getByRole('button', { name: 'Edit' })).toBeEnabled());
    fireEvent.click(within(editor).getByRole('button', { name: 'Edit' }));
    fireEvent.change(within(editor).getByLabelText('Date'), { target: { value: '2027-03-02' } });
    fireEvent.change(within(editor).getByLabelText('Title'), { target: { value: 'Local title' } });
    fireEvent.change(within(editor).getByLabelText(/Note/), { target: { value: 'Local note' } });
    view.beforeNextWrite(() => view.remote({ events: [{ ...event, title: 'Remote title', date: '2027-04-03', note: 'Remote note' }] }));
    fireEvent.click(within(editor).getByRole('button', { name: 'Save changes' }));
    const dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText('Remote title');
    expect(dialog).toHaveTextContent('2027-04-03');
    expect(dialog).toHaveTextContent('Remote note');
    expect(within(editor).getByLabelText('Date')).toHaveValue('2027-03-02');
    expect(within(editor).getByLabelText('Title')).toHaveValue('Local title');
    expect(within(editor).getByLabelText(/Note/)).toHaveValue('Local note');
    expect(within(editor).getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(dialog).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(within(editor).getByRole('button', { name: 'Save changes' }));
    await within(editor).findByText('Special Date updated.');
    const writes = view.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(writes.map(([, init]) => new Headers(init?.headers).get('If-Match'))).toEqual(['"3"', '"4"']);
    expect(writes[0][1]?.body).toBe(writes[1][1]?.body);
  });

  it.each(['refetch', '412'] as const)('keeps a remotely deleted event draft without recreating it (%s)', async path => {
    const view = renderStudio({ specialEvents: [event] });
    const editor = await screen.findByRole('region', { name: 'Special Dates' });
    await waitFor(() => expect(within(editor).getByRole('button', { name: 'Edit' })).toBeEnabled());
    fireEvent.click(within(editor).getByRole('button', { name: 'Edit' }));
    fireEvent.change(within(editor).getByLabelText('Title'), { target: { value: 'Keep removed event draft' } });
    if (path === 'refetch') {
      view.remote({ events: [] }); await view.refresh();
      await within(editor).findByText(/This Special Date was removed elsewhere/);
      expect(within(editor).getByRole('button', { name: 'Save changes' })).toBeDisabled();
      fireEvent.click(within(editor).getByRole('button', { name: 'Review current saved content' }));
    } else {
      view.beforeNextWrite(() => view.remote({ events: [] }));
      fireEvent.click(within(editor).getByRole('button', { name: 'Save changes' }));
    }
    const dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText(/This Special Date has been removed from the saved calendar/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(editor).getByLabelText('Title')).toHaveValue('Keep removed event draft');
    expect(within(editor).getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.submit(within(editor).getByLabelText('Title').closest('form')!);
    expect(view.fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    expect(view.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(path === '412' ? 1 : 0);
    fireEvent.click(within(editor).getByRole('button', { name: 'Cancel edit' }));
    expect(within(editor).getByLabelText('Title')).toHaveValue('');
  });

  it.each(['failed request', 'mixed versions'] as const)('cannot acknowledge an unsuccessful refresh (%s)', async failure => {
    const options: Parameters<typeof renderStudio>[0] = failure === 'mixed versions' ? { monthVersion: 3 } : {};
    const view = renderStudio(options);
    fireEvent.change(await screen.findByLabelText(/Month message/), { target: { value: 'Draft kept through failed review' } });
    view.remote({ month: { monthNumber: 1, caption: 'Current caption after retry', images: [] } });
    if (failure === 'failed request') view.failReads(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    const dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText(/Could not refresh a consistent saved version/);
    const acknowledge = within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' });
    expect(acknowledge).toBeDisabled();
    expect(within(dialog).queryByText(/The server is now on saved version/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Month message/)).toHaveValue('Draft kept through failed review');
    fireEvent(dialog, new Event('cancel', { cancelable: true })); fireEvent.click(dialog);
    expect(dialog).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save month' })).toBeDisabled();
    view.failReads(false); options.monthVersion = 4;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    await within(dialog).findByText('Current caption after retry');
    expect(acknowledge).toBeEnabled();
  });

  it('acknowledges only the displayed snapshot version even if another refresh arrives during review', async () => {
    const view = renderStudio();
    fireEvent.change(await screen.findByLabelText(/Month message/), { target: { value: 'Local pinned draft' } });
    view.remote({ month: { monthNumber: 1, caption: 'Review version four', images: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    let dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText('Review version four');
    view.remote({ month: { monthNumber: 1, caption: 'New version five', images: [] } });
    await view.refresh(); await screen.findByText('Loaded saved version 5');
    fireEvent.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText('New version five');
    expect(view.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  });

  it('shows the current saved Style inside Vietnamese review without changing the local selection', async () => {
    const view = renderStudio({ locale: 'vi' });
    fireEvent.change(await screen.findByLabelText('Phong cách'), { target: { value: 'minimal' } });
    view.remote({});
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phong cách' }));
    const dialog = await screen.findByRole('dialog', { name: studioCopy.vi.conflictReview.title });
    await within(dialog).findByRole('region', { name: 'Nội dung hiện đang lưu' });
    expect(dialog).toHaveTextContent('Cổ điển (classic)');
    expect(screen.getByLabelText('Phong cách')).toHaveValue('minimal');
    expect(screen.getByRole('button', { name: 'Lưu phong cách' })).toBeDisabled();
  });

  it('does not rebind an unrelated Style draft when a Month review is acknowledged', async () => {
    const view = renderStudio();
    fireEvent.change(await screen.findByLabelText('Style preset'), { target: { value: 'minimal' } });
    fireEvent.change(screen.getByLabelText(/Month message/), { target: { value: 'Month draft' } });
    view.remote({ month: { monthNumber: 1, caption: 'Remote Month', images: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    let dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText('Remote Month');
    fireEvent.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save style' }));
    dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText('Classic (classic)');
    const patches = view.fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(patches).toHaveLength(1);
    expect(new Headers(patches[0][1]?.headers).get('If-Match')).toBe('"3"');
    expect(screen.getByLabelText('Style preset')).toHaveValue('minimal');
  });

  it('keeps mutations disabled after a conflict refresh discovers the Project was archived', async () => {
    const view = renderStudio();
    fireEvent.change(await screen.findByLabelText(/Month message/), { target: { value: 'Kept archived draft' } });
    view.remote({ status: 'ARCHIVED' });
    fireEvent.click(screen.getByRole('button', { name: 'Save month' }));
    const dialog = await screen.findByRole('dialog', { name: reviewName });
    await within(dialog).findByText(studioCopy.en.archived);
    fireEvent.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save style' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Special Date' })).toBeDisabled();
    expect(screen.getByLabelText(/Month message/)).toHaveValue('Kept archived draft');
  });
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
      if (url.endsWith(`/projects/${projectId}/ar/config`)) return json({ data: { config: null, projectVersion: 3 } });
      if (url.endsWith(`/projects/${projectId}/ar/preview`)) return json({ data: { config: null, projectVersion: 3, target: null, reveal: null } });
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

  it('keeps every one of the twelve edited Months after the Studio is reopened (P07 AC1)', async () => {
    // 12 conditional saves and 12 reopen checks take about 10s in jsdom.
    // Keep the extra budget on this integration scenario, not the whole suite.
    const user = userEvent.setup();
    const view = renderStudio();
    const tabs = await screen.findByRole('tablist', { name: 'Choose a month' });
    for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
      await user.click(within(tabs).getByRole('tab', { name: studioCopy.en.monthNames[monthNumber - 1] }));
      fireEvent.change(screen.getByLabelText(/Month message/), { target: { value: `P07 note ${monthNumber}` } });
      await user.click(screen.getByRole('button', { name: 'Save month' }));
      expect(await screen.findByText('Month saved.')).toBeVisible();
    }
    // Reopen: a new Studio tree over a new query cache, so only the mock
    // server's twelve persisted Months can answer for the content.
    view.unmount();
    view.remount();
    const reopened = await screen.findByRole('tablist', { name: 'Choose a month' });
    expect(within(reopened).getAllByRole('tab')).toHaveLength(12);
    for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
      await user.click(within(reopened).getByRole('tab', { name: studioCopy.en.monthNames[monthNumber - 1] }));
      expect(screen.getByLabelText(/Month message/)).toHaveValue(`P07 note ${monthNumber}`);
      // The calendar preview itself, not just the editor field, carries it.
      const paper = screen.getByRole('article', { name: /Calendar preview/ });
      expect(within(paper).getByText(`P07 note ${monthNumber}`)).toBeVisible();
    }
  }, 15_000);

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

  it('personalizes a Month, its style and an AR reveal with zero Special Dates and never asks for one (P07 AC2/T19)', async () => {
    const user = userEvent.setup();
    const { fetcher } = renderStudio({ specialEvents: [] });
    expect(await screen.findByText('No Special Dates yet. This calendar is valid without any.')).toBeVisible();
    await user.type(screen.getByLabelText(/Month message/), 'No dated events needed');
    await user.click(screen.getByRole('button', { name: 'Save month' }));
    expect(await screen.findByText('Month saved.')).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Style preset'), 'minimal');
    await user.click(screen.getByRole('button', { name: 'Save style' }));
    expect(await screen.findByText('Style saved.')).toBeVisible();
    // The image-message reveal is a child write of its own: it needs no dated event.
    fireEvent.change(screen.getByLabelText('Ready reveal media'), { target: { value: mediaId } });
    fireEvent.change(screen.getByLabelText('Meaningful image message'), { target: { value: 'A story with no dates' } });
    // The style save advanced the Project version; the AR read moves with it.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save AR reveal' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save AR reveal' }));
    expect(await screen.findByText('AR configuration saved.')).toBeVisible();
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith(`/projects/${projectId}/ar`))).toBe(true);
    // Optional means optional: nothing anywhere complains that the list is empty.
    expect(fetcher.mock.calls.some(([url, init]) => String(url).includes('/special-dates') && init?.method === 'POST')).toBe(false);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

describe('P06 curated style, conflict review and the leave guard', () => {
  it('offers exactly the captured preset list with no free-form entry (AC1)', async () => {
    renderStudio({ locale: 'vi' });
    const select = await screen.findByLabelText('Phong cách');
    const options = within(select).getAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual(['Cổ điển', 'Tối giản']);
    expect(options.map(option => (option as HTMLOptionElement).value)).toEqual(['classic', 'minimal']);
    expect(screen.queryByRole('textbox', { name: 'Phong cách' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu phong cách' })).toBeDisabled();
  });

  it('keeps the style choice after a recoverable failure and retries the same conditional write (AC2)', async () => {
    const user = userEvent.setup();
    const { fetcher } = renderStudio({ patchPlan: 'errorOnce' });
    const select = await screen.findByLabelText('Style preset');
    await user.selectOptions(select, 'minimal');
    expect(screen.getByText('Unsaved style choice')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save style' }));
    expect(await screen.findByText('Could not save the style. Your choice is still here; you can retry.')).toBeVisible();
    expect(screen.getByLabelText('Style preset')).toHaveValue('minimal');
    expect(screen.getByRole('button', { name: 'Save style' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save style' }));
    expect(await screen.findByText('Style saved.')).toBeVisible();
    const patches = fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(patches).toHaveLength(2);
    expect(patches.map(([, init]) => new Headers(init?.headers).get('If-Match'))).toEqual(['"3"', '"3"']);
    expect(String(patches[0][1]?.body)).toBe(String(patches[1][1]?.body));
  });

  it('rejects a preset outside the captured baseline while keeping the selection (AC1/AC2 422)', async () => {
    const user = userEvent.setup();
    renderStudio({ patchPlan: 'rejectAlways' });
    await user.selectOptions(await screen.findByLabelText('Style preset'), 'minimal');
    await user.click(screen.getByRole('button', { name: 'Save style' }));
    expect(await screen.findByText('This preset is not part of the captured baseline. Choose one of the offered presets.')).toBeVisible();
    expect(screen.getByLabelText('Style preset')).toHaveValue('minimal');
    expect(screen.getByRole('button', { name: 'Save style' })).toBeEnabled();
  });

  it('requires current-content review after a concurrent owner commit, then retries with the server version (AC3)', async () => {
    const user = userEvent.setup();
    renderStudio({ patchPlan: 'conflictOnce' });
    await user.selectOptions(await screen.findByLabelText('Style preset'), 'minimal');
    await user.click(screen.getByRole('button', { name: 'Save style' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review the refreshed calendar before saving again' });
    await waitFor(() => expect(dialog).toHaveTextContent('The server is now on saved version 4; you loaded an older one.'));
    expect(dialog).toHaveTextContent('Your draft was kept and was never written over the saved content.');
    // The refresh really happened: both queries now serve the concurrent version.
    expect(await screen.findByText('Loaded saved version 4')).toBeVisible();
    // Saving stays blocked until the review is acknowledged; the draft survives.
    expect(screen.getByRole('button', { name: 'Save style' })).toBeDisabled();
    expect(screen.getByLabelText('Style preset')).toHaveValue('minimal');
    await user.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save style' })).toBeEnabled();
    expect(screen.getByLabelText('Style preset')).toHaveValue('minimal');
    await user.click(screen.getByRole('button', { name: 'Save style' }));
    expect(await screen.findByText('Style saved.')).toBeVisible();
    expect(await screen.findByText('Loaded saved version 5')).toBeVisible();
  });

  it('holds month saving until the 412 review is acknowledged and keeps the caption draft (AC3 month)', async () => {
    const user = userEvent.setup();
    renderStudio({ putStatus: 412, putStatusOnce: true });
    await user.click(await screen.findByRole('tab', { name: 'March' }));
    await user.clear(screen.getByLabelText(/Month message/));
    await user.type(screen.getByLabelText(/Month message/), 'Keep reviewing me');
    await user.click(screen.getByRole('button', { name: 'Save month' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review the refreshed calendar before saving again' });
    await waitFor(() => expect(dialog).toHaveTextContent('The server is now on saved version 4'));
    expect(await screen.findByText('Loaded saved version 4')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save month' })).toBeDisabled();
    expect(screen.getByLabelText(/Month message/)).toHaveValue('Keep reviewing me');
    await user.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save month' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save month' }));
    expect(await screen.findByText('Month saved.')).toBeVisible();
    expect(await screen.findByText('Loaded saved version 5')).toBeVisible();
  });

  it('blocks leaving the Studio, keeps the draft on Stay and navigates on Leave (G5)', async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.type(await screen.findByLabelText(/Month message/), 'Unsaved note');
    const back = screen.getByRole('link', { name: /Back to calendar/ });
    await user.click(back);
    const dialog = await screen.findByRole('dialog', { name: 'Leave with unsaved changes?' });
    expect(routerPush).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Stay and keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Month message/)).toHaveValue('Unsaved note');
    await user.click(back);
    await user.click(await screen.findByRole('button', { name: 'Leave anyway' }));
    expect(routerPush).toHaveBeenCalledWith(`/projects/${projectId}`);
  });

  it('treats an unsaved style choice as content leaving must confirm (G5 source: style)', async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.selectOptions(await screen.findByLabelText('Style preset'), 'minimal');
    await user.click(screen.getByRole('link', { name: /Back to calendar/ }));
    expect(await screen.findByRole('dialog', { name: 'Leave with unsaved changes?' })).toBeVisible();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('treats typed Special Date input as content leaving must confirm (G5 source: special dates)', async () => {
    const user = userEvent.setup();
    renderStudio();
    const editor = await screen.findByRole('region', { name: 'Special Dates' });
    await user.type(within(editor).getByLabelText('Title'), 'Guard this input');
    await user.click(screen.getByRole('link', { name: /Back to calendar/ }));
    expect(await screen.findByRole('dialog', { name: 'Leave with unsaved changes?' })).toBeVisible();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('requires Escape-proof review: cancelling the 412 dialog must not unlock saving', async () => {
    const user = userEvent.setup();
    renderStudio({ patchPlan: 'conflictOnce' });
    await user.selectOptions(await screen.findByLabelText('Style preset'), 'minimal');
    await user.click(screen.getByRole('button', { name: 'Save style' }));
    const name = 'Review the refreshed calendar before saving again';
    const dialog = await screen.findByRole('dialog', { name });
    // Escape reaches the dialog as a cancel event; a non-dismissible review ignores it.
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog', { name })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save style' })).toBeDisabled();
    expect(screen.getByLabelText('Style preset')).toHaveValue('minimal');
    // Only the explicit acknowledgment may release the lock.
    await within(dialog).findByRole('region', { name: 'Current saved content' });
    await user.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save style' })).toBeEnabled();
  });

  it('pins the style draft to the version it started on and only adopts the refreshed one after review (G4)', async () => {
    const user = userEvent.setup();
    const { fetcher } = renderStudio();
    // The draft starts while the Project is still on saved version 3.
    await user.selectOptions(await screen.findByLabelText('Style preset'), 'minimal');
    // A concurrent commit advances the server to version 4 before Save is pressed.
    await user.type(screen.getByLabelText(/Month message/), 'Advance the version');
    await user.click(screen.getByRole('button', { name: 'Save month' }));
    expect(await screen.findByText('Month saved.')).toBeVisible();
    expect(await screen.findByText('Loaded saved version 4')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Save style' }));
    const patches = () => fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    // The conditional write still targets the pinned version 3, so the server can refuse it.
    expect(new Headers(patches()[0][1]?.headers).get('If-Match')).toBe('"3"');
    const dialog = await screen.findByRole('dialog', { name: 'Review the refreshed calendar before saving again' });
    await waitFor(() => expect(dialog).toHaveTextContent('The server is now on saved version 4'));
    expect(screen.getByRole('button', { name: 'Save style' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'I have reviewed — allow saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // After the review the draft adopts the refreshed version and retries.
    await user.click(screen.getByRole('button', { name: 'Save style' }));
    expect(await screen.findByText('Style saved.')).toBeVisible();
    expect(patches()).toHaveLength(2);
    expect(new Headers(patches()[1][1]?.headers).get('If-Match')).toBe('"4"');
  });

  it('asks before leaving when a non-selected Month still holds a draft (G5 across months)', async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.type(await screen.findByLabelText(/Month message/), 'January draft');
    await user.click(screen.getByRole('tab', { name: 'February' }));
    // February itself is untouched, yet January's draft still needs confirming.
    expect(screen.getByRole('button', { name: 'Save month' })).toBeDisabled();
    await user.click(screen.getByRole('link', { name: /Back to calendar/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Leave with unsaved changes?' });
    expect(routerPush).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Stay and keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The January draft survives the round trip.
    await user.click(screen.getByRole('tab', { name: 'January' }));
    expect(screen.getByLabelText(/Month message/)).toHaveValue('January draft');
  });

  it('warns before unload only while something is unsaved (G5 beforeunload)', async () => {
    const user = userEvent.setup();
    renderStudio();
    await screen.findByRole('button', { name: 'Save month' });
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    await user.type(screen.getByLabelText(/Month message/), 'Edited');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
