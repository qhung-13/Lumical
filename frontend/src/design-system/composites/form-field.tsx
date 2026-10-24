'use client';
import { useId, type InputHTMLAttributes } from 'react';
import { Input } from '../primitives/input';
import styles from './form-field.module.css';

export type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  requirementLabel: string;
  description?: string;
  error?: string;
};

export function FormField({ id, label, requirementLabel, description, error, 'aria-describedby': describedBy, ...props }: FormFieldProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const descriptions = [describedBy, description && `${controlId}-help`, error && `${controlId}-error`].filter(Boolean).join(' ');
  return <div className={styles.field}>
    <label htmlFor={controlId}>{label} ({requirementLabel})</label>
    <Input {...props} id={controlId} aria-invalid={error ? true : props['aria-invalid']}
      aria-describedby={descriptions || undefined} aria-errormessage={error ? `${controlId}-error` : undefined} />
    {description && <p id={`${controlId}-help`} className={styles.help}>{description}</p>}
    {error && <p id={`${controlId}-error`} className={styles.error}>{error}</p>}
  </div>;
}
