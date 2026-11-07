import type { ProjectCreate } from '../../api/projects';

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
}
