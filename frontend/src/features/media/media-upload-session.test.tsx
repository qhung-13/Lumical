import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { IdentityProvider, useIdentity } from '../identity/provider';
import { MediaUploadScreen } from './media-upload';

const api = vi.hoisted(() => ({ initiate: vi.fn(), upload: vi.fn(), finalize: vi.fn(), status: vi.fn() }));
vi.mock('../../api/media', async original => ({ ...(await original<typeof import('../../api/media')>()), mediaApi: () => api }));
vi.mock('../../design-system/foundations/preferences-provider', () => ({ usePreferences: () => ({ locale: 'en' }) }));
vi.mock('../../design-system/layouts/public-shell', () => ({ PublicShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../identity/identity-screen', () => ({ IdentityScreen: () => <p>Sign in to upload personal media.</p> }));

afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

function LogoutControl() {
  const { manager } = useIdentity();
  return <button onClick={() => void manager.logout()}>End test session</button>;
}

it.each(['same-session', 'transient-503', 'account-switch', 'revoked', 'revoked-after-503', '401-after-503', 'switch-after-503', 'logout'] as const)('handles %s while a private transfer is in flight', async scenario => {
  const owner = { id: '22222222-2222-4222-8222-222222222222', role: 'USER', accountStatus: 'ACTIVE', email: 'owner@example.test' };
  const assetId = '11111111-1111-4111-8111-111111111111';
  const authenticated = { authenticated: true, principal: owner, csrfToken: 'a'.repeat(64) };
  const session = (data: unknown) => new Response(JSON.stringify({ data }));
  const outage = scenario.includes('503');
  const refreshed = scenario.includes('revoked') ? { authenticated: false } : scenario.includes('switch') ? {
    ...authenticated, csrfToken: 'b'.repeat(64), principal: { ...owner, id: '33333333-3333-4333-8333-333333333333' },
  } : authenticated;
  const fetcher = vi.fn().mockResolvedValueOnce(session(authenticated));
  if (outage) fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));
  fetcher.mockResolvedValueOnce(scenario === 'logout' ? new Response(null, { status: 204 }) :
    scenario === '401-after-503' ? new Response(null, { status: 401 }) : session(refreshed));
  vi.stubGlobal('fetch', fetcher);
  api.initiate.mockResolvedValue({ assetId });
  let finish!: () => void;
  let transfer!: AbortSignal;
  api.upload.mockImplementation((_intent, _file, _category, progress, signal: AbortSignal) => {
    transfer = signal;
    progress(30);
    // Simulate an adapter callback that arrives even after a client abort.
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  api.status.mockResolvedValue({ id: assetId, category: 'IMAGE', status: 'READY', verifiedBytes: 4 });
  const user = userEvent.setup();
  render(<IdentityProvider initial={{ phase: 'unauthenticated' }}><MediaUploadScreen /><LogoutControl /></IdentityProvider>);
  await user.selectOptions(await screen.findByLabelText('Media type'), 'IMAGE');
  await user.upload(screen.getByLabelText('Choose a file'), new File(['test'], 'test.png', { type: 'image/png' }));
  await user.click(screen.getByRole('button', { name: 'Upload file' }));
  expect(await screen.findByRole('progressbar')).toHaveValue(30);
  if (scenario === 'logout') await user.click(screen.getByRole('button', { name: 'End test session' }));
  else await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(fetcher).toHaveBeenCalledTimes(2);

  if (outage) {
    expect(transfer.aborted).toBe(false);
    expect(screen.getByText(/test\.png/)).toBeVisible();
    if (scenario === 'transient-503') {
      await act(async () => { finish(); });
      expect(screen.getByRole('button', { name: 'Retry server check' })).toBeDisabled();
    }
    expect(api.finalize).not.toHaveBeenCalled();
    expect(api.status).not.toHaveBeenCalled();
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(fetcher).toHaveBeenCalledTimes(3);
  }
  if (scenario === 'same-session' || scenario === 'transient-503') {
    expect(transfer.aborted).toBe(false);
    expect(screen.getByText(/test\.png/)).toBeVisible();
    if (scenario === 'transient-503') await user.click(screen.getByRole('button', { name: 'Retry server check' }));
    else await act(async () => { finish(); });
    expect(await screen.findByText('The file is verified and ready.')).toBeVisible();
    expect(api.initiate).toHaveBeenCalledTimes(1);
    expect(api.upload).toHaveBeenCalledTimes(1);
    expect(api.finalize).toHaveBeenCalledWith(assetId, expect.any(String), expect.any(AbortSignal));
  } else {
    await waitFor(() => expect(transfer.aborted).toBe(true));
    await act(async () => { finish(); });
    expect(screen.queryByText(/test\.png/)).toBeNull();
    expect(api.finalize).not.toHaveBeenCalled();
    expect(api.status).not.toHaveBeenCalled();
  }
});
