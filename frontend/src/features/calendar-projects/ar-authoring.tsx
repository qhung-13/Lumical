'use client';
import { useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ProjectApiError, projectKeys, type ARWrite, type ProjectApi } from '../../api/projects';
import { MediaApiError, type MediaApi, type OwnedMedia } from '../../api/media';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { Button } from '../../design-system/primitives/button';
import { Input } from '../../design-system/primitives/input';
import { Dialog } from '../../design-system/composites/dialog';
import { StudioRevealUpload } from '../media/media-upload';
import { arAuthoringCopy } from '../../i18n/ar-authoring';
import { studioCopy } from '../../i18n/studio';
import styles from './special-dates.module.css';

interface Props {
  actorId: string; projectId: string; projectVersion: number;
  projectStatus: 'WORKING' | 'ARCHIVED'; mutationReady: boolean;
  api: ProjectApi; media: MediaApi; availableMedia: OwnedMedia[];
}
interface Draft { body: ARWrite; version: number }
interface Intent extends Draft { key: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ARAuthoring({ actorId, projectId, projectVersion, projectStatus, mutationReady, api, media, availableMedia }: Props) {
  const { locale } = usePreferences();
  const copy = arAuthoringCopy[locale];
  const id = useId();
  const client = useQueryClient();
  const current = useQuery({ queryKey: projectKeys.ar(actorId, projectId), queryFn: ({ signal }) => api.ar(projectId, signal), retry: false });
  const [draft, setDraft] = useState<Draft>();
  const [intent, setIntent] = useState<Intent>();
  const [items, setItems] = useState<OwnedMedia[]>([]);
  const [existingId, setExistingId] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const config = current.data?.config;
  const persistedMedia = useQuery({ queryKey: ['private', actorId, 'media', config?.revealAssetId],
    queryFn: ({ signal }) => media.status(config!.revealAssetId, signal), enabled: Boolean(config), retry: false });
  const body = draft?.body ?? { monthNumber: config?.monthNumber ?? 1, revealAssetId: config?.revealAssetId ?? '', readableText: config?.readableText ?? '' };
  const candidates = Array.from(new Map([...availableMedia, ...items, ...(persistedMedia.data ? [persistedMedia.data] : [])].filter(item => item.status === 'READY').map(item => [item.id, item])).values());
  const chosen = candidates.find(item => item.id === body.revealAssetId);
  const versionMatches = current.data?.projectVersion === projectVersion;
  const staleDraft = draft !== undefined && draft.version !== projectVersion;
  const readOnly = !mutationReady || projectStatus !== 'WORKING';
  const locked = readOnly || busy || current.isFetching || !versionMatches;
  const editingLocked = locked || Boolean(intent);

