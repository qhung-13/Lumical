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

/**
 * Keeps an Idempotency-Key stable for the same operational intent (payload + expected version).
 * Reuses the key across retries after network failures or timeouts, and mints a fresh key
 * only when the user changes intent or after a successful mutation.
 */
export function useIntentKey() {
  const currentRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const getKey = useCallback((fingerprint: string): string => {
    if (currentRef.current && currentRef.current.fingerprint === fingerprint) {
      return currentRef.current.key;
    }
    const key = crypto.randomUUID();
    currentRef.current = { fingerprint, key };
    return key;
  }, []);

  const resetKey = useCallback(() => {
    currentRef.current = null;
  }, []);

  return { getKey, resetKey };
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
