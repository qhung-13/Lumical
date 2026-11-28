'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ProjectApiError, type ARPreview, type ProjectApi } from '../../api/projects';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { Button } from '../../design-system/primitives/button';
import { ownerARCopy } from '../../i18n/owner-ar-preview';
import { mindarRecognizer, type Recognizer } from './recognizer';
import styles from './owner-preview.module.css';

interface Props {
  actorId: string; projectId: string; projectVersion: number; blocked: boolean;
  preview?: ARPreview; api: ProjectApi; recognizer?: Recognizer;
}
type Status = 'idle' | 'loading' | 'scanning' | 'recognized' | 'revealed' | 'denied' | 'unsupported' | 'failed';
/** Only a single-target prepared artifact can map recognizer index zero to this session's designated target. */
export function designatedTarget(preview: ARPreview | undefined, version: number, index: number): string | undefined {
  return index === 0 && preview?.projectVersion === version && preview.config?.status === 'READY' &&
    preview.target?.status === 'READY' && preview.target.available && preview.target.sourceRevision === version
    ? preview.target.targetId : undefined;
}
export function validateReveal(value: ARPreview, version: number, targetId?: string) {
  if (value.projectVersion !== version || !value.config || !value.reveal || value.reveal.status !== 'READY' ||
      value.reveal.assetId !== value.config.revealAssetId || !value.config.readableText.trim() || !value.reveal.contentPath ||
      (targetId !== undefined && designatedTarget(value, version, 0) !== targetId)) throw new Error('Stale or unrelated reveal');
  return value as ARPreview & { config: NonNullable<ARPreview['config']>; reveal: NonNullable<ARPreview['reveal']> };
}

