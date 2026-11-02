import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminTemplateData } from '../../api/admin-templates';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { TemplateListScreen } from './template-list-screen';
import { TemplateDetailScreen } from './template-detail-screen';

// JSDOM has no top-layer modality (same shims as dialog.test.tsx).
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});

const identity = vi.hoisted(() => ({ csrf: 'csrf-token', email: 'ops@lumical.edu', id: 'admin-actor-1' }));
vi.mock('../identity/provider', () => ({
  useIdentity: () => ({
    manager: { csrfToken: () => identity.csrf, getSnapshot: () => ({ principal: { email: identity.email, id: identity.id } }) },
    state: { phase: 'authenticated' },
  }),
}));
const routerMock = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));

const row: AdminTemplateData = {
  id: '11111111-1111-4111-8111-111111111111',
  category: 'BIRTHDAY',
  availability: 'INACTIVE',
  version: 4,
  currentPublishedRevisionId: '22222222-2222-4222-8222-222222222222',
  publishedRevision: 2,
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const listBody = (data: AdminTemplateData[], nextCursor: string | null = null, hasMore = false) =>
  ({ data, meta: { nextCursor, hasMore } });

function renderScreen(node: React.ReactNode, locale: 'en' | 'vi' = 'en') {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queries}>
      <PreferencesProvider initial={{ locale, theme: 'light' }}>{node}</PreferencesProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => { vi.unstubAllGlobals(); routerMock.push.mockReset(); });

describe('admin template list (F1)', () => {
  it('renders the table with word+icon availability and a manage link per row', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(jsonResponse(listBody([row]))));
    vi.stubGlobal('fetch', fetcher);
    renderScreen(<TemplateListScreen />);
    expect(await screen.findByRole('link', { name: 'Manage' })).toHaveAttribute('href', `/admin/templates/${row.id}`);
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
    expect(screen.getByText('Birthday')).toBeVisible();
    expect(screen.getByText('v4')).toBeVisible();
    expect(screen.getByText('Revision 2')).toBeVisible();
    expect(screen.getByRole('table', { name: /Operational template list/ })).toBeVisible();
  });

  it('filters by availability through the contract query parameter', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(jsonResponse(listBody([row]))));
    vi.stubGlobal('fetch', fetcher);
    renderScreen(<TemplateListScreen />);
    await screen.findByRole('link', { name: 'Manage' });
    fireEvent.change(screen.getByLabelText('Availability'), { target: { value: 'ARCHIVED' } });
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).includes('state=ARCHIVED'))).toBe(true));
  });

  it('shows an explicit retry when the first page fails', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({ error: { code: 'PROVIDER_UNAVAILABLE', messageKey: 'errors.providerUnavailable', requestId: 'r9', retryable: false, fieldErrors: [] } }, 422)))
      .mockImplementation(() => Promise.resolve(jsonResponse(listBody([row]))));
    vi.stubGlobal('fetch', fetcher);
    renderScreen(<TemplateListScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The template service is unavailable right now.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Manage' })).toBeVisible();
  });

  it('offers the create route', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(jsonResponse(listBody([row]))));
    vi.stubGlobal('fetch', fetcher);
    renderScreen(<TemplateListScreen />);
    expect(await screen.findByTestId('create-template')).toHaveAttribute('href', '/admin/templates/new');
  });
});

