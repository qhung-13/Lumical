'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectApi, projectDetailOptions } from '../../api/projects';
import { Button } from '../../design-system/primitives/button';
import { PublicShell } from '../../design-system/layouts/public-shell';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { useIdentity } from '../identity/provider';
import { projectCopy } from './copy';
import styles from './projects.module.css';

export function ProjectDetail({ id }: { id: string }) {
  const { manager, state } = useIdentity(); const { locale } = usePreferences(); const copy = projectCopy[locale];
  const actorId = state.principal?.id ?? 'anonymous';
  const api = useMemo(() => projectApi({ csrf: manager.csrfToken, epoch: manager.requestEpoch, unauthorized: () => manager.bootstrap() }), [manager]);
  const detail = useQuery({ ...projectDetailOptions(actorId, id, api), enabled: state.phase === 'authenticated' });
  const returnTo = `/projects/${encodeURIComponent(id)}`;
  return <PublicShell><div className={styles.page}>
    <Link href="/account">← {copy.back}</Link><h1>{copy.detail}</h1>
    {state.phase === 'loading' && <p role="status">{copy.loading}</p>}
    {state.phase === 'unavailable' && <p role="alert">{copy.detailError}</p>}
    {state.phase === 'unauthenticated' && <section className={styles.panel}><p>{copy.signIn}</p><Link href={`/login?next=${encodeURIComponent(returnTo)}`}>{copy.signIn}</Link></section>}
    {state.phase === 'authenticated' && detail.isPending && <p role="status">{copy.loading}</p>}
    {state.phase === 'authenticated' && detail.isError && <section className={styles.panel} role={detail.error instanceof Error && 'status' in detail.error && detail.error.status === 404 ? 'status' : 'alert'}>
      <p>{detail.error instanceof Error && 'status' in detail.error && detail.error.status === 404 ? copy.notFound : copy.detailError}</p>
      <Button onClick={() => void detail.refetch()}>{copy.retry}</Button>
    </section>}
    {state.phase === 'authenticated' && detail.data && <article className={styles.panel}>
      <p className={styles.eyebrow}>{copy.status[detail.data.status]}</p><h2>{detail.data.title}</h2>
      <dl className={styles.summaryList}>
        <div><dt>{copy.recipient}</dt><dd>{detail.data.recipientName}</dd></div>
        <div><dt>{copy.year}</dt><dd>{detail.data.year}</dd></div>
        <div><dt>{copy.templateName}</dt><dd>{detail.data.baseline.name[locale]}</dd></div>
        <div><dt>{copy.preset}</dt><dd>{detail.data.stylePresetId}</dd></div>
        <div><dt>{copy.layout}</dt><dd>{copy.layouts[detail.data.baseline.layout.type]}</dd></div>
        <div><dt>{copy.months}</dt><dd>12</dd></div>
      </dl>
    </article>}
  </div></PublicShell>;
}