export function OwnerARPreview(props: Props) {
  // Key resets private resources on identity, saved revision, dirty state or descriptor replacement.
  const { preview } = props;
  const key = JSON.stringify([props.actorId, props.projectId, props.projectVersion, props.blocked, preview]);
  return <PreviewSession key={key} {...props} />;
}
function PreviewSession({ projectId, projectVersion, blocked, preview, api, recognizer = mindarRecognizer }: Props) {
  const { locale } = usePreferences(); const copy = ownerARCopy[locale]; const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const resources = useRef({ generation: 0, revealGeneration: 0, abort: new AbortController(), revealAbort: new AbortController(), stop: undefined as (() => void) | undefined, artifact: '', content: '' });
  const [status, setStatus] = useState<Status>('idle');
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState<{ descriptor: ReturnType<typeof validateReveal>; url: string }>();
  const [mediaFailed, setMediaFailed] = useState(false);
  const current = !blocked && preview?.projectVersion === projectVersion;
  const ready = current && Boolean(designatedTarget(preview, projectVersion, 0));

  function clearReveal() {
    const r = resources.current; r.revealGeneration++; r.revealAbort.abort(); r.revealAbort = new AbortController();
    if (r.content) URL.revokeObjectURL(r.content); r.content = '';
    setRevealed(undefined); setMediaFailed(false);
  }
  function release() {
    const r = resources.current; r.generation++; r.abort.abort(); r.abort = new AbortController();
    r.stop?.(); r.stop = undefined;
    if (r.artifact) URL.revokeObjectURL(r.artifact); r.artifact = '';
    clearReveal(); setRunning(false);
  }
  useEffect(() => {
    const r = resources.current;
    return () => {
      r.generation++; r.revealGeneration++; r.abort.abort(); r.revealAbort.abort(); r.stop?.();
      if (r.artifact) URL.revokeObjectURL(r.artifact);
      if (r.content) URL.revokeObjectURL(r.content);
    };
  }, []);

  async function reveal(targetId?: string) {
    if (!current) return;
    clearReveal(); const r = resources.current; const generation = r.revealGeneration;
    const signal = r.revealAbort.signal;
    try {
      // Always refresh authorization. A camera-free action deliberately omits targetId.
      const descriptor = validateReveal(await api.arReveal(projectId, projectVersion, targetId, signal), projectVersion, targetId);
      const expected = `/api/v1/projects/${projectId}/ar/reveal/content?projectVersion=${projectVersion}${targetId ? `&targetId=${targetId}` : ''}`;
      if (descriptor.reveal.contentPath !== expected) throw new Error('Unscoped content path');
      if (signal.aborted || generation !== r.revealGeneration) return;
      let blob: Blob;
      try { blob = await api.arBytes(expected, signal); } catch (failure) {
        // A refused scope or stale response invalidates even the descriptor text.
        if (failure instanceof ProjectApiError &&
            (failure.status < 500 || failure.code === 'INVALID_CONTENT_PATH')) throw failure;
        if (!signal.aborted && generation === r.revealGeneration) {
          setRevealed({ descriptor, url: '' }); setMediaFailed(true); setStatus('revealed');
        }
        return;
      }
      if (signal.aborted || generation !== r.revealGeneration) return;
      const mime = { IMAGE: 'image/', VIDEO: 'video/', AUDIO: 'audio/' }[descriptor.reveal.category];
      if (!blob.type.startsWith(mime)) { setRevealed({ descriptor, url: '' }); setMediaFailed(true); setStatus('revealed'); return; }
      r.content = URL.createObjectURL(blob);
      setRevealed({ descriptor, url: r.content }); setStatus('revealed');
    } catch { if (!signal.aborted && generation === r.revealGeneration) { clearReveal(); setStatus('failed'); } }
  }
  async function start() {
    if (!ready || running || !host.current) return;
    release(); const r = resources.current; const generation = r.generation; const signal = r.abort.signal;
    setStatus('loading'); setRunning(true);
    try {
      const fresh = await api.arPreview(projectId, signal);
      const targetId = designatedTarget(fresh, projectVersion, 0);
      if (!targetId || targetId !== preview?.target?.targetId || fresh.target?.artifactId !== preview.target.artifactId) throw new Error('Stale target');
      const expected = `/api/v1/projects/${projectId}/ar/targets/${targetId}/artifact?projectVersion=${projectVersion}`;
      if (fresh.target?.contentPath !== expected) throw new Error('Unscoped target path');
      const blob = await api.arBytes(expected, signal);
      if (signal.aborted || generation !== r.generation) return;
      r.artifact = URL.createObjectURL(blob);
      r.stop = recognizer.start(host.current!, r.artifact, event => {
        if (signal.aborted || generation !== r.generation) return;
        if (event.type === 'found') {
          if (designatedTarget(fresh, projectVersion, event.index) !== targetId) { release(); setStatus('failed'); return; }
          setStatus('recognized'); void reveal(targetId);
        } else if (event.type === 'lost') { clearReveal(); setStatus('scanning'); }
        else if (event.type === 'scanning') setStatus('scanning');
        else { release(); setStatus(event.type === 'error' ? event.kind : 'failed'); }
      }, { camera: copy.camera, locale });
    } catch { if (!signal.aborted && generation === r.generation) { release(); setStatus('failed'); } }
  }
  return <section className={styles.panel} aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>{copy.heading}</h3><p>{copy.intro}</p>
    <p role="status">{!current ? copy.blocked : status === 'idle' && !ready ? copy.unavailable : copy[status]}</p>
    <div className={styles.actions}>
      <Button disabled={!ready || running} onClick={() => void start()}>{copy.start}</Button>
      <Button disabled={!running} onClick={() => { release(); setStatus('idle'); }}>{copy.stop}</Button>
      <Button disabled={!current || !preview?.config || status === 'loading' && !running} onClick={() => { release(); setStatus('loading'); void reveal(); }}>{copy.fallback}</Button>
    </div>
    <div ref={host} className={running ? styles.camera : undefined} aria-label={copy.camera} />
    {revealed && <section className={styles.reveal} aria-labelledby={`${id}-readable`}>
      {revealed.url && (revealed.descriptor.reveal.category === 'IMAGE' ?
        // Private owner bytes must never pass through the Next image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={revealed.url} alt={revealed.descriptor.config.readableText} onError={() => setMediaFailed(true)} /> :
        revealed.descriptor.reveal.category === 'VIDEO' ? <video src={revealed.url} controls playsInline preload="metadata" aria-label={revealed.descriptor.config.readableText} onError={() => setMediaFailed(true)} /> :
          <audio src={revealed.url} controls preload="metadata" aria-label={revealed.descriptor.config.readableText} onError={() => setMediaFailed(true)} />)}
      {mediaFailed && <p role="status">{copy.mediaFailed}</p>}
      <h4 id={`${id}-readable`}>{copy.readable}</h4><p className={styles.text}>{revealed.descriptor.config.readableText}</p>
    </section>}
  </section>;
}
