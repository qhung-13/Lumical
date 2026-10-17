import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdentityProvider } from './provider';
import { PreferencesProvider } from '../../design-system/foundations/preferences-provider';
import { IdentityScreen } from './identity-screen';
const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const principal = { id: '11111111-1111-4111-8111-111111111111', email: 'demo@example.invalid', role: 'USER', accountStatus: 'ACTIVE' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
afterEach(() => { vi.unstubAllGlobals(); replace.mockClear(); document.cookie = 'lumical_locale=; Max-Age=0'; document.cookie = 'lumical_theme=; Max-Age=0'; });
describe('identity forms and account UI', () => {
  it('associates validation errors with labels, preserves passphrases and renders generic login failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ authenticated: false }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', fieldErrors: [] } }), { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    render(<PreferencesProvider><IdentityProvider initial={{ phase: 'unauthenticated' }}><IdentityScreen mode="login" /></IdentityProvider></PreferencesProvider>);
    const email = await screen.findByLabelText('Email (required)'); const password = screen.getByLabelText('Password (required)');
    fireEvent.submit(email.closest('form')!);
    expect(password).toHaveAttribute('aria-describedby', 'identity-password-error');
    fireEvent.change(email, { target: { value: 'demo@example.invalid' } });
    fireEvent.change(password, { target: { value: '  TEST ONLY passphrase  ' } });
    fireEvent.submit(email.closest('form')!);
    await screen.findByText('The email or password is incorrect, or access is unavailable.');
    expect(password).toHaveValue('  TEST ONLY passphrase  '); expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(replace).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[1][1]?.body).toContain('  TEST ONLY passphrase  ');
  });
  it('register retry preserves intent, announces pending and uses committed authentication before navigation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ authenticated: false }))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(json({ ...principal, csrfToken: 'a'.repeat(64) }));
    vi.stubGlobal('fetch', fetcher);
    render(<PreferencesProvider><IdentityProvider initial={{ phase: 'unauthenticated' }}><IdentityScreen mode="register" /></IdentityProvider></PreferencesProvider>);
    const email = await screen.findByLabelText('Email (required)');
    fireEvent.change(email, { target: { value: principal.email } });
    fireEvent.change(screen.getByLabelText('Password (required)'), { target: { value: 'TEST ONLY passphrase' } });
    fireEvent.submit(email.closest('form')!);
    await screen.findByText('We cannot check your account right now. Please retry.');
    expect(replace).not.toHaveBeenCalled(); fireEvent.submit(email.closest('form')!);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/account'));
    const first = fetcher.mock.calls[1][1]?.headers as Record<string, string>;
    const second = fetcher.mock.calls[2][1]?.headers as Record<string, string>;
    expect(first['Idempotency-Key']).toBe(second['Idempotency-Key']); expect(first['Idempotency-Key']).toBeTruthy();
  });
  it('restores a session, supports VI/EN and dark mode, and only navigates after backend logout', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ authenticated: true, principal, csrfToken: 'a'.repeat(64) }))
      .mockResolvedValueOnce(json(principal)).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    render(<PreferencesProvider><IdentityProvider initial={{ phase: 'unauthenticated' }}><IdentityScreen mode="account" /></IdentityProvider></PreferencesProvider>);
    await screen.findByText(principal.email);
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'vi' } });
    expect(screen.getByRole('heading', { name: 'Tài khoản của bạn' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Giao diện'), { target: { value: 'dark' } });
    expect(screen.getByRole('main')).toHaveAttribute('data-theme', 'dark');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByText(principal.email)).not.toBeInTheDocument();
    expect(document.cookie).not.toContain('csrf'); expect(document.cookie).not.toContain('session');
  });
});
