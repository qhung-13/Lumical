'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { MediaApiError, ProviderUploadError, mediaApi, type MediaApi, type MediaCategory, type OwnedMedia, type UploadCreate, type UploadIntent } from '../../api/media';
import { Button } from '../../design-system/primitives/button';
import { FileField } from '../../design-system/composites/file-field';
import { PublicShell } from '../../design-system/layouts/public-shell';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { mediaCopy } from '../../i18n/media';
import { useIdentity } from '../identity/provider';
import { IdentityScreen } from '../identity/identity-screen';
import { mediaGuidance, readDeclaredDuration, validateMediaFile } from './media-policy';
import styles from './media-upload.module.css';

type Stage = 'INITIATE' | 'UPLOAD' | 'FINALIZE' | 'STATUS';
type Phase = 'INITIATING' | 'UPLOADING' | 'FINALIZING' | 'PENDING' | 'READY' | 'UNAVAILABLE' | 'PAUSED' | 'ERROR' | 'EXPIRED';
interface UploadJob {
  readonly file: File;
  readonly category: MediaCategory;
  readonly body: UploadCreate;
  readonly initiateKey: string;
  readonly finalizeKey: string;
  readonly intent?: UploadIntent;
  readonly uploaded: boolean;
  readonly verifyAfterUpload: boolean;
  readonly phase: Phase;
  readonly progress: number;
  readonly status?: OwnedMedia;
  readonly errorStage?: Stage;
  readonly errorKind?: 'PROVIDER' | 'STATUS' | 'VALIDATION' | 'GENERAL';
}

const isExpired = (error: unknown) => error instanceof MediaApiError && error.status === 409 && error.messageKey === 'errors.uploadIntentExpired';
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

export function MediaUploadScreen() {
  const { state } = useIdentity();
  if (state.phase !== 'authenticated' || !state.principal) return <IdentityScreen mode="account" returnTo="/media/upload" />;
  return <MediaUploadExperience key={state.principal.id} />;
}

