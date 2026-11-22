'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '../primitives/button';
import styles from './dialog.module.css';

interface DialogProps {
  /** The opening button; omit it when a parent controls `open` from its own trigger (P06 review/navigation dialogs). */
  triggerLabel?: string;
  title: string;
  description: string;
  cancelLabel: string;
  /** Hold the sole acknowledgment action while required content is loading. */
  cancelDisabled?: boolean;
  confirmLabel?: string;
  onConfirm?: () => void;
  destructive?: boolean;
  dismissible?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  /** Controlled mode: when given, the parent owns visibility and hears every close. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
export function Dialog({ triggerLabel, title, description, cancelLabel, confirmLabel, onConfirm,
  destructive = false, dismissible = true, disabled = false, cancelDisabled = false, children, open: controlledOpen, onOpenChange }: DialogProps) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLSpanElement>(null);
  const cancel = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;
  const close = () => dialog.current?.close();
  const restoreFocus = () => {
    // Native close events are queued: an earlier close must not disturb a reopen.
    if (dialog.current?.open) return;
    // A controlled dialog has no trigger to return to; the parent retracts its flag.
    if (controlled) { onOpenChange?.(false); return; }
    setInternalOpen(false); trigger.current?.querySelector('button')?.focus();
  };
  // Controlled mode mirrors the parent's flag onto the native top-layer dialog.
  useEffect(() => {
    const element = dialog.current;
    if (!controlled || !element) return;
    if (controlledOpen && !element.open) {
      element.showModal();
      if (confirmLabel) cancel.current?.querySelector('button')?.focus();
      else element.querySelector<HTMLElement>('h2')?.focus();
    } else if (!controlledOpen && element.open) element.close();
  }, [controlled, controlledOpen, confirmLabel]);
  return <>
    {triggerLabel !== undefined && <span ref={trigger}><Button disabled={disabled} aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={() => {
      if (!dialog.current || dialog.current.open) return;
      // Controlled mode: the parent raises its flag, the effect opens the layer.
      if (controlled) { onOpenChange?.(true); return; }
      dialog.current.showModal(); setInternalOpen(true);
      // Cancel is safe for confirmations; the heading is intentional for information.
      if (confirmLabel) cancel.current?.querySelector('button')?.focus();
      else dialog.current?.querySelector<HTMLElement>('h2')?.focus();
    }}>{triggerLabel}</Button></span>}
    <dialog ref={dialog} id={id} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onClose={event => { if (event.target === event.currentTarget) restoreFocus(); }}
      onCancel={event => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault(); if (dismissible) close();
      }}
      onKeyDown={event => {
        // A nested modal or an interactive descendant owns its handled keys.
        if (event.defaultPrevented || (event.target as HTMLElement).closest('dialog') !== event.currentTarget) return;
        // Native showModal supplies modality/inertness. Keep the Tab cycle on
        // actual dialog controls instead of allowing focus into browser chrome.
        if (event.key === 'Tab') {
          const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], summary, [contenteditable="true"], [tabindex]') ?? [])
            .filter(element => {
              if (element.closest('dialog') !== event.currentTarget ||
                (element.tabIndex < 0 && !(element.isContentEditable && !element.hasAttribute('tabindex'))) ||
                element.matches(':disabled') || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
              for (let ancestor: HTMLElement | null = element; ancestor && ancestor !== dialog.current; ancestor = ancestor.parentElement) {
                const style = getComputedStyle(ancestor);
                if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
                if (ancestor instanceof HTMLDetailsElement && !ancestor.open &&
                  !ancestor.querySelector(':scope > summary')?.contains(element)) return false;
              }
              return true;
            });
          // A native named radio group contributes one Tab stop, not every option.
          const stops = controls.filter(element => {
            if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || !element.name) return true;
            const group = controls.filter((other): other is HTMLInputElement => other instanceof HTMLInputElement &&
              other.type === 'radio' && other.name === element.name && other.form === element.form);
            return element === (group.find(radio => radio.checked) ?? group[0]);
          });
          if (stops.length) {
            event.preventDefault();
            const index = stops.indexOf(document.activeElement as HTMLElement);
            const next = index < 0 ? (event.shiftKey ? stops.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
            stops[next].focus();
          }
        }
        // Block implicit single-line form submission, preserving textarea newlines,
        // links, select operation and explicit buttons inside the dialog.
        if (destructive && event.key === 'Enter' && event.target instanceof HTMLInputElement &&
          !['button', 'submit', 'reset'].includes(event.target.type)) event.preventDefault();
      }}>
      <h2 id={`${id}-title`} tabIndex={-1}>{title}</h2>
      <p id={`${id}-description`}>{description}</p>
      <div className={styles.body}>{children}</div>
      <div className={styles.actions} ref={cancel}>
        <Button disabled={cancelDisabled} onClick={close}>{cancelLabel}</Button>
        {confirmLabel && <Button disabled={disabled} variant={destructive ? 'destructive' : 'primary'} onClick={() => { onConfirm?.(); close(); }}>{confirmLabel}</Button>}
      </div>
    </dialog>
  </>;
}
