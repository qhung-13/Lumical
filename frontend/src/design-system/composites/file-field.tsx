'use client';
import { useId, type ChangeEventHandler } from 'react';
import styles from './file-field.module.css';

export interface FileFieldProps {
  label: string;
  description: string;
  accept: string;
  file?: File | null;
  disabled?: boolean;
  error?: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  progress?: number;
  progressLabel?: string;
}

export function FileField({ label, description, accept, file, disabled, error, onChange, progress, progressLabel }: FileFieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const progressId = `${id}-progress`;
  const describedBy = [helpId, error && errorId, progress !== undefined && progressLabel && progressId].filter(Boolean).join(' ');
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type="file" accept={accept} disabled={disabled} onChange={onChange} aria-invalid={error ? true : undefined}
      aria-describedby={describedBy || undefined} aria-errormessage={error ? errorId : undefined} />
    <p id={helpId} className={styles.help}>{description}</p>
    {file && <p className={styles.fileName}>{file.name} · {file.size.toLocaleString()} bytes</p>}
    {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
    {progress !== undefined && <div className={styles.progress}>
      <progress id={progressId} max={100} value={progress} aria-label={progressLabel ?? label} />
      <span>{progress}%</span>
    </div>}
  </div>;
}
