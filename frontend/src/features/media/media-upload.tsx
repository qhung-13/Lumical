'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { MediaApiError, ProviderUploadError, mediaApi, type MediaApi, type MediaCategory, type OwnedMedia, type UploadCreate, type UploadIntent } from '../../api/media';
import { Button } from '../../design-system/primitives/button';
import { FileField } from '../../design-system/composites/file-field';
import { PublicShell } from '../../design-system/layouts/public-shell';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { mediaCopy } from '../../i18n/media';
import { identityCopy } from '../../i18n/identity';
import { useIdentity } from '../identity/provider';
import { IdentityScreen } from '../identity/identity-screen';
import { mediaGuidance, readDeclaredDuration, validateMediaFile } from './media-policy';
import styles from './media-upload.module.css';

type Stage = 'INITIATE' | 'UPLOAD' | 'FINALIZE' | 'STATUS';
type Phase = 'INITIATING' | 'UPLOADING' | 'FINALIZING' | 'PENDING' | 'READY' | 'UNAVAILABLE' | 'PAUSED' | 'AWAITING_SESSION' | 'ERROR' | 'EXPIRED';
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
  readonly errorKind?: 'PROVIDER' | 'STATUS' | 'VALIDATION' | 'GENERAL' | 'RATE_LIMITED';
}

const isExpired = (error: unknown) => error instanceof MediaApiError && error.status === 409 && error.messageKey === 'errors.uploadIntentExpired';
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

export function MediaUploadScreen() {
  const { manager, state } = useIdentity();
  const actor = state.principal ?? state.unverifiedPrincipal;
  if (!actor) return <IdentityScreen mode="account" returnTo="/media/upload" />;
  return <MediaUploadExperience key={`${actor.id}:${manager.requestEpoch()}`} />;
}

