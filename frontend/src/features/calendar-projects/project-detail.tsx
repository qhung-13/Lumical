'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectApi, projectDetailOptions, projectKeys, projectMonthsOptions, ProjectApiError } from '../../api/projects';
import { Button } from '../../design-system/primitives/button';
import { Dialog } from '../../design-system/composites/dialog';
import { PublicShell } from '../../design-system/layouts/public-shell';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { useIdentity } from '../identity/provider';
import { projectCopy } from './copy';
import styles from './projects.module.css';

export function ProjectDetail({ id }: { id: string }) {
  const { manager, state } = useIdentity(); const { locale } = usePreferences(); const copy = projectCopy[locale]; const router = useRouter();
  const client = useQueryClient(); const [selectedMonth, setSelectedMonth] = useState(1); const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(false); const pendingGuard = useRef(false);
  const actions = useRef<HTMLDivElement>(null); const restoreLifecycleFocus = useRef(false);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const actorId = state.principal?.id ?? 'anonymous';
  const api = useMemo(() => projectApi({ csrf: manager.csrfToken, epoch: manager.requestEpoch, unauthorized: () => manager.bootstrap() }), [manager]);
  const detail = useQuery({ ...projectDetailOptions(actorId, id, api), enabled: state.phase === 'authenticated' });
  const months = useQuery({ ...projectMonthsOptions(actorId, id, api), enabled: state.phase === 'authenticated' && Boolean(detail.data) });
  const returnTo = `/projects/${encodeURIComponent(id)}`;
  useEffect(() => {
    if (pending || !restoreLifecycleFocus.current) return;
    restoreLifecycleFocus.current = false;
    // Native dialog focus restoration cannot target a disabled/unmounted trigger.
    // Recover only lost/action focus; respect a user who moved into the Months.
    if (document.activeElement === document.body || actions.current?.contains(document.activeElement)) {
      actions.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    }
  }, [pending]);
  const refresh = async () => {
    await Promise.all([detail.refetch(), months.refetch()]);
    await client.invalidateQueries({ queryKey: projectKeys.lists(actorId) });
  };
  async function lifecycle(action: 'archive' | 'restore' | 'remove') {
    if (!detail.data || !state.mutationReady || pendingGuard.current) return;
    pendingGuard.current = true; restoreLifecycleFocus.current = true; setPending(true);
    setActionError('');
    try {
      if (action === 'archive') await api.archive(id, detail.data.version);
      else if (action === 'restore') await api.restore(id, detail.data.version);
      else await api.remove(id, detail.data.version);
      if (action === 'remove') {
        client.removeQueries({ queryKey: projectKeys.detail(actorId, id) });
        client.removeQueries({ queryKey: projectKeys.months(actorId, id) });
        await client.invalidateQueries({ queryKey: projectKeys.lists(actorId) });
        router.replace('/account'); return;
      }
      await refresh();
    } catch (error) {
      setActionError(error instanceof ProjectApiError && error.code === 'PROJECT_HAS_ORDERS' ? copy.hasOrders :
        error instanceof ProjectApiError && error.status === 412 ? copy.stale :
          error instanceof ProjectApiError && error.status === 409 ? copy.lifecycleConflict : copy.lifecycleError);
      await refresh();
    } finally {
      pendingGuard.current = false; setPending(false);
    }
  }
  function moveTab(index: number) { const next = (index + 12) % 12; setSelectedMonth(next + 1); tabs.current[next]?.focus(); }
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
      <div className={styles.workspaceHeading}><div><p className={styles.eyebrow}>{copy.status[detail.data.status]}</p><h2>{detail.data.title}</h2></div>
        <div ref={actions} className={styles.projectActions}>
          {detail.data.status === 'WORKING' && <Dialog disabled={pending || !state.mutationReady} triggerLabel={copy.archive} title={copy.archiveTitle} description={copy.archiveDescription} cancelLabel={copy.lifecycleCancel} confirmLabel={copy.confirm} onConfirm={() => void lifecycle('archive')} />}
          {detail.data.status === 'ARCHIVED' && <Dialog disabled={pending || !state.mutationReady} triggerLabel={copy.restore} title={copy.restoreTitle} description={copy.restoreDescription} cancelLabel={copy.lifecycleCancel} confirmLabel={copy.confirm} onConfirm={() => void lifecycle('restore')} />}
          {detail.data.deletionEligible && <Dialog disabled={pending || !state.mutationReady} triggerLabel={copy.delete} title={copy.deleteTitle} description={copy.deleteDescription} cancelLabel={copy.lifecycleCancel} confirmLabel={copy.delete} destructive onConfirm={() => void lifecycle('remove')} />}
        </div>
      </div>
      {detail.data.status === 'ARCHIVED' && <p className={styles.summary} role="status">{copy.archivedReadOnly}</p>}
      {actionError && <p className={styles.summary} role="alert">{actionError}</p>}
      <dl className={styles.summaryList}>
        <div><dt>{copy.recipient}</dt><dd>{detail.data.recipientName}</dd></div><div><dt>{copy.year}</dt><dd>{detail.data.year}</dd></div>
        <div><dt>{copy.templateName}</dt><dd>{detail.data.baseline.name[locale]}</dd></div><div><dt>{copy.preset}</dt><dd>{detail.data.stylePresetId}</dd></div>
        <div><dt>{copy.layout}</dt><dd>{copy.layouts[detail.data.baseline.layout.type]}</dd></div><div><dt>{copy.months}</dt><dd>12</dd></div>
      </dl>
      <section className={styles.monthSection} aria-label={copy.monthNav}>
        <h2>{copy.monthNav}</h2>
        {months.isPending && <p role="status">{copy.loading}</p>}
        {months.isError && <div role="alert"><p>{copy.monthError}</p><Button onClick={() => void months.refetch()}>{copy.retry}</Button></div>}
        {months.data && <>
          <div className={styles.monthTabs} role="tablist" aria-label={copy.monthNav}>
            {copy.monthNames.map((name, index) => <button key={index} ref={element => { tabs.current[index] = element; }} type="button" role="tab"
              id={`month-tab-${index + 1}`} aria-controls="month-panel" aria-selected={selectedMonth === index + 1} tabIndex={selectedMonth === index + 1 ? 0 : -1}
              className={styles.monthTab} onClick={() => setSelectedMonth(index + 1)} onKeyDown={event => {
                if (event.key === 'ArrowRight') { event.preventDefault(); moveTab(index + 1); }
                else if (event.key === 'ArrowLeft') { event.preventDefault(); moveTab(index - 1); }
                else if (event.key === 'Home') { event.preventDefault(); moveTab(0); }
                else if (event.key === 'End') { event.preventDefault(); moveTab(11); }
              }}>{name}</button>)}
          </div>
          {(() => { const month = months.data.months.find(item => item.monthNumber === selectedMonth); return <section className={styles.monthPanel} id="month-panel" role="tabpanel" aria-labelledby={`month-tab-${selectedMonth}`} tabIndex={0}>
            <h3>{copy.monthNames[selectedMonth - 1]}</h3><p>{month?.caption?.trim() || copy.emptyMonth}</p>
          </section>; })()}
        </>}
      </section>
    </article>}
  </div></PublicShell>;
}
