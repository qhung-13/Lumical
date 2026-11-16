'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectApi, projectDetailOptions, projectMonthsOptions } from '../../api/projects';
import { PreferenceControls } from '../../design-system/foundations/preference-controls';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { Button } from '../../design-system/primitives/button';
import { useIdentity } from '../identity/provider';
import { studioCopy } from '../../i18n/studio';
import styles from './studio.module.css';

function calendarWeeks(year: number, monthNumber: number): (number | null)[][] {
  const first = new Date(0); first.setFullYear(year, monthNumber - 1, 1); first.setHours(0, 0, 0, 0);
  const last = new Date(0); last.setFullYear(year, monthNumber, 0); last.setHours(0, 0, 0, 0);
  const firstWeekday = (first.getDay() + 6) % 7;
  const dayCount = last.getDate();
  const cells: (number | null)[] = [...Array<null>(firstWeekday).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}

export function Studio({ id }: { id: string }) {
  const { manager, state } = useIdentity();
  const { locale } = usePreferences();
  const copy = studioCopy[locale];
  const actorId = state.principal?.id ?? 'anonymous';
  const [selection, setSelection] = useState({ actorId, projectId: id, month: 1 });
  const selectedMonth = selection.actorId === actorId && selection.projectId === id ? selection.month : 1;
  const api = useMemo(() => projectApi({ csrf: manager.csrfToken, epoch: manager.requestEpoch, unauthorized: () => manager.bootstrap() }), [manager]);
  const enabled = state.phase === 'authenticated';
  const project = useQuery({ ...projectDetailOptions(actorId, id, api), enabled });
  const months = useQuery({ ...projectMonthsOptions(actorId, id, api), enabled: enabled && Boolean(project.data) });

  const returnTo = `/projects/${encodeURIComponent(id)}`;
  const month = months.data?.months.find(item => item.monthNumber === selectedMonth);
  const weeks = calendarWeeks(project.data?.year ?? new Date().getFullYear(), selectedMonth);
  const loading = state.phase === 'loading' || (enabled && (project.isPending || (Boolean(project.data) && months.isPending)));
  const notFound = project.error && 'status' in project.error && project.error.status === 404;
  const failed = state.phase === 'unavailable' || (project.isError && !notFound) || months.isError;
  const projectVersion = project.isSuccess ? project.data.version : undefined;
  const monthsVersion = months.isSuccess ? months.data.projectVersion : undefined;
  const versionsLoaded = projectVersion !== undefined && monthsVersion !== undefined;
  const versionsMatch = versionsLoaded && projectVersion === monthsVersion;
  const versionMismatch = versionsLoaded && !versionsMatch;
  const versionStatus = versionMismatch ? copy.versionMismatch
    : versionsMatch && projectVersion !== undefined ? copy.savedVersion(projectVersion)
      : project.data && months.isPending ? copy.checkingVersion : copy.versionUnavailable;

  return <div className={styles.shell}>
    <a className={styles.skip} href="#studio-main">{locale === 'vi' ? 'Bỏ qua đến nội dung Studio' : 'Skip to Studio workspace'}</a>
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <Link className={styles.back} href={returnTo}>← {copy.back}</Link>
        {project.data && <div className={styles.projectHeading}>
          <div><p className={styles.eyebrow}>{copy.status[project.data.status]}</p><h1>{project.data.title}</h1></div>
          <p className={styles.saveStatus} role="status">{versionStatus}</p>
        </div>}
      </div>
      <PreferenceControls />
    </header>
    <main id="studio-main" className={styles.main} tabIndex={-1}>
      {!enabled && state.phase === 'unauthenticated' && <section className={styles.message}><p>{copy.signIn}</p><Link href={`/login?next=${encodeURIComponent(returnTo + '/studio')}`}>{locale === 'vi' ? 'Đăng nhập' : 'Sign in'}</Link></section>}
      {loading && <p role="status" className={styles.message}>{copy.loading}</p>}
      {(failed || notFound) && <section className={styles.message} role={notFound ? 'status' : 'alert'}>
        <p>{notFound ? copy.notFound : copy.error}</p><Button onClick={() => { void project.refetch(); if (project.data) void months.refetch(); }}>{copy.retry}</Button>
      </section>}
      {enabled && project.data && months.data && !failed && <>
        {project.data.status === 'ARCHIVED' && <p className={styles.archived} role="status">{copy.archived}</p>}
        {versionMismatch && <p className={styles.versionWarning} role="alert">{copy.versionMismatch}</p>}
        <section className={styles.monthNavigation} aria-label={copy.monthNavigation}>
          <h2>{copy.monthNavigation}</h2>
          <div className={styles.monthGrid} role="tablist" aria-label={copy.monthNavigation}>
            {copy.monthNames.map((name, index) => <button key={index} type="button" role="tab"
              id={`studio-month-${index + 1}`} aria-controls="studio-month-panel" aria-selected={selectedMonth === index + 1}
              tabIndex={selectedMonth === index + 1 ? 0 : -1} className={styles.monthButton}
              onClick={() => setSelection({ actorId, projectId: id, month: index + 1 })} onKeyDown={event => {
                const current = index + 1;
                const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? current % 12 + 1 :
                  event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (current + 10) % 12 + 1 :
                    event.key === 'Home' ? 1 : event.key === 'End' ? 12 : null;
                if (next !== null) { event.preventDefault(); setSelection({ actorId, projectId: id, month: next }); document.getElementById(`studio-month-${next}`)?.focus(); }
              }}>{name}</button>)}
          </div>
        </section>
        <div className={styles.workspace}>
          <section id="studio-month-panel" className={styles.previewRegion} role="tabpanel" aria-labelledby={`studio-month-${selectedMonth}`} tabIndex={0}>
            <div className={styles.previewHeading}><div><p className={styles.eyebrow}>{copy.previewLabel}</p><h2>{copy.monthNames[selectedMonth - 1]} {project.data.year}</h2></div>
              <p className={styles.previewNote}>{copy.previewNote}</p></div>
            <div className={styles.previewFrame} data-layout={project.data.baseline.layout.type}>
              <article className={styles.paper} aria-label={`${copy.previewLabel}: ${copy.monthNames[selectedMonth - 1]} ${project.data.year}`}>
                <header><span>{project.data.recipientName}</span><strong>{copy.monthNames[selectedMonth - 1]}</strong><small>{project.data.year}</small></header>
                <table className={styles.calendar}>
                  <caption>{copy.monthNames[selectedMonth - 1]} {project.data.year}</caption>
                  <thead><tr>{copy.weekdays.map(day => <th key={day} scope="col" aria-label={day}>{day.slice(0, 2)}</th>)}</tr></thead>
                  <tbody>{weeks.map((week, weekIndex) => <tr key={weekIndex}>{week.map((day, dayIndex) => <td key={dayIndex}>{day}</td>)}</tr>)}</tbody>
                </table>
                <footer>{month?.caption?.trim() || copy.emptyMonth}</footer>
              </article>
            </div>
          </section>
          <aside className={styles.inspector} aria-labelledby="studio-details-heading">
            <h2 id="studio-details-heading">{copy.savedContent}</h2>
            <dl>
              <div><dt>{copy.caption}</dt><dd>{month?.caption?.trim() || copy.noCaption}</dd></div>
              <div><dt>{copy.monthNavigation}</dt><dd>{copy.monthNames[selectedMonth - 1]}</dd></div>
              <div><dt>{copy.images(month?.images.length ?? 0)}</dt><dd>{month?.images.length ?? 0}</dd></div>
              <div><dt>{copy.layout}</dt><dd>{project.data.baseline.layout.type === 'COLLAGE' ? (locale === 'vi' ? 'Ảnh ghép' : 'Collage') : (locale === 'vi' ? 'Tập trung ảnh' : 'Photo focus')}</dd></div>
              <div><dt>{copy.preset}</dt><dd>{project.data.stylePresetId}</dd></div>
              <div><dt>{copy.year}</dt><dd>{project.data.year}</dd></div>
              <div><dt>{copy.recipient}</dt><dd>{project.data.recipientName}</dd></div>
            </dl>
          </aside>
        </div>
      </>}
    </main>
  </div>;
}
