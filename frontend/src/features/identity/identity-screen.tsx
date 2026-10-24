'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/identity';
import { identityCopy } from '../../i18n/identity';
import { useIdentity } from './provider';
import { privateKey } from './session-manager';
import styles from './identity.module.css';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { PreferenceControls } from '../../design-system/foundations/preference-controls';
import { Button } from '../../design-system/primitives/button';
import { FormField } from '../../design-system/composites/form-field';

export function IdentityScreen({ mode }: { mode: 'register' | 'login' | 'account' }) {
  const { manager, state } = useIdentity();
  const router = useRouter();
  const { locale, theme } = usePreferences();
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
      <PreferenceControls />
    </nav>
    <h1>{heading}</h1>
    {error && <div className={styles.error} role="alert" ref={summary} tabIndex={-1}>{message(error)}</div>}
    {state.phase === 'loading' && <p role="status">{copy.restoring}</p>}
    {state.phase === 'unavailable' && <div role="status"><p>{copy.unavailable}</p><Button onClick={() => void manager.bootstrap()}>{copy.retry}</Button></div>}
    {state.phase === 'authenticated' && state.principal && <section aria-label={copy.account}>
      <p>{state.principal.email}</p>
      {account.isError && <p role="status">{copy.unavailable} <Button onClick={() => void account.refetch()}>{copy.retry}</Button></p>}
      {mode !== 'account' && <p><Link href="/account">{copy.account}</Link></p>}
      <Button disabled={!state.mutationReady} loading={pending} loadingLabel={copy.pending} onClick={() => void logout()}>{copy.logout}</Button>
    </section>}
    {state.phase === 'unauthenticated' && (mode === 'account' ? <section>
      <p>{copy.guest}</p><Link href="/login">{copy.login}</Link>
    </section> : <form onSubmit={event => void submit(event)} noValidate>
      <p>{copy.hint}</p>
      <fieldset disabled={pending}>
        <FormField id="identity-email" label={copy.email} requirementLabel={copy.required} error={fields.email ? copy.emailError : undefined}
          name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email}
          onChange={event => { change(); setEmail(event.target.value); }} />
        <FormField id="identity-password" label={copy.password} requirementLabel={copy.required} error={fields.password ? copy.passwordError : undefined}
          name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required value={password}
          onChange={event => { change(); setPassword(event.target.value); }} />
        <Button variant="primary" type="submit" loading={pending} loadingLabel={copy.pending}>{heading}</Button>
      </fieldset>
      <p><Link href={mode === 'register' ? '/login' : '/register'}>{mode === 'register' ? copy.login : copy.register}</Link></p>
    </form>)}
  </main>;
}
