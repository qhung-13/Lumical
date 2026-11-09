import type { ProjectCreate } from '../../api/projects';
import type { SessionManager } from '../identity/session-manager';

export interface PendingProjectIntent {
  readonly body: ProjectCreate;
  readonly key: string;
}

export interface ProjectWorkspaceDraft {
  readonly title: string;
  readonly recipient: string;
  readonly year: number;
  readonly preset: string;
  readonly cursorStack: readonly (string | null)[];
  readonly intent?: PendingProjectIntent;
  readonly submitError?: string;
  readonly fieldErrors: Readonly<Record<string, string>>;
}

export const emptyProjectWorkspaceDraft = (): ProjectWorkspaceDraft => ({
  title: '',
  recipient: '',
  year: new Date().getFullYear(),
  preset: '',
  cursorStack: [null],
  fieldErrors: {},
});

let current: { actorId: string; draft: ProjectWorkspaceDraft } | undefined;
let identity: SessionManager | undefined;
let unsubscribeIdentity: (() => void) | undefined;

/** The draft outlives its route, so its identity observer must also outlive that route. */
export function bindProjectWorkspaceDraftIdentity(manager: SessionManager): void {
  if (identity === manager) return;
  unsubscribeIdentity?.();
  identity = manager;
  const clearOnIdentityBoundary = () => {
    const state = manager.getSnapshot();
    if (state.phase === 'unauthenticated' ||
        state.phase === 'authenticated' && current?.actorId !== state.principal?.id) current = undefined;
  };
  clearOnIdentityBoundary();
  unsubscribeIdentity = manager.subscribe(clearOnIdentityBoundary);
}

/** Ephemeral same-tab draft for the account → catalog → selected-design route flow. */
export function readProjectWorkspaceDraft(actorId: string): ProjectWorkspaceDraft {
  if (actorId === 'anonymous') return emptyProjectWorkspaceDraft();
  if (current && current.actorId !== actorId) current = undefined;
  return current?.draft ?? emptyProjectWorkspaceDraft();
}

export function writeProjectWorkspaceDraft(actorId: string, draft: ProjectWorkspaceDraft): void {
  if (current && current.actorId !== actorId) current = undefined;
  current = { actorId, draft: { ...draft, cursorStack: [...draft.cursorStack], fieldErrors: { ...draft.fieldErrors } } };
}

export function clearProjectWorkspaceDraft(actorId: string): void {
  if (current?.actorId === actorId) current = undefined;
}

export function resetProjectWorkspaceDraftStore(): void {
  current = undefined;
  unsubscribeIdentity?.(); unsubscribeIdentity = undefined; identity = undefined;
}
