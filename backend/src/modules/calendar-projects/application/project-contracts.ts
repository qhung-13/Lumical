import {
  newProject,
  projectName,
  ProjectError,
  type ActiveProjectAccount,
  type ProjectIdentity,
  type ProjectIdentityInput,
  type ProjectRoot,
} from '../domain/project';

interface ProjectClock {
  now(): Date;
}

// P02 captures the active published baseline and persists this root with Months 1–12 atomically.
export function prepareProjectCreation(
  account: ActiveProjectAccount,
  input: ProjectIdentityInput,
  clock: ProjectClock,
  calendarTimeZone: string,
): ProjectIdentity & ProjectRoot {
  // The caller supplies the product calendar zone, independently of the host's time zone.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: calendarTimeZone,
    calendar: 'gregory',
    year: 'numeric',
    era: 'short',
  }).formatToParts(clock.now());
  const year = Number(parts.find(({ type }) => type === 'year')?.value);
  const isCommonEra = parts.some(
    ({ type, value }) => type === 'era' && value === 'AD',
  );
  return newProject(account, input, isCommonEra ? year : 1 - year);
}

export interface ProjectPatch {
  title?: string;
  recipientName?: string;
  stylePresetId?: string;
}

function requestFields(
  input: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.includes(key))
  ) {
    throw new ProjectError('VALIDATION_FAILED');
  }
  return input as Record<string, unknown>;
}

export function projectPatch(input: unknown): ProjectPatch {
  const value = requestFields(input, [
    'title',
    'recipientName',
    'stylePresetId',
  ]);
  const patch: ProjectPatch = {};
  if (Object.hasOwn(value, 'title'))
    patch.title = projectName(value.title, 'title');
  if (Object.hasOwn(value, 'recipientName'))
    patch.recipientName = projectName(value.recipientName, 'recipientName');
  if (Object.hasOwn(value, 'stylePresetId')) {
    if (typeof value.stylePresetId !== 'string')
      throw new ProjectError('VALIDATION_FAILED', 'stylePresetId');
    // Membership is checked against the Project's captured baseline when applying this patch.
    patch.stylePresetId = value.stylePresetId;
  }
  return patch;
}

// P03 checks confirmation at the request boundary and rechecks eligibility under the Project-root lock.
export function projectDeletionConfirmation(input: unknown): {
  confirmed: true;
} {
  const value = requestFields(input, ['confirmed']);
  if (!Object.hasOwn(value, 'confirmed') || value.confirmed !== true) {
    throw new ProjectError('VALIDATION_FAILED', 'confirmed');
  }
  return { confirmed: true };
}

// P02 checks the authorized root and advances its version in the same transaction as any
// root or child change. P03 maps missing/stale If-Match to 428/412 after authorization.
export function assertProjectVersion(
  root: ProjectRoot,
  expectedVersion: number | undefined,
): void {
  if (expectedVersion === undefined)
    throw new ProjectError('PRECONDITION_REQUIRED');
  if (expectedVersion !== root.version)
    throw new ProjectError('VERSION_CONFLICT', undefined, root.version);
}
