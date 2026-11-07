import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { IdentityProvider } from '../identity/provider';
import { ProjectWorkspace } from './project-workspace';
import { resetProjectWorkspaceDraftStore } from './workspace-draft';
import { useIdentity } from '../identity/provider';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
const templateId = '11111111-1111-4111-8111-111111111111';
const anotherTemplateId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const projectId = '33333333-3333-4333-8333-333333333333';
const template = { id: templateId, category: 'GENERAL', publishedRevision: {
  id: '22222222-2222-4222-8222-222222222222', version: 1, publishedAt: '2026-01-01T00:00:00.000Z',
  name: { vi: 'Ngày vui', en: 'Bright day' }, description: { vi: 'Mẫu lịch', en: 'A calendar design' },
  layout: { version: 1, type: 'PHOTO_FOCUS', monthCount: 12, maxImagesPerMonth: 4 }, presets: [
    { id: 'classic', name: { vi: 'Cổ điển', en: 'Classic' } }, { id: 'minimal', name: { vi: 'Tối giản', en: 'Minimal' } },
  ], price: { currency: 'USD', unitPriceMinor: 1500 },
} };
const anotherTemplate = { ...template, id: anotherTemplateId, publishedRevision: { ...template.publishedRevision, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', version: 2,
  presets: [{ id: 'minimal', name: { vi: 'Tối giản', en: 'Minimal' } }] } };
