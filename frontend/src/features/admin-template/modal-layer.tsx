'use client';
// I04-P04 — shared modal layer for the Admin Templates dialogs (review,
// availability). It uses a native <dialog> with showModal() — the same proven
// mechanism as the design system's Dialog composite (real modality, inert
// background, focus containment) — but opens programmatically after form
// validation instead of from a trigger button. The element exists only while
// open; Escape routes through the parent's dismissal policy (blocked while a
// command is pending) and focus returns to the opener on close.
import { useEffect, useRef, type ReactNode } from 'react';
import styles from './admin-template.module.css';

const FOCUSABLE = 'button, [href], textarea, input, select, [tabindex]';

export interface ModalLayerProps {
  readonly open: boolean;
  readonly labelledBy: string;
  readonly describedBy: string;
  /** Where focus lands on open. Falls back to the first focusable node. */
  readonly initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Escape routes here; the parent owns whether dismissal is currently safe. */
  readonly onDismiss: () => void;
  readonly children: ReactNode;
}

export function ModalLayer({ open, labelledBy, describedBy, initialFocusRef, onDismiss, children }: ModalLayerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  // Keep the latest dismissal policy without re-binding the element handlers.
  const dismissRef = useRef(onDismiss);
  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    // Cancel first is the design system's safe default for confirmations;
    // an explicit initialFocusRef (e.g. the audit reason) wins.
    (initialFocusRef?.current ?? dialog.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    return () => {
      if (dialog.open) dialog.close();
      triggerRef.current?.focus();
    };
  }, [open, initialFocusRef]);

  const onKey = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    // A nested dialog (or an already-handled key) owns its own events.
    if (event.defaultPrevented || (event.target as HTMLElement).closest('dialog') !== event.currentTarget) return;
    if (event.key === 'Escape') {
      // Controlled dismissal: the parent decides (e.g. blocked while pending).
      // preventDefault also keeps the native close from racing React state.
      event.preventDefault();
      event.stopPropagation();
      dismissRef.current();
      return;
    }
    if (event.key !== 'Tab') return;
    // Native showModal already contains focus; this cycle keeps Tab on the
    // dialog's controls instead of the browser chrome (design system rule).
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      .filter((element) => {
        if (element.tabIndex < 0 || element.matches(':disabled') ||
          element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    if (controls.length === 0) return;
    event.preventDefault();
    const index = controls.indexOf(document.activeElement as HTMLElement);
    const next = index < 0
      ? (event.shiftKey ? controls.length - 1 : 0)
      : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    controls[next].focus();
  };

  if (!open) return null;
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onKeyDown={onKey}
      onCancel={(event) => {
        // Native Escape also emits cancel; block it and use the same policy.
        event.preventDefault();
        dismissRef.current();
      }}
      onClose={() => triggerRef.current?.focus()}
    >
      {children}
    </dialog>
  );
}