function MediaUploadExperience() {
  const { manager, state } = useIdentity();
  const { locale } = usePreferences();
  const copy = mediaCopy[locale];
  const sessionCopy = identityCopy[locale];
  const api = useMemo(() => mediaApi({ csrf: manager.csrfToken, epoch: manager.requestEpoch,
    unauthorized: manager.invalidate }), [manager]);
  const [category, setCategory] = useState<MediaCategory | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number>();
  const [fileError, setFileError] = useState<string>();
  const [job, setJob] = useState<UploadJob>();
  const [retryAt, setRetryAt] = useState<number>();
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [inputVersion, setInputVersion] = useState(0);
  const jobRef = useRef<UploadJob | undefined>(undefined);
  const busy = useRef(false);
  const mounted = useRef(true);
  const controller = useRef<AbortController | undefined>(undefined);
  const selection = useRef(0);
  const stateEpoch = useRef(manager.requestEpoch()).current;
  const isCurrent = () => mounted.current && manager.requestEpoch() === stateEpoch;
  const canMutate = () => isCurrent() && manager.getSnapshot().mutationReady;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => {
    if (retryAt === undefined) return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const milliseconds = retryAt - Date.now();
      setWaitSeconds(Math.max(0, Math.ceil(milliseconds / 1000)));
      if (milliseconds > 0) timer = setTimeout(update, Math.min(1000, milliseconds));
    };
    update();
    return () => clearTimeout(timer);
  }, [retryAt]);
  const publish = (next: UploadJob) => { jobRef.current = next; if (mounted.current) setJob(next); };

  async function readStatusWithBackoff(current: UploadJob, requestApi: MediaApi, signal: AbortSignal) {
    let media: OwnedMedia | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!canMutate()) return;
      media = await requestApi.status(current.intent!.assetId, signal);
      if (media.status !== 'PENDING') return media;
      if (attempt < 3) await wait(350 * (attempt + 1));
    }
    return media;
  }

  async function run(jobToRun: UploadJob) {
    if (busy.current || !canMutate()) return;
    const needsIntent = !jobToRun.intent || (!jobToRun.uploaded && !jobToRun.verifyAfterUpload);
    if (needsIntent && retryAt !== undefined && Date.now() < retryAt) return;
    busy.current = true;
    const abort = new AbortController();
    controller.current = abort;
    let current = jobToRun;
    let stage: Stage = current.intent ? (current.uploaded || current.verifyAfterUpload ? 'FINALIZE' : 'UPLOAD') : 'INITIATE';
    const pauseForSession = () => {
      if (canMutate()) return false;
      if (isCurrent()) publish({ ...current, phase: 'AWAITING_SESSION', errorStage: stage, errorKind: undefined });
      return true;
    };
    try {
      if (!current.intent) {
        stage = 'INITIATE';
        current = { ...current, phase: 'INITIATING', errorStage: undefined, errorKind: undefined };
        publish(current);
        const intent = await api.initiate(current.body, current.initiateKey, abort.signal);
        if (!isCurrent()) return;
        current = { ...current, intent };
        publish(current);
      } else if (jobToRun.intent && !current.uploaded && !current.verifyAfterUpload) {
        // The backend, not a potentially skewed browser clock, decides whether this retry intent expired.
        stage = 'INITIATE';
        const intent = await api.initiate(current.body, current.initiateKey, abort.signal);
        if (!isCurrent()) return;
        current = { ...current, intent };
        publish(current);
      }

      if (pauseForSession()) return;
      if (!current.uploaded && !current.verifyAfterUpload) {
        stage = 'UPLOAD';
        current = { ...current, phase: 'UPLOADING', progress: 0, errorStage: undefined, errorKind: undefined };
        publish(current);
        try {
          await api.upload(current.intent!, current.file, current.category,
            progress => { if (isCurrent()) publish({ ...current, progress }); }, abort.signal);
          current = { ...current, uploaded: true, verifyAfterUpload: false, progress: 100 };
        } catch (error) {
          if (error instanceof ProviderUploadError && error.uncertain) {
            // A cross-origin response can be lost after the provider accepted the bytes.
            // Ask the backend to inspect the same pinned intent before any direct re-upload.
            current = { ...current, verifyAfterUpload: true };
          } else throw error;
        }
        if (!isCurrent()) return;
        publish(current);
      }

      stage = 'FINALIZE';
      if (pauseForSession()) return;
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
      if (pauseForSession() || !result) return;
      if (result.category !== current.category) throw new MediaApiError('PROVIDER_UNAVAILABLE', 502);
      publish({ ...current, status: result, phase: result.status, errorStage: result.status === 'PENDING' ? 'FINALIZE' : undefined,
        errorKind: undefined, progress: 100 });
    } catch (error) {
      if (!isCurrent()) return;
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Cancellation can race provider success. Inspect before any explicit re-transfer.
        publish({ ...current, verifyAfterUpload: stage === 'UPLOAD' || current.verifyAfterUpload,
          phase: 'PAUSED', errorStage: stage === 'UPLOAD' || current.uploaded ? 'FINALIZE' : 'UPLOAD', errorKind: undefined });
      } else if (isExpired(error)) {
        publish({ ...current, phase: 'EXPIRED', errorStage: undefined, errorKind: undefined });
      } else if (stage === 'INITIATE' && error instanceof MediaApiError && error.status === 429) {
        setRetryAt(error.retryAt);
        setWaitSeconds(error.retryAt === undefined ? 0 : Math.max(0, Math.ceil((error.retryAt - Date.now()) / 1000)));
        publish({ ...current, phase: 'ERROR', errorStage: stage, errorKind: 'RATE_LIMITED' });
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
    if (!canMutate() || waitSeconds > 0) return;
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
    if (!canMutate() || !current || current.uploaded || waitSeconds > 0) return;
    const next = { ...current, verifyAfterUpload: false, phase: 'PAUSED' as const, status: undefined, progress: 0 };
    publish(next);
    void run(next);
  }

  function restartExpiredIntent() {
    const current = jobRef.current;
    if (!canMutate() || !current || waitSeconds > 0) return;
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
  const allowRetry = job?.phase === 'ERROR' || job?.phase === 'PAUSED' || job?.phase === 'PENDING' || job?.phase === 'AWAITING_SESSION';
  const coolingDown = waitSeconds > 0;
  const retryNeedsIntent = job && (!job.intent || (!job.uploaded && !job.verifyAfterUpload));
  const waitLabel = coolingDown ? new Intl.NumberFormat(locale, {
    style: 'unit', unit: waitSeconds >= 60 ? 'minute' : 'second', unitDisplay: 'long',
  }).format(waitSeconds >= 60 ? Math.ceil(waitSeconds / 60) : waitSeconds) : undefined;
  const statusText = job?.status?.status === 'READY' ? copy.statusReady : job?.status?.status === 'UNAVAILABLE' ? copy.statusUnavailable : copy.statusPending;

  return <PublicShell><div className={styles.page}>
    <div className={styles.back}><Link href="/account">{copy.back}</Link></div>
    <header className={styles.heading}><p className={styles.eyebrow}>LumiCal · private media</p><h1>{copy.title}</h1><p>{copy.intro}</p></header>
    <section className={styles.panel} aria-labelledby="media-upload-heading">
      <h2 id="media-upload-heading">{copy.fileName}</h2>
      {state.phase === 'unavailable' && <p className={styles.status} role="status">{sessionCopy.unavailable}
        <Button variant="secondary" onClick={() => void manager.bootstrap()}>{sessionCopy.retry}</Button></p>}
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
      {(coolingDown || job?.errorKind === 'RATE_LIMITED') && <p className={styles.error} role="status">{waitLabel ? copy.rateLimitWait(waitLabel) : copy.rateLimit}</p>}
      {job?.phase === 'ERROR' && job.errorKind !== 'RATE_LIMITED' && <p className={styles.error} role="alert">{job.errorKind === 'PROVIDER' ? copy.providerError : job.errorKind === 'STATUS' ? copy.statusError : job.errorKind === 'VALIDATION' ? copy.validationError : copy.error}</p>}
      {busyPhase && <p className={styles.status} role="status">{job.phase === 'INITIATING' ? copy.initiating : job.phase === 'UPLOADING' ? copy.transfer : copy.finalizing}</p>}
      {job && job.phase !== 'READY' && job.phase !== 'UNAVAILABLE' && <p className={styles.note}>{copy.working}</p>}
      {job?.phase === 'READY' ? <Button variant="primary" onClick={chooseAnother}>{copy.another}</Button> : job?.phase === 'EXPIRED' ? <div className={styles.actions}>
        <Button variant="primary" disabled={!state.mutationReady || coolingDown} onClick={restartExpiredIntent}>{copy.restart}</Button><Button variant="secondary" onClick={chooseAnother}>{copy.chooseAnother}</Button>
      </div> : job?.phase === 'UNAVAILABLE' ? <div className={styles.actions}>
        <Button variant="primary" disabled={!state.mutationReady || coolingDown} onClick={restartExpiredIntent}>{copy.restart}</Button><Button variant="secondary" onClick={chooseAnother}>{copy.chooseAnother}</Button>
      </div> : busyPhase ? job.phase === 'UPLOADING' ? <Button variant="secondary" onClick={() => controller.current?.abort()}>{copy.cancel}</Button> : null : allowRetry ? <div className={styles.actions}>
        <Button variant="primary" disabled={!state.mutationReady || (coolingDown && retryNeedsIntent)} onClick={retry}>{job.phase === 'PENDING' || job.errorStage === 'FINALIZE' || job.errorStage === 'STATUS' ? copy.retryFinalize : copy.retryUpload}</Button>
        {job.phase === 'PENDING' && job.verifyAfterUpload && !job.uploaded && <Button variant="secondary" disabled={!state.mutationReady || coolingDown} onClick={retryTransfer}>{copy.retryTransfer}</Button>}
        <Button variant="secondary" onClick={chooseAnother}>{copy.chooseAnother}</Button>
      </div> : <Button variant="primary" disabled={!state.mutationReady || coolingDown || !category || !file || Boolean(fileError)} onClick={start}>{copy.upload}</Button>}
    </section>
  </div></PublicShell>;
}