const created = { id: projectId, title: 'For Mom', year: 2026, recipientName: 'Mom', status: 'WORKING', version: 1, stylePresetId: 'classic',
  baseline: { name: { vi: 'Ngày vui', en: 'Bright day' }, layout: template.publishedRevision.layout }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function IdentityActions() {
  const { manager } = useIdentity();
  return <button onClick={() => void manager.authenticate('login', { email: 'owner-b@example.test', password: 'synthetic passphrase 2026' }, '')}>Log in as B</button>;
}
function CaptureManager({ capture }: { capture: (manager: ReturnType<typeof useIdentity>['manager']) => void }) {
  const { manager } = useIdentity(); capture(manager); return null;
}
function renderWorkspace(options: { actorId?: string; templateId?: string; actions?: boolean } = {}) {
  const actorId = options.actorId ?? '11111111-1111-4111-8111-111111111111'; const selectedTemplateId = options.templateId ?? templateId;
  let manager!: ReturnType<typeof useIdentity>['manager'];
  const view = render(<PreferencesProvider initial={{ locale: 'en', theme: 'light' }}>
    <IdentityProvider initial={{ phase: 'authenticated', principal: { id: actorId, email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' } }}>
      <ProjectWorkspace templateId={selectedTemplateId} /><CaptureManager capture={value => { manager = value; }} />{options.actions && <IdentityActions />}
    </IdentityProvider>
  </PreferencesProvider>);
  return { ...view, manager };
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});
afterEach(() => { vi.unstubAllGlobals(); push.mockClear(); resetProjectWorkspaceDraftStore(); });

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
    expect(screen.getByLabelText('Style (required)')).toHaveValue('');
    fireEvent.change(screen.getByLabelText(/Calendar name/), { target: { value: 'For Mom' } });
    fireEvent.change(screen.getByLabelText(/Made for/), { target: { value: 'Mom' } });
    fireEvent.change(screen.getByLabelText('Style (required)'), { target: { value: 'classic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create calendar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your calendar could not be created');
    expect(screen.getByLabelText(/Calendar name/)).toHaveValue('For Mom');
    fireEvent.click(screen.getByRole('button', { name: 'Retry previous request' }));
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
    expect(await screen.findByText('Ngày vui')).toBeVisible();
    expect(screen.getByLabelText(/Tên lịch/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Lịch của bạn' })).toBeVisible();
  });

  it('retries the exact original body and key after a committed create loses its response and the published presets change', async () => {
    const attempts: { key: string | null; body: unknown }[] = []; let currentTemplate = template; let committed = false;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/session')) return json({ data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'a'.repeat(64) } });
      if (url.endsWith(`/templates/${templateId}`)) return json({ data: currentTemplate });
      if (url.endsWith('/projects') && init?.method === 'GET') return json({ data: [], meta: { nextCursor: null, hasMore: false } });
      if (url.endsWith('/projects') && init?.method === 'POST') {
        attempts.push({ key: new Headers(init.headers).get('Idempotency-Key'), body: JSON.parse(String(init.body)) });
        if (!committed) { committed = true; throw new TypeError('response lost after commit'); }
        return json({ data: created }, 201);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const { manager } = renderWorkspace();
    expect(await screen.findByText('Bright day')).toBeVisible();
    fireEvent.change(screen.getByLabelText(/Calendar name/), { target: { value: 'For Mom' } });
    fireEvent.change(screen.getByLabelText(/Made for/), { target: { value: 'Mom' } });
    fireEvent.change(screen.getByLabelText('Style (required)'), { target: { value: 'classic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create calendar' }));
    expect(await screen.findByText(/An earlier request may already have created a calendar/u)).toBeVisible();
    currentTemplate = { ...template, publishedRevision: { ...template.publishedRevision, id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', version: 2,
      presets: [{ id: 'minimal', name: { vi: 'Tối giản', en: 'Minimal' } }] } };
    manager.queries.setQueryData(['templates', 'detail', templateId], currentTemplate);
    await waitFor(() => expect(screen.getByLabelText('Style (required)')).toHaveValue(''));
    fireEvent.click(screen.getByRole('button', { name: 'Retry previous request' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${projectId}`));
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
    expect(attempts[0].body).toEqual({ templateId, title: 'For Mom', year: new Date().getFullYear(), recipientName: 'Mom', stylePresetId: 'classic' });
    expect(committed).toBe(true);
  });

  it('retries a committed create with the original body and key after Template detail becomes unavailable', async () => {
    const attempts: { key: string | null; body: unknown }[] = [];
    let committedProject: typeof created | undefined;
    let templateDeactivated = false;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/session')) return json({ data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'a'.repeat(64) } });
      if (url.endsWith(`/templates/${templateId}`)) {
        if (templateDeactivated) return json({ error: { code: 'NOT_FOUND', retryable: false, fieldErrors: [] } }, 404);
        return json({ data: template });
      }
      if (url.endsWith('/projects') && init?.method === 'GET') return json({ data: [], meta: { nextCursor: null, hasMore: false } });
      if (url.endsWith('/projects') && init?.method === 'POST') {
        attempts.push({ key: new Headers(init.headers).get('Idempotency-Key'), body: JSON.parse(String(init.body)) });
        if (!committedProject) {
          committedProject = created;
          throw new TypeError('response lost after server commit');
        }
        return json({ data: committedProject }, 201);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const { manager } = renderWorkspace();
    expect(await screen.findByText('Bright day')).toBeVisible();
    fireEvent.change(screen.getByLabelText(/Calendar name/), { target: { value: 'For Mom' } });
    fireEvent.change(screen.getByLabelText(/Made for/), { target: { value: 'Mom' } });
    fireEvent.change(screen.getByLabelText('Style (required)'), { target: { value: 'classic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create calendar' }));
    expect(await screen.findByText(/An earlier request may already have created a calendar/u)).toBeVisible();
    const firstAttempt = attempts[0];
    expect(firstAttempt).toBeDefined();

    templateDeactivated = true;
    await manager.queries.invalidateQueries({ queryKey: ['templates', 'detail', templateId] });
    expect(await screen.findByText('This design is unavailable for new calendars.')).toBeVisible();
    const retry = screen.getByRole('button', { name: 'Retry previous request' });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${projectId}`));
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(firstAttempt);
    expect(attempts[1].body).toEqual({ templateId, title: 'For Mom', year: new Date().getFullYear(), recipientName: 'Mom', stylePresetId: 'classic' });
    expect(attempts[1].key).toBe(firstAttempt.key);
  });

  it('shows an idempotency conflict as a request conflict, not as an unavailable Template', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/session')) return json({ data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'a'.repeat(64) } });
      if (url.endsWith(`/templates/${templateId}`)) return json({ data: template });
      if (url.endsWith('/projects') && init?.method === 'GET') return json({ data: [], meta: { nextCursor: null, hasMore: false } });
      if (url.endsWith('/projects') && init?.method === 'POST') return json({ error: { code: 'IDEMPOTENCY_CONFLICT', retryable: false, fieldErrors: [] } }, 409);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher); renderWorkspace();
    expect(await screen.findByText('Bright day')).toBeVisible();
    fireEvent.change(screen.getByLabelText(/Calendar name/), { target: { value: 'For Mom' } });
    fireEvent.change(screen.getByLabelText(/Made for/), { target: { value: 'Mom' } });
    fireEvent.change(screen.getByLabelText('Style (required)'), { target: { value: 'classic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create calendar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The create request conflicts with an earlier request');
    expect(screen.queryByText(/This design is no longer available/u)).not.toBeInTheDocument();
  });

  it('requires explicit warning confirmation before replacing an unresolved create intent', async () => {
    const attempts: { key: string | null; body: unknown }[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/session')) return json({ data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'a'.repeat(64) } });
      if (url.endsWith(`/templates/${templateId}`)) return json({ data: template });
      if (url.endsWith('/projects') && init?.method === 'GET') return json({ data: [], meta: { nextCursor: null, hasMore: false } });
      if (url.endsWith('/projects') && init?.method === 'POST') {
        attempts.push({ key: new Headers(init.headers).get('Idempotency-Key'), body: JSON.parse(String(init.body)) });
        return attempts.length === 1 ? json({ error: { code: 'PROVIDER_UNAVAILABLE', retryable: true, fieldErrors: [] } }, 503) : json({ data: created }, 201);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher); renderWorkspace();
    expect(await screen.findByText('Bright day')).toBeVisible();
    fireEvent.change(screen.getByLabelText(/Calendar name/), { target: { value: 'For Mom' } });
    fireEvent.change(screen.getByLabelText(/Made for/), { target: { value: 'Mom' } });
    fireEvent.change(screen.getByLabelText('Style (required)'), { target: { value: 'classic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create calendar' }));
    expect(await screen.findByText(/An earlier request may already have created a calendar/u)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Start a new request' }));
    const dialog = screen.getByRole('dialog', { name: 'Start a new calendar request?' });
    expect(dialog).toHaveTextContent('Starting a new request can create an additional calendar');
    fireEvent.click(screen.getByRole('button', { name: 'Keep previous request' }));
    expect(screen.getByRole('button', { name: 'Retry previous request' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Start a new request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard old request' }));
    fireEvent.change(screen.getByLabelText(/Calendar name/), { target: { value: 'Another calendar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create calendar' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/projects/${projectId}`));
    expect(attempts).toHaveLength(2);
    expect(attempts[1].key).not.toBe(attempts[0].key);
    expect(attempts[1].body).not.toEqual(attempts[0].body);
  });

  it('keeps same-actor form data across a design change and requires a new preset choice when the old one is absent', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/auth/session')) return json({ data: { authenticated: true, principal: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.test', role: 'USER', accountStatus: 'ACTIVE' }, csrfToken: 'a'.repeat(64) } });
      if (url.endsWith(`/templates/${anotherTemplateId}`)) return json({ data: anotherTemplate });
      if (url.endsWith(`/templates/${templateId}`)) return json({ data: template });
      return json({ data: [], meta: { nextCursor: null, hasMore: false } });
    });
    vi.stubGlobal('fetch', fetcher);
    const first = renderWorkspace({ actorId: '11111111-1111-4111-8111-111111111111' });
    expect(await screen.findByText('Bright day')).toBeVisible();
    fireEvent.change(screen.getByLabelText(/Calendar name/), { target: { value: 'Saved draft' } });
    fireEvent.change(screen.getByLabelText(/Made for/), { target: { value: 'Linh' } });
    fireEvent.change(screen.getByLabelText('Style (required)'), { target: { value: 'classic' } });
    first.unmount();
    renderWorkspace({ actorId: '11111111-1111-4111-8111-111111111111', templateId: anotherTemplateId });
    expect(await screen.findByText('Bright day')).toBeVisible();
    expect(screen.getByLabelText(/Calendar name/)).toHaveValue('Saved draft');
    expect(screen.getByLabelText(/Made for/)).toHaveValue('Linh');
    expect(screen.getByLabelText('Style (required)')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Style (required)'), { target: { value: 'minimal' } });
    expect(screen.getByLabelText('Style (required)')).toHaveValue('minimal');
  });

  it('clears A draft, cursor pagination and unresolved intent across logout and login as B', async () => {
    const actorA = { id: '11111111-1111-4111-8111-111111111111', email: 'owner-a@example.test', role: 'USER', accountStatus: 'ACTIVE' };
    const actorB = { id: '22222222-2222-4222-8222-222222222222', email: 'owner-b@example.test', role: 'USER', accountStatus: 'ACTIVE' };
    let active: typeof actorA | typeof actorB | undefined = actorA;
    const listCalls: { actor: string; cursor: string | null }[] = [];
    const posts: { actor: string; key: string | null; body: unknown }[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input); const parsed = new URL(url, 'http://localhost');
      if (parsed.pathname.endsWith('/auth/session') && init?.method === 'GET') return json({ data: active
        ? { authenticated: true, principal: active, csrfToken: active.id === actorA.id ? 'a'.repeat(64) : 'b'.repeat(64) }
        : { authenticated: false } });
      if (parsed.pathname.endsWith('/auth/session') && init?.method === 'DELETE') { active = undefined; return new Response(null, { status: 204 }); }
      if (parsed.pathname.endsWith('/auth/login') && init?.method === 'POST') {
        active = actorB; return json({ data: { ...actorB, csrfToken: 'b'.repeat(64) } });
      }
      if (parsed.pathname.endsWith(`/templates/${templateId}`)) return json({ data: template });
      if (parsed.pathname.endsWith('/projects') && init?.method === 'GET') {
        const cursor = parsed.searchParams.get('cursor'); listCalls.push({ actor: active?.id ?? 'none', cursor });
        return json({ data: [], meta: active?.id === actorA.id && !cursor ? { nextCursor: 'cursor-a', hasMore: true } : { nextCursor: null, hasMore: false } });
      }
      if (parsed.pathname.endsWith('/projects') && init?.method === 'POST') {
        posts.push({ actor: active?.id ?? 'none', key: new Headers(init.headers).get('Idempotency-Key'), body: JSON.parse(String(init.body)) });
        if (active?.id === actorA.id) return json({ error: { code: 'PROVIDER_UNAVAILABLE', retryable: true, fieldErrors: [] } }, 503);
        return json({ data: { ...created, title: 'B calendar', recipientName: 'User B' } }, 201);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    renderWorkspace({ actorId: actorA.id, actions: true });
    expect(await screen.findByText('Bright day')).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Load more' })).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(listCalls).toContainEqual({ actor: actorA.id, cursor: 'cursor-a' }));
    fireEvent.change(screen.getByLabelText(/Calendar name/), { target: { value: 'A private draft' } });
    fireEvent.change(screen.getByLabelText(/Made for/), { target: { value: 'Recipient A' } });
    fireEvent.change(screen.getByLabelText('Style (required)'), { target: { value: 'classic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create calendar' }));
    expect(await screen.findByText(/An earlier request may already have created a calendar/u)).toBeVisible();
    const aIntent = posts[0];
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Log in' })).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Log in as B' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create your calendar' })).toBeVisible());
    expect(screen.getByLabelText(/Calendar name/)).toHaveValue('');
    expect(screen.getByLabelText(/Made for/)).toHaveValue('');
    await waitFor(() => expect(listCalls).toContainEqual({ actor: actorB.id, cursor: null }));
    expect(listCalls.some(call => call.actor === actorB.id && call.cursor === 'cursor-a')).toBe(false);
    fireEvent.change(screen.getByLabelText(/Calendar name/), { target: { value: 'B calendar' } });
    fireEvent.change(screen.getByLabelText(/Made for/), { target: { value: 'User B' } });
    fireEvent.change(screen.getByLabelText('Style (required)'), { target: { value: 'classic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create calendar' }));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1].actor).toBe(actorB.id);
    expect(posts[1].body).not.toEqual(aIntent.body);
    expect(posts[1].key).not.toBe(aIntent.key);
  });
});
