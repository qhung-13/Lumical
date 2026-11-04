'use client';
// I04-P04 — shared command state for the Admin Templates mutations.
// One place encodes the contract's failure handling: 422 → per-field errors,
// 412 → conflict banner with the server's currentVersion (never auto-resent,
// never a guessed version), everything else → an operational message. Entered
// values live in the form and are never reset by a failure (F7).
import { useCallback, useRef, useState } from 'react';
import { usePreferences } from '../../design-system/foundations/preferences-provider';
import { AdminTemplateError } from '../../api/admin-templates';
import { requestErrorMessage } from '../../i18n/admin-templates';
import type { FieldError } from './revision-form';
import { formatTemplateAdmin, type TemplateAdminKey } from '../../i18n/admin-templates';

export interface CommandNotice {
  readonly tone: 'success' | 'danger';
  readonly message: string;
}

export interface AdminCommandState {
  readonly pending: boolean;
  readonly fieldErrors: readonly FieldError[];
  readonly fieldSource?: CommandSource;
  /** Server-reported currentVersion after a 412 — only ever from the response. */
  readonly conflict?: { readonly version: number; readonly source: CommandSource };
  readonly notice?: CommandNotice;
}

/** Which command hit the conflict, so the banner appears in the right place. */
export type CommandSource = 'revision' | 'availability';

export function useTemplateIntent(scope: string) {
  const current = useRef<{ fingerprint: string; key: string; version: number } | null>(null);
  const inFlight = useRef(false);
  const [review, setReview] = useState<{ storageKey: string; key: string } | null>(null);

  function clear(storageKey: string, key: string) {
    if (sessionStorage.getItem(storageKey) === key) sessionStorage.removeItem(storageKey);
    current.current = null;
    setReview(null);
  }

  async function execute<T>(fingerprint: string, version: number, send: (key: string, version: number) => Promise<T>) {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const scopeDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scope));
      const storageKey = `lumical:admin-template:unresolved:${btoa(String.fromCharCode(...new Uint8Array(scopeDigest)))}`;
      const previousKey = sessionStorage.getItem(storageKey);
      const previous = current.current;
      if (previousKey && (previous?.key !== previousKey || previous.fingerprint !== fingerprint)) {
        // Changed input or a remounted form needs explicit review before starting a new command.
        setReview({ storageKey, key: previousKey });
        return;
      }
      const intent = previousKey && previous ? previous : { fingerprint, key: crypto.randomUUID(), version };
      // Only opaque metadata survives navigation/reload. Payload and version stay in memory.
      sessionStorage.setItem(storageKey, intent.key);
      current.current = intent;
      setReview(null);
      try {
        const result = await send(intent.key, intent.version);
        clear(storageKey, intent.key);
        return result;
      } catch (error) {
        // Access checks precede replay. They cannot resolve an earlier lost response.
        if (error instanceof AdminTemplateError &&
            ([404, 409, 412, 422, 428].includes(error.status) ||
              (!previousKey && [401, 403, 429].includes(error.status)))) {
          clear(storageKey, intent.key);
        }
        throw error;
      }
    } finally {
      inFlight.current = false;
    }
  }

  function acknowledgeReview() {
    if (review && !inFlight.current) clear(review.storageKey, review.key);
  }

  return { execute, reviewRequired: review !== null, acknowledgeReview };
}

export function useAdminCommand() {
  const { locale } = usePreferences();
  const [state, setState] = useState<AdminCommandState>({ pending: false, fieldErrors: [] });

  const run = useCallback(async (source: CommandSource, execute: () => Promise<void>) => {
    setState((previous) => ({ ...previous, pending: true, fieldErrors: [], fieldSource: undefined, notice: undefined }));
    try {
      await execute();
      // Keep the notice `success()` just set inside execute; only reset the rest.
      setState((previous) => ({ pending: false, fieldErrors: [], fieldSource: undefined, notice: previous.notice }));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setState((previous) => ({ ...previous, pending: false }));
        return;
      }
      if (error instanceof AdminTemplateError) {
        if (error.status === 412) {
          // Conflict: stop here. The caller offers Refresh/Close; nothing is re-sent.
          setState({
            pending: false,
            fieldErrors: [],
            ...(error.currentVersion !== undefined
              ? { conflict: { version: error.currentVersion, source } }
              : { notice: { tone: 'danger', message: requestErrorMessage(locale, 'VERSION_CONFLICT') } }),
          });
          return;
        }
        if (error.status === 422 && error.fields.length > 0) {
          setState({ pending: false, fieldErrors: error.fields, fieldSource: source });
          return;
        }
        setState({ pending: false, fieldErrors: [], notice: { tone: 'danger', message: requestErrorMessage(locale, error.code) } });
        return;
      }
      setState({ pending: false, fieldErrors: [], notice: { tone: 'danger', message: requestErrorMessage(locale, 'PROVIDER_UNAVAILABLE') } });
    }
  }, [locale]);

  const success = useCallback((message: string) => {
    setState({ pending: false, fieldErrors: [], notice: { tone: 'success', message } });
  }, []);

  const dismissConflict = useCallback(() => {
    setState((previous) => ({ ...previous, conflict: undefined }));
  }, []);

  const clearNotice = useCallback(() => {
    setState((previous) => ({ ...previous, notice: undefined }));
  }, []);

  const clearFieldErrors = useCallback(() => {
    setState((previous) => ({ ...previous, fieldErrors: [], fieldSource: undefined }));
  }, []);

  const ok = useCallback((key: TemplateAdminKey, vars?: Record<string, string | number>) => formatTemplateAdmin(locale, key, vars), [locale]);

  return { ...state, run, success, dismissConflict, clearNotice, clearFieldErrors, ok };
}
