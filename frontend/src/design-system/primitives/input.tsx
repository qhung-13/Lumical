import type { InputHTMLAttributes } from 'react';
import styles from './controls.module.css';

export function Input({ className = '', type = 'text', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type={type} className={`${styles.input} ${className}`} />;
}
