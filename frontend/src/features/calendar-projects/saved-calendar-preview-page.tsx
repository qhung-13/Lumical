'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectApi, projectPreviewOptions } from '../../api/projects';
import { Button } from '../../design-system/primitives/button';
import { PublicShell } from '../../design-system/layouts/public-shell';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { useIdentity } from '../identity/provider';
import { projectCopy } from './copy';
import { savedCalendarPreviewFromDto } from './saved-calendar-preview-model';
import { SavedCalendarPreview } from './saved-calendar-preview';
import styles from './projects.module.css';

export function SavedCalendarPreviewPage({ id }: { id: string }) {
  const { manager, state } = useIdentity();
  const { locale } = usePreferences();
  const copy = projectCopy[locale];
  const actorId = state.principal?.id ?? 'anonymous';
  const api = useMemo(() => projectApi({ csrf: manager.csrfToken, epoch: manager.requestEpoch, unauthorized: () => manager.bootstrap() }), [manager]);
  const query = useQuery({ ...projectPreviewOptions(actorId, id, api), enabled: state.phase === 'authenticated' });
  const back = `/projects/${encodeURIComponent(id)}`;
  return <PublicShell><div className={styles.page}>
    <Link className={styles.back} href={back}>← {copy.detail}</Link>
    {state.phase === 'loading' && <p role="status">{copy.loading}</p>}
    {state.phase === 'unavailable' && <p role="alert">{copy.detailError}</p>}
    {state.phase === 'unauthenticated' && <section className={styles.panel}>
      <p>{copy.signIn}</p><Link href={`/login?next=${encodeURIComponent(`${back}/preview`)}`}>{copy.signIn}</Link>
    </section>}
    {state.phase === 'authenticated' && query.isPending && <p role="status">{copy.loading}</p>}
    {state.phase === 'authenticated' && query.isError && <section className={styles.panel} role={query.error instanceof Error && 'status' in query.error && query.error.status === 404 ? 'status' : 'alert'}>
      <p>{query.error instanceof Error && 'status' in query.error && query.error.status === 404 ? copy.notFound : copy.detailError}</p>
      <Button onClick={() => void query.refetch()}>{copy.retry}</Button>
    </section>}
    {state.phase === 'authenticated' && query.data && <SavedCalendarPreview snapshot={savedCalendarPreviewFromDto(query.data)} locale={locale} />}
  </div></PublicShell>;
}
