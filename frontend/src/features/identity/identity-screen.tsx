'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/identity';
import { identityCopy, type Locale } from '../../i18n/identity';
import { useIdentity } from './provider';
import { privateKey } from './session-manager';
import styles from './identity.module.css';

export function IdentityScreen({ mode, initialLocale = 'en', initialTheme = 'system' }: { mode: 'register' | 'login' | 'account'; initialLocale?: Locale; initialTheme?: string }) {
  const { manager, state } = useIdentity();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [theme, setTheme] = useState(initialTheme);
  const copy = identityCopy[locale];
  const account = useQuery({ queryKey: privateKey(state.principal?.id ?? 'guest', 'account'),
    queryFn: () => manager.api.ownAccount(), enabled: mode === 'account' && state.phase === 'authenticated' && state.mutationReady });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<{ email?: boolean; password?: boolean }>({});
  const intent = useRef<string | undefined>(undefined);
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => { if (error) summary.current?.focus(); }, [error]);
  const message = (code: string) => code === 'UNAUTHENTICATED' ? copy.credentials : code === 'VALIDATION_FAILED' ? copy.validation :
    code === 'CONFLICT' || code === 'IDEMPOTENCY_CONFLICT' ? copy.conflict : code === 'RATE_LIMITED' ? copy.limited :
    code === 'CSRF_REJECTED' || code === 'ORIGIN_REJECTED' || code === 'FORBIDDEN' ? copy.forbidden : copy.unavailable;
  const change = () => { intent.current = undefined; setError(undefined); setFields({}); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = { email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim()) || email.trim().length > 254,
      password: Array.from(password).length < 12 || Array.from(password).length > 128 };
    setFields(invalid);
    if (invalid.email || invalid.password) { setError('VALIDATION_FAILED'); return; }
    setPending(true); setError(undefined);
    intent.current ??= crypto.randomUUID();
    try {
      await manager.authenticate(mode === 'register' ? 'register' : 'login', { email, password }, intent.current);
      setPassword(''); router.replace('/account');
    } catch (error) {
      setError(error instanceof ApiError ? error.code : 'PROVIDER_UNAVAILABLE');
      if (error instanceof ApiError) setFields({ email: error.fields.some(field => field.path === 'email'), password: error.fields.some(field => field.path === 'password') });
    } finally { setPending(false); }
  }
  async function logout() {
    setPending(true); setError(undefined);
    try { await manager.logout(); setPassword(''); router.replace('/'); }
    catch (error) { setError(error instanceof ApiError ? error.code : 'PROVIDER_UNAVAILABLE'); }
    finally { setPending(false); }
  }
  const heading = mode === 'register' ? copy.register : mode === 'login' ? copy.login : copy.account;
  return <main className={styles.identity} data-theme={theme} lang={locale}>
    <nav aria-label={locale === 'vi' ? 'Điều hướng tài khoản' : 'Account navigation'} className={styles.cluster}>
      <Link href="/">{copy.home}</Link>
      <label>{copy.language}<select value={locale} onChange={event => {
        const value = event.target.value === 'vi' ? 'vi' : 'en'; setLocale(value);
        document.cookie = `lumical_locale=${value}; Path=/; SameSite=Lax; Max-Age=31536000`;
      }}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>
      <label>{copy.theme}<select value={theme} onChange={event => {
        setTheme(event.target.value); document.cookie = `lumical_theme=${event.target.value}; Path=/; SameSite=Lax; Max-Age=31536000`;
      }}><option value="system">{copy.system}</option><option value="light">{copy.light}</option><option value="dark">{copy.dark}</option></select></label>
    </nav>
    <h1>{heading}</h1>
    {error && <div className={styles.error} role="alert" ref={summary} tabIndex={-1}>{message(error)}</div>}
    {state.phase === 'loading' && <p role="status">{copy.restoring}</p>}
    {state.phase === 'unavailable' && <div role="status"><p>{copy.unavailable}</p><button onClick={() => void manager.bootstrap()}>{copy.retry}</button></div>}
    {state.phase === 'authenticated' && state.principal && <section aria-label={copy.account}>
      <p>{state.principal.email}</p>
      {account.isError && <p role="status">{copy.unavailable} <button onClick={() => void account.refetch()}>{copy.retry}</button></p>}
      {mode !== 'account' && <p><Link href="/account">{copy.account}</Link></p>}
      <button disabled={pending || !state.mutationReady} onClick={() => void logout()}>{pending ? copy.pending : copy.logout}</button>
    </section>}
    {state.phase === 'unauthenticated' && (mode === 'account' ? <section>
      <p>{copy.guest}</p><Link href="/login">{copy.login}</Link>
    </section> : <form onSubmit={event => void submit(event)} noValidate aria-busy={pending}>
      <p>{copy.hint}</p>
      <fieldset disabled={pending}>
        <div className={styles.field}>
          <label htmlFor="identity-email">{copy.email} ({copy.required})</label>
          <input id="identity-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email}
            onChange={event => { change(); setEmail(event.target.value); }} aria-invalid={!!fields.email} aria-describedby={fields.email ? 'identity-email-error' : undefined} />
          {fields.email && <p id="identity-email-error" className={styles.fieldError}>{copy.emailError}</p>}
        </div>
        <div className={styles.field}>
          <label htmlFor="identity-password">{copy.password} ({copy.required})</label>
          <input id="identity-password" name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required value={password}
            onChange={event => { change(); setPassword(event.target.value); }} aria-invalid={!!fields.password} aria-describedby={fields.password ? 'identity-password-error' : undefined} />
          {fields.password && <p id="identity-password-error" className={styles.fieldError}>{copy.passwordError}</p>}
        </div>
        <button className={styles.primary} type="submit">{pending ? copy.pending : heading}</button>
      </fieldset>
      <p><Link href={mode === 'register' ? '/login' : '/register'}>{mode === 'register' ? copy.login : copy.register}</Link></p>
    </form>)}
  </main>;
}