  function edit(patch: Partial<ARWrite>) {
    setDraft({ body: { ...body, ...patch }, version: draft?.version ?? projectVersion });
    setNotice(''); setError('');
  }
  function addMedia(item: OwnedMedia) {
    if (editingLocked || item.status !== 'READY') return;
    setItems(old => [...old.filter(other => other.id !== item.id), item]);
    edit({ revealAssetId: item.id });
  }
  async function refresh() {
    await client.invalidateQueries({ queryKey: projectKeys.all(actorId), refetchType: 'active' });
  }
  async function verifyExisting() {
    if (editingLocked || inFlight.current) return;
    if (!uuid.test(existingId.trim())) { setError(copy.mediaError); return; }
    inFlight.current = true; setBusy(true); setError('');
    try {
      const item = await media.status(existingId.trim());
      if (item.status !== 'READY') { setError(copy.mediaError); return; }
      addMedia(item); setExistingId('');
    } catch { setError(copy.mediaError); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function save() {
    if (readOnly || busy || inFlight.current || (!intent && (locked || needsReview || staleDraft))) return;
    const pending = intent ?? { body: { ...body, readableText: body.readableText.trim().normalize('NFC') }, version: draft?.version ?? projectVersion, key: crypto.randomUUID() };
    if (!chosen || !pending.body.readableText || !pending.body.readableText.isWellFormed() || pending.body.readableText.includes('\u0000') ||
      !uuid.test(pending.body.revealAssetId) || pending.body.monthNumber < 1 || pending.body.monthNumber > 12) { setError(copy.invalid); return; }
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    setIntent(pending);
    try {
      const checked = await media.status(pending.body.revealAssetId);
      if (checked.status !== 'READY' || checked.category !== chosen.category) { setError(copy.mediaError); setIntent(undefined); return; }
      const result = await api.saveAR(projectId, pending.body, pending.key, pending.version);
      client.setQueryData(projectKeys.ar(actorId, projectId), result);
      setIntent(undefined); setDraft(undefined); setNotice(copy.saved);
      await refresh();
    } catch (failure) {
      if (failure instanceof ProjectApiError && failure.status === 412) {
        setIntent(undefined); setNeedsReview(true); setError(copy.conflict); await refresh();
      } else if (failure instanceof MediaApiError) {
        if (!intent) setIntent(undefined);
        setError(copy.mediaError);
      } else if (failure instanceof ProjectApiError && failure.status < 500 && failure.status !== 0) {
        setIntent(undefined); setError(failure.code === 'MEDIA_UNAVAILABLE' || failure.status === 404 ? copy.mediaError : copy.invalid);
        await refresh();
      } else { setError(copy.failed); }
    } finally { inFlight.current = false; setBusy(false); }
  }
  async function remove() {
    if (locked || intent || inFlight.current || needsReview || staleDraft) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await api.deleteAR(projectId, projectVersion);
      setDraft(undefined); setNotice(copy.removed); await refresh();
    } catch (failure) {
      setNeedsReview(true);
      setError(failure instanceof ProjectApiError && failure.status === 412 ? copy.conflict : copy.failed);
      await refresh();
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <section className={styles.panel} aria-labelledby={`${id}-heading`}>
    <header className={styles.panelHeading}><h2 id={`${id}-heading`}>{copy.heading}</h2><p>{copy.intro}</p></header>
    {current.isPending && <p role="status">{copy.loading}</p>}
    {current.isError && <p role="alert">{copy.failed}</p>}
    <Button disabled={busy} onClick={() => void refresh()}>{copy.retry}</Button>
    {current.data && <>
      <p className={styles.notice} role="status">{!config ? copy.empty : config.status === 'PREPARING' ? copy.preparing : config.status === 'READY' ? copy.ready : copy.unavailable}</p>
      {config && (persistedMedia.isError || (persistedMedia.data && persistedMedia.data.status !== 'READY')) && <p role="alert">{copy.mediaError}</p>}
      {config && <p className={styles.help}>{copy.current}: {config.readableText}</p>}
      {readOnly && <p className={styles.notice}>{copy.readOnly}</p>}
      {(needsReview || staleDraft || !versionMatches) && <div className={styles.notice}>
        <p role="alert">{copy.conflict}</p>
        <Button disabled={locked || Boolean(intent)} onClick={() => { setNeedsReview(false); setDraft({ body: { ...body }, version: projectVersion }); setError(''); }}>{copy.review}</Button>
      </div>}
      <form className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
        <div className={styles.field}><label htmlFor={`${id}-month`}>{copy.month}</label>
          <select id={`${id}-month`} value={body.monthNumber} disabled={editingLocked} onChange={event => edit({ monthNumber: Number(event.target.value) })}>
            {studioCopy[locale].monthNames.map((name, index) => <option key={index} value={index + 1}>{name}</option>)}
          </select></div>
        <div className={styles.field}><label htmlFor={`${id}-asset`}>{copy.asset}</label>
          <select id={`${id}-asset`} value={body.revealAssetId} disabled={editingLocked} onChange={event => edit({ revealAssetId: event.target.value })}>
            <option value="">{copy.choose}</option>
            {body.revealAssetId && !chosen && <option value={body.revealAssetId}>{body.revealAssetId}</option>}
            {candidates.map(item => <option key={item.id} value={item.id}>{item.category} · {item.id}</option>)}
          </select></div>
        <div className={styles.field}><label htmlFor={`${id}-text`}>{copy.text[chosen?.category ?? 'IMAGE']}</label>
          <textarea id={`${id}-text`} value={body.readableText} disabled={editingLocked} onChange={event => edit({ readableText: event.target.value })} /></div>
        {draft && <p role="status">{copy.draft}</p>}
        {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
        <Button type="submit" disabled={readOnly || busy || (!intent && (locked || needsReview || staleDraft))} loading={busy} loadingLabel={copy.busy}>{copy.save}</Button>
      </form>
      <div className={styles.field}><label htmlFor={`${id}-existing`}>{copy.assetId}</label>
        <Input id={`${id}-existing`} value={existingId} disabled={editingLocked} onChange={event => setExistingId(event.target.value)} />
        <Button disabled={editingLocked} onClick={() => void verifyExisting()}>{copy.verify}</Button></div>
      {!editingLocked && <StudioRevealUpload onReady={addMedia} />}
      {config && <Dialog triggerLabel={copy.remove} title={copy.remove} description={copy.removal} cancelLabel={copy.cancel}
        confirmLabel={copy.confirm} destructive disabled={locked || Boolean(intent) || needsReview || staleDraft} onConfirm={() => void remove()} />}
    </>}
  </section>;
}