function MediaUploadExperience() {
  const { manager, state } = useIdentity();
  const { locale } = usePreferences();
  const copy = mediaCopy[locale];
  const api = useMemo(() => mediaApi({ csrf: manager.csrfToken, epoch: manager.requestEpoch,
    unauthorized: () => manager.bootstrap() }), [manager]);
  const [category, setCategory] = useState<MediaCategory | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number>();
  const [fileError, setFileError] = useState<string>();
  const [job, setJob] = useState<UploadJob>();
  const [inputVersion, setInputVersion] = useState(0);
  const jobRef = useRef<UploadJob | undefined>(undefined);
  const busy = useRef(false);
  const mounted = useRef(true);
  const controller = useRef<AbortController | undefined>(undefined);
  const selection = useRef(0);
  const actorId = state.principal?.id;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  const publish = (next: UploadJob) => { jobRef.current = next; if (mounted.current) setJob(next); };

  async function readStatusWithBackoff(current: UploadJob, requestApi: MediaApi, signal: AbortSignal) {
    let media: OwnedMedia | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      media = await requestApi.status(current.intent!.assetId, signal);
      if (media.status !== 'PENDING') return media;
      if (attempt < 3) await wait(350 * (attempt + 1));
    }
    return media!;
  }

  async function run(jobToRun: UploadJob) {
    if (busy.current || state.phase !== 'authenticated' || !state.mutationReady || !actorId) return;
    busy.current = true;
    const requestActor = actorId;
    const abort = new AbortController();
    controller.current = abort;
    let current = jobToRun;
    let stage: Stage = current.intent ? (current.uploaded || current.verifyAfterUpload ? 'FINALIZE' : 'UPLOAD') : 'INITIATE';
    try {
      if (!current.intent) {
        stage = 'INITIATE';
        current = { ...current, phase: 'INITIATING', errorStage: undefined, errorKind: undefined };
        publish(current);
        const intent = await api.initiate(current.body, current.initiateKey, abort.signal);
        if (!mounted.current || manager.requestEpoch() !== stateEpoch) return;
        current = { ...current, intent };
        publish(current);
      } else if (jobToRun.intent && !current.uploaded && !current.verifyAfterUpload) {
        // The backend, not a potentially skewed browser clock, decides whether this retry intent expired.
        stage = 'INITIATE';
        const intent = await api.initiate(current.body, current.initiateKey, abort.signal);
        current = { ...current, intent };
        publish(current);
      }

      if (!current.uploaded && !current.verifyAfterUpload) {
        stage = 'UPLOAD';
        current = { ...current, phase: 'UPLOADING', progress: 0, errorStage: undefined, errorKind: undefined };
        publish(current);
        try {
          await api.upload(current.intent!, current.file, current.category,
            progress => publish({ ...current, progress }), abort.signal);
          current = { ...current, uploaded: true, verifyAfterUpload: false, progress: 100 };
        } catch (error) {
          if (error instanceof ProviderUploadError && error.uncertain) {
            // A cross-origin response can be lost after the provider accepted the bytes.
            // Ask the backend to inspect the same pinned intent before any direct re-upload.
            current = { ...current, verifyAfterUpload: true };
          } else throw error;
        }
        publish(current);
      }

      stage = 'FINALIZE';
      current = { ...current, phase: 'FINALIZING', errorStage: undefined, errorKind: undefined };
      publish(current);
      try {
        await api.finalize(current.intent!.assetId, current.finalizeKey, abort.signal);
      } catch (error) {
        if (isExpired(error)) throw error;
        if (!(error instanceof MediaApiError) || ![409, 422, 503].includes(error.status)) throw error;
        // These outcomes can still have an authoritative status; query it before presenting a result.
      }

      stage = 'STATUS';
      const result = await readStatusWithBackoff(current, api, abort.signal);
      if (result.category !== current.category) throw new MediaApiError('PROVIDER_UNAVAILABLE', 502);
      if (!mounted.current || requestActor !== state.principal?.id || manager.requestEpoch() !== stateEpoch) return;
      publish({ ...current, status: result, phase: result.status, errorStage: result.status === 'PENDING' ? 'FINALIZE' : undefined,
        errorKind: undefined, progress: 100 });
    } catch (error) {
      if (!mounted.current || requestActor !== state.principal?.id || manager.requestEpoch() !== stateEpoch) return;
      if (error instanceof DOMException && error.name === 'AbortError') {
        publish({ ...current, phase: 'PAUSED', errorStage: current.uploaded ? 'FINALIZE' : 'UPLOAD', errorKind: undefined });
      } else if (isExpired(error)) {
        publish({ ...current, phase: 'EXPIRED', errorStage: undefined, errorKind: undefined });
      } else {
        const errorKind = stage === 'UPLOAD' ? 'PROVIDER' : stage === 'STATUS' ? 'STATUS' :
          error instanceof MediaApiError && error.status === 422 ? 'VALIDATION' : 'GENERAL';
        publish({ ...current, phase: 'ERROR', errorStage: stage, errorKind });
      }
    } finally {
      if (controller.current === abort) controller.current = undefined;
      busy.current = false;
    }
  }

  // Capture the identity generation once per mounted actor. Transport also checks this generation.
  const stateEpoch = useRef(manager.requestEpoch()).current;

  function newJob(selectedFile: File, selectedCategory: MediaCategory, declaredDuration?: number): UploadJob {
    return { file: selectedFile, category: selectedCategory,
      body: { category: selectedCategory, fileName: selectedFile.name, declaredBytes: selectedFile.size,
        ...(declaredDuration === undefined ? {} : { declaredDurationSeconds: declaredDuration }) },
      initiateKey: crypto.randomUUID(), finalizeKey: crypto.randomUUID(), uploaded: false, verifyAfterUpload: false,
      phase: 'INITIATING', progress: 0 };
  }

  function selectCategory(value: string) {
    if (value !== '' && value !== 'IMAGE' && value !== 'VIDEO' && value !== 'AUDIO') return;
    selection.current++;
    setCategory(value);
    setFile(null);
    setDuration(undefined);
    setFileError(undefined);
    setInputVersion(value => value + 1);
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0] ?? null;
    if (!selected || !category) return;
    const currentSelection = ++selection.current;
    setFile(selected);
    setDuration(undefined);
    const invalid = validateMediaFile(selected, category);
    setFileError(invalid === 'TOO_LARGE' ? copy.tooLarge : invalid === 'INVALID_FORMAT' ? copy.invalidFile : undefined);
    if (invalid) return;
    void readDeclaredDuration(selected, category).then(value => {
      if (selection.current !== currentSelection || !mounted.current) return;
      if (value !== undefined && value > 60) setFileError(copy.tooLong);
      else setDuration(value);
    });
  }

  function start() {
    if (!category || !file) { setFileError(copy.chooseFileFirst); return; }
    const invalid = validateMediaFile(file, category);
    if (invalid) { setFileError(invalid === 'TOO_LARGE' ? copy.tooLarge : copy.invalidFile); return; }
    if (duration !== undefined && duration > 60) { setFileError(copy.tooLong); return; }
    const next = newJob(file, category, duration);
    publish(next);
    void run(next);
  }

  function retry() {
    const current = jobRef.current;
    if (!current) return;
    void run(current);
  }

  function retryTransfer() {
    const current = jobRef.current;
    if (!current || current.uploaded) return;
    const next = { ...current, verifyAfterUpload: false, phase: 'PAUSED' as const, status: undefined, progress: 0 };
    publish(next);
    void run(next);
  }

  function restartExpiredIntent() {
    const current = jobRef.current;
    if (!current) return;
    const next = newJob(current.file, current.category, current.body.declaredDurationSeconds);
    publish(next);
    void run(next);
  }

  function chooseAnother() {
    if (busy.current) return;
    jobRef.current = undefined;
    setJob(undefined);
    setFile(null);
    setDuration(undefined);
    setFileError(undefined);
    setInputVersion(value => value + 1);
  }

  const guidance = category ? mediaGuidance[category] : undefined;
  const fileGuidance = category === 'IMAGE' ? copy.imageGuidance : category === 'VIDEO' ? copy.videoGuidance : copy.audioGuidance;
  const busyPhase = job?.phase === 'INITIATING' || job?.phase === 'UPLOADING' || job?.phase === 'FINALIZING';
  const allowRetry = job?.phase === 'ERROR' || job?.phase === 'PAUSED' || job?.phase === 'PENDING';
  const statusText = job?.status?.status === 'READY' ? copy.statusReady : job?.status?.status === 'UNAVAILABLE' ? copy.statusUnavailable : copy.statusPending;

  return <PublicShell><div className={styles.page}>
    <div className={styles.back}><Link href="/account">{copy.back}</Link></div>
    <header className={styles.heading}><p className={styles.eyebrow}>LumiCal · private media</p><h1>{copy.title}</h1><p>{copy.intro}</p></header>
    <section className={styles.panel} aria-labelledby="media-upload-heading">
      <h2 id="media-upload-heading">{copy.fileName}</h2>
      <div className={styles.field}>
        <label htmlFor="media-category">{copy.category}</label>
        <select id="media-category" value={category} disabled={Boolean(job)} onChange={event => selectCategory(event.target.value)}>
          <option value="">{copy.chooseCategory}</option>
          <option value="IMAGE">{copy.image}</option><option value="VIDEO">{copy.video}</option><option value="AUDIO">{copy.audio}</option>
        </select>
      </div>
      {guidance && <FileField key={inputVersion} label={copy.file} description={fileGuidance} accept={guidance.accept} file={file}
        disabled={Boolean(job)} onChange={selectFile} error={fileError} progress={job?.phase === 'UPLOADING' ? job.progress : undefined} progressLabel={copy.progress} />}
      {fileError && !guidance && <p role="alert" className={styles.error}>{fileError}</p>}
      {job?.phase === 'PENDING' && <p className={styles.status} role="status"><strong>{copy.status}: {statusText}</strong><span>{copy.pending}</span></p>}
      {job?.phase === 'READY' && <p className={`${styles.status} ${styles.ready}`} role="status"><strong>{copy.status}: {statusText}</strong><span>{copy.ready}</span></p>}
      {job?.phase === 'UNAVAILABLE' && <p className={`${styles.status} ${styles.unavailable}`} role="status"><strong>{copy.status}: {statusText}</strong><span>{copy.unavailable}</span></p>}
      {job?.phase === 'PAUSED' && <p className={styles.status} role="status">{copy.cancelled}</p>}
      {job?.phase === 'EXPIRED' && <p className={`${styles.status} ${styles.unavailable}`} role="alert">{copy.expired}</p>}
      {job?.phase === 'ERROR' && <p className={styles.error} role="alert">{job.errorKind === 'PROVIDER' ? copy.providerError : job.errorKind === 'STATUS' ? copy.statusError : job.errorKind === 'VALIDATION' ? copy.validationError : copy.error}</p>}
      {busyPhase && <p className={styles.status} role="status">{job.phase === 'INITIATING' ? copy.initiating : job.phase === 'UPLOADING' ? copy.transfer : copy.finalizing}</p>}
      {job && job.phase !== 'READY' && job.phase !== 'UNAVAILABLE' && <p className={styles.note}>{copy.working}</p>}
      {job?.phase === 'READY' ? <Button variant="primary" onClick={chooseAnother}>{copy.another}</Button> : job?.phase === 'EXPIRED' ? <div className={styles.actions}>
        <Button variant="primary" onClick={restartExpiredIntent}>{copy.restart}</Button><Button variant="secondary" onClick={chooseAnother}>{copy.chooseAnother}</Button>
      </div> : job?.phase === 'UNAVAILABLE' ? <div className={styles.actions}>
        <Button variant="primary" onClick={restartExpiredIntent}>{copy.restart}</Button><Button variant="secondary" onClick={chooseAnother}>{copy.chooseAnother}</Button>
      </div> : busyPhase ? job.phase === 'UPLOADING' ? <Button variant="secondary" onClick={() => controller.current?.abort()}>{copy.cancel}</Button> : null : allowRetry ? <div className={styles.actions}>
        <Button variant="primary" onClick={retry}>{job.phase === 'PENDING' || job.errorStage === 'FINALIZE' || job.errorStage === 'STATUS' ? copy.retryFinalize : copy.retryUpload}</Button>
        {job.phase === 'PENDING' && job.verifyAfterUpload && !job.uploaded && <Button variant="secondary" onClick={retryTransfer}>{copy.retryTransfer}</Button>}
        <Button variant="secondary" onClick={chooseAnother}>{copy.chooseAnother}</Button>
      </div> : <Button variant="primary" disabled={!state.mutationReady || !category || !file || Boolean(fileError)} onClick={start}>{copy.upload}</Button>}
    </section>
  </div></PublicShell>;
}
