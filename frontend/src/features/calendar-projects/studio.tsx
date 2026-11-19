'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { MediaApiError, mediaApi, type OwnedMedia } from '../../api/media';
import { ProjectApiError, projectApi, projectDetailOptions, projectKeys, projectMonthsOptions, projectSpecialDatesOptions, type MonthPatch } from '../../api/projects';
import { Dialog } from '../../design-system/composites/dialog';
import { PreferenceControls } from '../../design-system/foundations/preference-controls';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { Button } from '../../design-system/primitives/button';
import { Input } from '../../design-system/primitives/input';
import { useIdentity } from '../identity/provider';
import { StudioImageUpload } from '../media/media-upload';
import { studioCopy } from '../../i18n/studio';
import styles from './studio.module.css';
import { countVisibleCharacters, monthContentDraft, sameMonthContent, type MonthContentDraft } from './month-editor';
import { SpecialDatesEditor } from './special-dates-editor';
import { ARAuthoring } from './ar-authoring';
import { StyleEditor } from './style-editor';

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
  const { state } = useIdentity();
  const actorId = state.principal?.id ?? 'anonymous';
  return <StudioWorkspace key={`${actorId}:${id}`} id={id} />;
}

function StudioWorkspace({ id }: { id: string }) {
  const { manager, state } = useIdentity();
  const { locale } = usePreferences();
  const copy = studioCopy[locale];
  const actorId = state.principal?.id ?? 'anonymous';
  const scope = `${actorId}:${id}`;
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState({ actorId, projectId: id, month: 1 });
  const selectedMonth = selection.actorId === actorId && selection.projectId === id ? selection.month : 1;
  const api = useMemo(() => projectApi({ csrf: manager.csrfToken, epoch: manager.requestEpoch, unauthorized: () => manager.bootstrap() }), [manager]);
  const media = useMemo(() => mediaApi({ csrf: manager.csrfToken, epoch: manager.requestEpoch, unauthorized: () => manager.bootstrap() }), [manager]);
  const enabled = state.phase === 'authenticated';
  const project = useQuery({ ...projectDetailOptions(actorId, id, api), enabled });
  const months = useQuery({ ...projectMonthsOptions(actorId, id, api), enabled: enabled && Boolean(project.data) });
  const specialDates = useQuery({ ...projectSpecialDatesOptions(actorId, id, api), enabled: enabled && Boolean(project.data) });
  const [draftState, setDraftState] = useState<{ scope: string; months: Record<number, MonthContentDraft> }>({ scope, months: {} });
  const [sessionMediaState, setSessionMediaState] = useState<{ scope: string; items: OwnedMedia[] }>({ scope, items: [] });
  const [saveState, setSaveState] = useState<{ scope: string; months: Record<number, 'dirty' | 'saving' | 'saved' | 'error' | 'media' | 'conflict' | 'versionConflict' | 'validation'> }>({ scope, months: {} });
  // P06: one project-level conflict review gates every save until it is acknowledged.
  const [conflictReview, setConflictReview] = useState<{ currentVersion?: number } | null>(null);
  const [styleDirty, setStyleDirty] = useState(false);
  const [specialDirty, setSpecialDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const reportStyleDirty = useCallback((dirty: boolean) => setStyleDirty(dirty), []);
  const reportSpecialDirty = useCallback((dirty: boolean) => setSpecialDirty(dirty), []);
  const router = useRouter();

  const returnTo = `/projects/${encodeURIComponent(id)}`;
  const month = months.data?.months.find(item => item.monthNumber === selectedMonth);
  const persistedAssetIds = Array.from(new Set(months.data?.months.flatMap(item => item.images.map(image => image.assetId)) ?? []));
  const mediaStatusQueries = useQueries({ queries: persistedAssetIds.map(assetId => ({
    queryKey: ['private', actorId, 'media', assetId] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => media.status(assetId, signal),
    enabled,
    staleTime: 30_000,
    retry: 1,
  })) });
  const projectMedia = mediaStatusQueries.flatMap(query => query.data?.status === 'READY' ? [query.data] : []);
  const sessionMedia = sessionMediaState.scope === scope ? sessionMediaState.items : [];
  const availableMedia = Array.from(new Map([...projectMedia, ...sessionMedia].map(item => [item.id, item])).values());
  const drafts = draftState.scope === scope ? draftState.months : {};
  const draft = month ? drafts[selectedMonth] ?? monthContentDraft(month) : undefined;
  const saveStatuses = saveState.scope === scope ? saveState.months : {};
  const monthSaveStatus = saveStatuses[selectedMonth];
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

  function updateDraft(update: (current: MonthContentDraft) => MonthContentDraft) {
    if (!month || !draft) return;
    setDraftState(current => {
      const saved = current.scope === scope ? current.months : {};
      const currentDraft = saved[selectedMonth] ?? monthContentDraft(month);
      return { scope, months: { ...saved, [selectedMonth]: update(currentDraft) } };
    });
    setSaveState(current => ({ scope, months: { ...(current.scope === scope ? current.months : {}), [selectedMonth]: 'dirty' } }));
  }

  function addReadyMedia(item: OwnedMedia) {
    if (item.status !== 'READY' || item.category !== 'IMAGE') return;
    setSessionMediaState(current => {
      const items = current.scope === scope ? current.items : [];
      return { scope, items: [...items.filter(existing => existing.id !== item.id), item] };
    });
    updateDraft(current => current.images.some(image => image.assetId === item.id) || current.images.length >= 4 ? current : {
      ...current, images: [...current.images, { assetId: item.id, altText: '', crop: null }],
    });
  }

  async function saveMonth() {
    if (!enabled || !project.data || !month || !draft || project.data.status !== 'WORKING' || versionMismatch || monthSaveStatus === 'saving' || conflictReview) return;
    if (countVisibleCharacters(draft.caption) > 300) { setSaveState(current => ({ scope, months: { ...(current.scope === scope ? current.months : {}), [selectedMonth]: 'validation' } })); return; }
    const saved = monthContentDraft(month);
    if (sameMonthContent(draft, saved)) { setSaveState(current => ({ scope, months: { ...(current.scope === scope ? current.months : {}), [selectedMonth]: 'saved' } })); return; }
    setSaveState(current => ({ scope, months: { ...(current.scope === scope ? current.months : {}), [selectedMonth]: 'saving' } }));
    try {
      const verified = await Promise.all(draft.images.map(image => media.status(image.assetId)));
      if (verified.some(item => item.status !== 'READY' || item.category !== 'IMAGE')) {
        setSaveState(current => ({ scope, months: { ...(current.scope === scope ? current.months : {}), [selectedMonth]: 'media' } }));
        return;
      }
      const body: MonthPatch = { caption: draft.caption.trim().normalize('NFC') || null,
        images: draft.images.map(image => ({ assetId: image.assetId, altText: image.altText.trim().normalize('NFC'), crop: null })) };
      const result = await api.updateMonth(id, selectedMonth, body, project.data.version);
      const updatedMonths = { ...months.data!, projectVersion: result.projectVersion,
        months: months.data!.months.map(item => item.monthNumber === selectedMonth ? {
          monthNumber: result.monthNumber, caption: result.caption, images: result.images,
        } : item) };
      queryClient.setQueryData(projectKeys.months(actorId, id), updatedMonths);
      queryClient.setQueryData(projectKeys.detail(actorId, id), { ...project.data, version: result.projectVersion });
      setDraftState(current => ({ scope, months: { ...(current.scope === scope ? current.months : {}),
        [selectedMonth]: monthContentDraft({ monthNumber: result.monthNumber, caption: result.caption, images: result.images }) } }));
      setSaveState(current => ({ scope, months: { ...(current.scope === scope ? current.months : {}), [selectedMonth]: 'saved' } }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.ar(actorId, id), refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(actorId, id), refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: projectKeys.months(actorId, id), refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: projectKeys.specialDates(actorId, id), refetchType: 'active' }),
      ]);
    } catch (error) {
      const status = error instanceof MediaApiError || error instanceof ProjectApiError ? error.status : 0;
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
      const nextStatus = status === 412 || code === 'VERSION_CONFLICT' ? 'versionConflict'
        : code === 'MEDIA_UNAVAILABLE' ? 'media' : status === 409 || code === 'CONFLICT' ? 'conflict'
          : status === 422 ? 'validation' : 'error';
      setSaveState(current => ({ scope, months: { ...(current.scope === scope ? current.months : {}), [selectedMonth]: nextStatus } }));
      if (nextStatus === 'versionConflict') {
        // AC3/G4: version honesty — really refresh the saved data the message
        // promises, then require the explicit review before saving may resume.
        // The local draft in draftState is never overwritten by this refresh.
        const currentVersion = error instanceof ProjectApiError ? error.currentVersion : undefined;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: projectKeys.detail(actorId, id) }),
          queryClient.invalidateQueries({ queryKey: projectKeys.months(actorId, id) }),
          queryClient.invalidateQueries({ queryKey: projectKeys.specialDates(actorId, id) }),
        ]);
        setConflictReview({ currentVersion });
      } else if (nextStatus === 'conflict') await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(actorId, id) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.months(actorId, id) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.specialDates(actorId, id) }),
      ]);
    }
  }

  const mediaById = new Map(availableMedia.map(item => [item.id, item]));
  const mediaStatusById = new Map(persistedAssetIds.map((assetId, index) => [assetId, mediaStatusQueries[index]]));
  const draftChanged = Boolean(month && draft && !sameMonthContent(draft, monthContentDraft(month)));
  const effectiveSaveStatus = monthSaveStatus === 'saving' || ['error', 'media', 'conflict', 'versionConflict', 'validation'].includes(monthSaveStatus ?? '')
    ? monthSaveStatus : draftChanged ? 'dirty' : monthSaveStatus === 'saved' ? 'saved' : undefined;
  const effectiveSaveMessage = effectiveSaveStatus === 'saving' ? copy.editor.saving : effectiveSaveStatus === 'saved' ? copy.editor.saved
    : effectiveSaveStatus === 'dirty' ? copy.editor.draft : effectiveSaveStatus === 'media' ? copy.editor.mediaError
      : effectiveSaveStatus === 'versionConflict' ? copy.editor.versionConflict : effectiveSaveStatus === 'conflict' ? copy.editor.writeConflict
        : effectiveSaveStatus === 'validation' ? copy.editor.validation
        : effectiveSaveStatus === 'error' ? copy.editor.saveError : copy.editor.unchanged;
  const captionCount = draft ? countVisibleCharacters(draft.caption) : 0;
  const archived = project.data?.status === 'ARCHIVED';
  const editorReadOnly = archived || !versionsMatch;
  const saveDisabled = editorReadOnly || !draftChanged || captionCount > 300 || monthSaveStatus === 'saving' || conflictReview !== null ||
    Boolean(draft?.images.some(image => !mediaById.has(image.assetId) || mediaById.get(image.assetId)?.status !== 'READY'));
  // G5: one guard covers every unsaved source — month draft, style choice, special-date form.
  const hasUnsaved = draftChanged || styleDirty || specialDirty;
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);

  return <div className={styles.shell}>
    <a className={styles.skip} href="#studio-main">{locale === 'vi' ? 'Bỏ qua đến nội dung Studio' : 'Skip to Studio workspace'}</a>
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <Link className={styles.back} href={returnTo} onClick={event => {
          // SPA navigation cannot use beforeunload; intercept the only in-Studio exit.
          if (!hasUnsaved) return;
          event.preventDefault();
          setPendingNav(returnTo);
        }}>← {copy.back}</Link>
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
                {draft?.images.length ? <div className={styles.previewImages} data-layout={project.data.baseline.layout.type}>
                  {draft.images.map((image, index) => {
                    const source = mediaById.get(image.assetId);
                    return source?.status === 'READY' && source.contentPath
                      ? <Image key={`${image.assetId}-${index}`} src={source.contentPath} alt={image.altText} width={640} height={420} unoptimized />
                      : <div key={`${image.assetId}-${index}`} className={styles.imagePlaceholder} role="status">
                        {mediaStatusById.get(image.assetId)?.isPending ? copy.editor.loading : copy.editor.unavailable}
                      </div>;
                  })}
                </div> : <p className={styles.previewEmpty}>{copy.editor.empty}</p>}
                <table className={styles.calendar}>
                  <caption>{copy.monthNames[selectedMonth - 1]} {project.data.year}</caption>
                  <thead><tr>{copy.weekdays.map(day => <th key={day} scope="col" aria-label={day}>{day.slice(0, 2)}</th>)}</tr></thead>
                  <tbody>{weeks.map((week, weekIndex) => <tr key={weekIndex}>{week.map((day, dayIndex) => {
                    if (day === null) return <td key={dayIndex}></td>;
                    const date = `${String(project.data.year).padStart(4, '0')}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayEvents = specialDates.data?.projectVersion === project.data.version
                      ? specialDates.data.events.filter(event => event.date === date) : [];
                    return <td key={dayIndex}><span>{day}</span>{dayEvents.map(event => <span key={event.id} className={styles.calendarEvent}>{event.title}</span>)}</td>;
                  })}</tr>)}</tbody>
                </table>
                <footer>{draft?.caption.trim() || copy.emptyMonth}</footer>
              </article>
            </div>
          </section>
          <aside className={styles.inspector} aria-labelledby="studio-details-heading">
            <h2 id="studio-details-heading">{copy.editor.heading}</h2>
            {draft && month && <>
              {archived && <p className={styles.editorNotice} role="status">{copy.editor.archived}</p>}
              <div className={styles.editorField}>
                <label htmlFor="studio-month-caption">{copy.editor.caption} <span>({copy.editor.captionOptional})</span></label>
                <textarea id="studio-month-caption" className={styles.captionInput} value={draft.caption} disabled={editorReadOnly || monthSaveStatus === 'saving'}
                  aria-invalid={captionCount > 300} aria-describedby="studio-month-caption-help studio-month-caption-count"
                  onChange={event => updateDraft(current => ({ ...current, caption: event.target.value }))} />
                <p id="studio-month-caption-help" className={styles.fieldHelp}>{copy.editor.captionHelp}</p>
                <p id="studio-month-caption-count" className={captionCount > 300 ? styles.fieldError : styles.fieldHelp} aria-live="polite">
                  {copy.editor.captionCount(captionCount)}{captionCount > 300 ? ` · ${copy.editor.captionTooLong}` : ''}
                </p>
              </div>
              <section className={styles.editorImages} aria-labelledby="studio-month-images-heading">
                <h3 id="studio-month-images-heading">{copy.editor.selectedImages(draft.images.length)} / 4</h3>
                <p className={styles.fieldHelp}>{copy.editor.imageAvailability}</p>
                {draft.images.length === 0 && <p>{copy.editor.empty}</p>}
                <ol className={styles.imageList}>
                  {draft.images.map((image, index) => {
                    const asset = mediaById.get(image.assetId);
                    const query = mediaStatusById.get(image.assetId);
                    const statusLabel = asset?.status === 'READY' ? copy.editor.ready : query?.data?.status === 'PENDING'
                      ? copy.editor.pending : query?.isPending ? copy.editor.loading : copy.editor.unavailable;
                    return <li key={`${image.assetId}-${index}`} className={styles.imageItem}>
                      {asset?.status === 'READY' && asset.contentPath && <Image src={asset.contentPath} alt="" width={480} height={360} unoptimized />}
                      <span className={styles.imageStatus} role="status">{statusLabel}</span>
                      <label htmlFor={`studio-image-alt-${selectedMonth}-${index}`}>{copy.editor.altText(index + 1)}</label>
                      <Input id={`studio-image-alt-${selectedMonth}-${index}`} className={styles.textInput} value={image.altText}
                        disabled={editorReadOnly || monthSaveStatus === 'saving'}
                        onChange={event => updateDraft(current => ({ ...current, images: current.images.map((item, itemIndex) => itemIndex === index ? { ...item, altText: event.target.value } : item) }))} />
                      <p className={styles.fieldHelp}>{copy.editor.defaultCrop}</p>
                      <div className={styles.imageActions}>
                        <Button variant="secondary" disabled={editorReadOnly || monthSaveStatus === 'saving' || index === 0}
                          aria-label={`${locale === 'vi' ? 'Lên' : 'Move up'} — ${copy.editor.moveEarlier(index + 1)}`} onClick={() => updateDraft(current => {
                            const images = [...current.images]; [images[index - 1], images[index]] = [images[index], images[index - 1]]; return { ...current, images };
                          })}>{locale === 'vi' ? 'Lên' : 'Move up'}</Button>
                        <Button variant="secondary" disabled={editorReadOnly || monthSaveStatus === 'saving' || index === draft.images.length - 1}
                          aria-label={`${locale === 'vi' ? 'Xuống' : 'Move down'} — ${copy.editor.moveLater(index + 1)}`} onClick={() => updateDraft(current => {
                            const images = [...current.images]; [images[index], images[index + 1]] = [images[index + 1], images[index]]; return { ...current, images };
                          })}>{locale === 'vi' ? 'Xuống' : 'Move down'}</Button>
                        <Button variant="destructive" disabled={editorReadOnly || monthSaveStatus === 'saving'}
                          aria-label={`${locale === 'vi' ? 'Bỏ ảnh' : 'Remove'} — ${copy.editor.removeImage(index + 1)}`} onClick={() => updateDraft(current => ({ ...current, images: current.images.filter((_, itemIndex) => itemIndex !== index) }))}>
                          {locale === 'vi' ? 'Bỏ ảnh' : 'Remove'}
                        </Button>
                      </div>
                    </li>;
                  })}
                </ol>
                {availableMedia.filter(item => item.category === 'IMAGE' && !draft.images.some(image => image.assetId === item.id)).map((item, index) => (
                  <div className={styles.availableImage} key={item.id}>
                    {item.contentPath && <Image src={item.contentPath} alt="" width={240} height={180} unoptimized />}
                    <span>{copy.editor.ready} · {index + 1}</span>
                    <Button variant="secondary" disabled={editorReadOnly || draft.images.length >= 4 || monthSaveStatus === 'saving'}
                      onClick={() => updateDraft(current => current.images.length >= 4 ? current : { ...current,
                        images: [...current.images, { assetId: item.id, altText: '', crop: null }] })}>{copy.editor.chooseImage(index + 1)}</Button>
                  </div>
                ))}
                {draft.images.length >= 4 && <p className={styles.fieldHelp}>{copy.editor.imageLimit}</p>}
                {availableMedia.length === 0 && <p className={styles.fieldHelp}>{copy.editor.imageAvailability}</p>}
                {!editorReadOnly && <StudioImageUpload onReady={addReadyMedia} />}
              </section>
              {effectiveSaveMessage && <p className={monthSaveStatus === 'error' || monthSaveStatus === 'media' || monthSaveStatus === 'conflict' || monthSaveStatus === 'versionConflict' || monthSaveStatus === 'validation' ? styles.editorError : styles.editorNotice}
                role={monthSaveStatus === 'error' || monthSaveStatus === 'media' || monthSaveStatus === 'conflict' || monthSaveStatus === 'versionConflict' || monthSaveStatus === 'validation' ? 'alert' : 'status'}>
                {effectiveSaveMessage}
              </p>}
              <Button variant="primary" disabled={saveDisabled} loading={monthSaveStatus === 'saving'} loadingLabel={copy.editor.saving}
                onClick={() => void saveMonth()}>{copy.editor.save}</Button>
            </>}
            <StyleEditor actorId={actorId} projectId={id} presets={project.data.stylePresets}
              savedPresetId={project.data.stylePresetId} version={project.data.version}
              projectStatus={project.data.status} mutationReady={state.mutationReady}
              blocked={versionMismatch || conflictReview !== null} api={api}
              onDirtyChange={reportStyleDirty} onConflict={currentVersion => setConflictReview({ currentVersion })} />
            <details className={styles.projectDetails}>
              <summary>{copy.savedContent}</summary>
              <dl>
                <div><dt>{copy.monthNavigation}</dt><dd>{copy.monthNames[selectedMonth - 1]}</dd></div>
                <div><dt>{copy.layout}</dt><dd>{project.data.baseline.layout.type === 'COLLAGE' ? (locale === 'vi' ? 'Ảnh ghép' : 'Collage') : (locale === 'vi' ? 'Tập trung ảnh' : 'Photo focus')}</dd></div>
                <div><dt>{copy.preset}</dt><dd>{(() => {
                  const preset = project.data.stylePresets.find(item => item.id === project.data.stylePresetId);
                  return (locale === 'vi' ? preset?.name.vi : preset?.name.en) ?? project.data.stylePresetId;
                })()}</dd></div>
                <div><dt>{copy.year}</dt><dd>{project.data.year}</dd></div>
                <div><dt>{copy.recipient}</dt><dd>{project.data.recipientName}</dd></div>
              </dl>
            </details>
            {project.data && <SpecialDatesEditor actorId={actorId} projectId={id} projectYear={project.data.year}
              projectVersion={project.data.version} projectStatus={project.data.status} mutationReady={state.mutationReady}
              api={api} events={specialDates.data} loading={specialDates.isPending} fetching={specialDates.isFetching}
              failed={specialDates.isError} onDirtyChange={reportSpecialDirty}
              onRetry={() => { void Promise.all([project.refetch(), specialDates.refetch()]); }} />}
            <ARAuthoring actorId={actorId} projectId={id} projectVersion={project.data.version} projectStatus={project.data.status}
              mutationReady={state.mutationReady} api={api} media={media} availableMedia={availableMedia} />
            <Dialog open={conflictReview !== null} onOpenChange={open => { if (!open) setConflictReview(null); }}
              title={copy.conflictReview.title}
              description={`${copy.conflictReview.serverVersion(conflictReview?.currentVersion)} ${copy.conflictReview.description}`}
              cancelLabel={copy.conflictReview.acknowledge} />
            <Dialog open={pendingNav !== null} onOpenChange={open => { if (!open) setPendingNav(null); }}
              title={copy.unsavedNav.title} description={copy.unsavedNav.description}
              cancelLabel={copy.unsavedNav.stay} confirmLabel={copy.unsavedNav.leave}
              onConfirm={() => { const href = pendingNav; setPendingNav(null); if (href) router.push(href); }} />
          </aside>
        </div>
      </>}
    </main>
  </div>;
}