describe('admin template detail publication and conflict (F3/F5/F6/F7)', () => {
  const detailFetcher = () => vi.fn<typeof fetch>().mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/revisions')) return Promise.resolve(jsonResponse({ data: { ...row, version: 9, publishedRevision: 3 } }, 201));
    return Promise.resolve(jsonResponse(listBody([row])));
  });

  it('publishes through the review dialog with If-Match from the loaded version', async () => {
    const user = userEvent.setup();
    const fetcher = detailFetcher();
    vi.stubGlobal('fetch', fetcher);
    renderScreen(<TemplateDetailScreen templateId={row.id} />);
    await screen.findByTestId('revision-form');

    await user.type(screen.getByLabelText(/Name — Vietnamese/), 'Ngày vui');
    await user.type(screen.getByLabelText(/Name — English/), 'Bright day');
    await user.type(screen.getByLabelText(/Description — Vietnamese/), 'Mô tả');
    await user.type(screen.getByLabelText(/Description — English/), 'Description');
    await user.click(screen.getByRole('checkbox', { name: 'Classic' }));
    await user.type(screen.getByLabelText(/Base unit price/), '19.99');
    await user.type(screen.getByLabelText(/Reason/), 'Approved by ops');
    await user.click(screen.getByTestId('review-submit'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('19.99 USD → 1999');
    await user.click(screen.getByTestId('review-confirm'));

    await waitFor(() => expect(fetcher.mock.calls.some(([url, init]) =>
      String(url).endsWith('/revisions') && (init?.headers as Record<string, string>)['If-Match'] === '"4"')).toBe(true));
    expect(await screen.findByTestId('command-notice')).toHaveTextContent('Revision 3 published.');
    const publishCall = fetcher.mock.calls.find(([url]) => String(url).endsWith('/revisions'))!;
    expect((publishCall[1]?.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-token');
    expect((publishCall[1]?.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
  });

  it('shows the 412 conflict banner with the server version and never auto-resends (F5)', async () => {
    const user = userEvent.setup();
    let publishCalls = 0;
    const fetcher = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/revisions')) {
        publishCalls += 1;
        if (publishCalls === 1) {
          return Promise.resolve(jsonResponse({
            error: { code: 'VERSION_CONFLICT', messageKey: 'errors.versionConflict', requestId: 'r1', retryable: false, currentVersion: 9, fieldErrors: [] },
          }, 412));
        }
        return Promise.resolve(jsonResponse({ data: { ...row, version: 9, publishedRevision: 3 } }, 201));
      }
      return Promise.resolve(jsonResponse(listBody([{ ...row, version: publishCalls > 0 ? 9 : 4 }])));
    });
    vi.stubGlobal('fetch', fetcher);
    renderScreen(<TemplateDetailScreen templateId={row.id} />);
    await screen.findByTestId('revision-form');

    await user.type(screen.getByLabelText(/Name — Vietnamese/), 'Tên');
    await user.type(screen.getByLabelText(/Name — English/), 'Name');
    await user.type(screen.getByLabelText(/Description — Vietnamese/), 'Mô');
    await user.type(screen.getByLabelText(/Description — English/), 'Desc');
    await user.click(screen.getByRole('checkbox', { name: 'Minimal' }));
    await user.type(screen.getByLabelText(/Base unit price/), '10');
    await user.click(screen.getByTestId('review-submit'));
    await user.click(await screen.findByTestId('review-confirm'));

    const banner = await screen.findByTestId('conflict-banner');
    expect(banner).toHaveTextContent('Current version is 9');
    expect(banner).toHaveTextContent('Your entries are kept.');
    expect(publishCalls).toBe(1);

    // The typed draft is preserved across the conflict.
    expect(screen.getByLabelText(/Name — Vietnamese/)).toHaveValue('Tên');
    expect(screen.getByRole('checkbox', { name: 'Minimal' })).toBeChecked();

    // Refresh loads the current version, then a conscious resend succeeds.
    await user.click(screen.getByTestId('conflict-refresh'));
    await waitFor(() => expect(screen.queryByTestId('conflict-banner')).not.toBeInTheDocument());
    await user.click(screen.getByTestId('review-submit'));
    await user.click(await screen.findByTestId('review-confirm'));
    await waitFor(() => expect(publishCalls).toBe(2));
    expect(await screen.findByTestId('command-notice')).toHaveTextContent('Revision 3 published.');
  });

  it('maps 422 field errors onto the form and keeps the entered values (F6/F7)', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/revisions')) {
        return Promise.resolve(jsonResponse({
          error: {
            code: 'VALIDATION_FAILED', messageKey: 'errors.validationFailed', requestId: 'r2', retryable: false,
            fieldErrors: [{ path: 'presets', code: 'INVALID', messageKey: 'validation.presets' }],
          },
        }, 422));
      }
      return Promise.resolve(jsonResponse(listBody([row])));
    });
    vi.stubGlobal('fetch', fetcher);
    renderScreen(<TemplateDetailScreen templateId={row.id} />);
    await screen.findByTestId('revision-form');

    await user.type(screen.getByLabelText(/Name — Vietnamese/), 'Tên giữ lại');
    await user.type(screen.getByLabelText(/Name — English/), 'Kept name');
    await user.type(screen.getByLabelText(/Description — Vietnamese/), 'Mô');
    await user.type(screen.getByLabelText(/Description — English/), 'Desc');
    await user.click(screen.getByRole('checkbox', { name: 'Vibrant' }));
    await user.type(screen.getByLabelText(/Base unit price/), '10');
    await user.click(screen.getByTestId('review-submit'));
    await user.click(await screen.findByTestId('review-confirm'));

    expect((await screen.findAllByText('Choose at least one preset.')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Name — Vietnamese/)).toHaveValue('Tên giữ lại');
    expect(screen.getByRole('checkbox', { name: 'Vibrant' })).toBeChecked();
    expect(publishCount(fetcher)).toBe(1);
  });

  it('requires the availability reason and sends it with If-Match (F4)', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/availability')) return Promise.resolve(jsonResponse({ data: { ...row, availability: 'ACTIVE' } }));
      return Promise.resolve(jsonResponse(listBody([row])));
    });
    vi.stubGlobal('fetch', fetcher);
    renderScreen(<TemplateDetailScreen templateId={row.id} />);
    await screen.findByTestId('revision-form');

    await user.click(screen.getByTestId('availability-active'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('New projects will be able to start from this template.');
    await user.click(screen.getByTestId('availability-confirm'));
    expect(await screen.findByText(/Enter a reason of 1 to 1000 characters/)).toBeVisible();

    await user.type(screen.getByLabelText(/Reason \(required\)/), 'Catalog review complete');
    await user.click(screen.getByTestId('availability-confirm'));
    await waitFor(() => expect(fetcher.mock.calls.some(([url, init]) =>
      String(url).endsWith('/availability') && (init?.headers as Record<string, string>)['If-Match'] === '"4"')).toBe(true));
    expect(await screen.findByTestId('command-notice')).toHaveTextContent('Availability set to Active.');
  });

  it('renders the real 403 state without inventing permissions', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/revisions')) {
        return Promise.resolve(jsonResponse({ error: { code: 'FORBIDDEN', messageKey: 'errors.forbidden', requestId: 'r3', retryable: false, fieldErrors: [] } }, 403));
      }
      return Promise.resolve(jsonResponse(listBody([row])));
    });
    vi.stubGlobal('fetch', fetcher);
    const user = userEvent.setup();
    renderScreen(<TemplateDetailScreen templateId={row.id} />);
    await screen.findByTestId('revision-form');
    await user.type(screen.getByLabelText(/Name — Vietnamese/), 'T');
    await user.type(screen.getByLabelText(/Name — English/), 'N');
    await user.type(screen.getByLabelText(/Description — Vietnamese/), 'D');
    await user.type(screen.getByLabelText(/Description — English/), 'D');
    await user.click(screen.getByRole('checkbox', { name: 'Classic' }));
    await user.type(screen.getByLabelText(/Base unit price/), '10');
    await user.click(screen.getByTestId('review-submit'));
    await user.click(await screen.findByTestId('review-confirm'));
    expect(await screen.findByTestId('command-notice')).toHaveTextContent('You do not have permission to manage templates.');
  });

  it('reuses the same Idempotency-Key across retries for the same intent, and rotates when intent changes', async () => {
    const user = userEvent.setup();
    let attempt = 0;
    const idempotencyKeys: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/revisions')) {
        attempt += 1;
        const key = (init?.headers as Record<string, string>)['Idempotency-Key'];
        idempotencyKeys.push(key);
        if (attempt === 1) {
          return Promise.reject(new TypeError('network failure'));
        }
        return Promise.resolve(jsonResponse({ data: { ...row, version: 5, publishedRevision: 3 } }, 201));
      }
      return Promise.resolve(jsonResponse(listBody([row])));
    });
    vi.stubGlobal('fetch', fetcher);
    renderScreen(<TemplateDetailScreen templateId={row.id} />);
    await screen.findByTestId('revision-form');

    await user.type(screen.getByLabelText(/Name — Vietnamese/), 'Tên');
    await user.type(screen.getByLabelText(/Name — English/), 'Name');
    await user.type(screen.getByLabelText(/Description — Vietnamese/), 'Mô');
    await user.type(screen.getByLabelText(/Description — English/), 'Desc');
    await user.click(screen.getByRole('checkbox', { name: 'Classic' }));
    await user.type(screen.getByLabelText(/Base unit price/), '15.00');

    // First attempt: network failure
    await user.click(screen.getByTestId('review-submit'));
    await user.click(await screen.findByTestId('review-confirm'));
    expect(await screen.findByTestId('command-notice')).toHaveTextContent(/unavailable/i);
    expect(idempotencyKeys).toHaveLength(1);

    // Second attempt: retry with the exact same draft/intent
    await user.click(screen.getByTestId('review-submit'));
    await user.click(await screen.findByTestId('review-confirm'));
    await waitFor(() => expect(idempotencyKeys).toHaveLength(2));
    expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]); // Reused identical key!

    expect(await screen.findByTestId('command-notice')).toHaveTextContent('Revision 3 published.');
  });

  it('rotates Idempotency-Key when the admin modifies the intent before retrying', async () => {
    const user = userEvent.setup();
    const idempotencyKeys: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/revisions')) {
        const key = (init?.headers as Record<string, string>)['Idempotency-Key'];
        idempotencyKeys.push(key);
        return Promise.reject(new TypeError('network failure'));
      }
      return Promise.resolve(jsonResponse(listBody([row])));
    });
    vi.stubGlobal('fetch', fetcher);
    renderScreen(<TemplateDetailScreen templateId={row.id} />);
    await screen.findByTestId('revision-form');

    await user.type(screen.getByLabelText(/Name — Vietnamese/), 'Tên 1');
    await user.type(screen.getByLabelText(/Name — English/), 'Name 1');
    await user.type(screen.getByLabelText(/Description — Vietnamese/), 'Mô 1');
    await user.type(screen.getByLabelText(/Description — English/), 'Desc 1');
    await user.click(screen.getByRole('checkbox', { name: 'Classic' }));
    await user.type(screen.getByLabelText(/Base unit price/), '15.00');

    await user.click(screen.getByTestId('review-submit'));
    await user.click(await screen.findByTestId('review-confirm'));
    expect(await screen.findByTestId('command-notice')).toBeVisible();
    expect(idempotencyKeys).toHaveLength(1);

    // Modify a field (user actively changes intent)
    const nameInput = screen.getByLabelText(/Name — English/);
    await user.clear(nameInput);
    await user.type(nameInput, 'Name 2 - Modified');

    await user.click(screen.getByTestId('review-submit'));
    await user.click(await screen.findByTestId('review-confirm'));
    await waitFor(() => expect(idempotencyKeys).toHaveLength(2));
    expect(idempotencyKeys[1]).not.toBe(idempotencyKeys[0]); // Minted new key!
  });

  it('stores queries under actor-scoped private keys that do not leak across sessions', async () => {
    const queries = new QueryClient();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(jsonResponse(listBody([row]))));
    vi.stubGlobal('fetch', fetcher);
    render(
      <QueryClientProvider client={queries}>
        <PreferencesProvider initial={{ locale: 'en', theme: 'light' }}>
          <TemplateListScreen />
        </PreferencesProvider>
      </QueryClientProvider>,
    );
    await screen.findByRole('link', { name: 'Manage' });
    const cachedQueries = queries.getQueryCache().getAll();
    expect(cachedQueries.length).toBeGreaterThan(0);
    // Every query starts with 'private' and includes the actor id
    for (const q of cachedQueries) {
      expect(q.queryKey[0]).toBe('private');
      expect(q.queryKey[1]).toBe('admin-actor-1');
    }
  });
});

function publishCount(fetcher: { mock: { calls: unknown[][] } }) {
  return fetcher.mock.calls.filter(([url]) => String(url).includes('/revisions')).length;
}
