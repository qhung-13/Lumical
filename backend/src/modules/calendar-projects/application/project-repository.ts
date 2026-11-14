import type { TransactionContext } from '../../../platform/database/application/transactions';
import type { ARWrite, EventWrite, MonthPatch } from '../domain/personalization';
import type {
  ProjectFacts,
  ProjectOrderHistory,
  ProjectStatus,
} from '../domain/project';

// One owned Project as stored, plus the approved presets of the revision it
// captured. `stylePresets` is read for validation only and never projected.
export interface ProjectRecord extends ProjectFacts {
  readonly ownerId: string;
  readonly stylePresets: unknown;
}

export interface ProjectListInput {
  readonly state?: ProjectStatus;
  readonly after?: { readonly createdAt: Date; readonly id: string };
  readonly take: number;
}

export interface ProjectIdentityValues {
  readonly title?: string;
  readonly recipientName?: string;
  readonly stylePresetId?: string;
}

export interface ProjectMonthRecord extends MonthPatch {
  readonly monthNumber: number;
}

export interface SpecialDateRecord extends EventWrite {
  readonly id: string;
}

export interface ProjectIntent {
  readonly actorId: string;
  readonly operation: 'SPECIAL_DATE_CREATE' | 'PROJECT_AR_WRITE';
  readonly key: string;
}

export interface ProjectIntentResult {
  readonly resourceId: string;
  readonly projectVersion: number;
}

export class ConcurrentProjectIntent extends Error {}

// Every method is owner-scoped: a Project belonging to someone else is the same
// as a Project that does not exist, so no method can report one (API contract §13).
export abstract class ProjectRepository {
  abstract list(
    ownerId: string,
    input: ProjectListInput,
    context: TransactionContext,
  ): Promise<ProjectRecord[]>;

  abstract find(
    ownerId: string,
    id: string,
    context: TransactionContext,
  ): Promise<ProjectRecord | null>;

  // Row lock for the read/compare/increment cycle of §12.
  abstract lock(
    ownerId: string,
    id: string,
    context: TransactionContext,
  ): Promise<ProjectRecord | null>;

  abstract patch(
    ownerId: string,
    id: string,
    values: ProjectIdentityValues,
    now: Date,
    context: TransactionContext,
  ): Promise<ProjectRecord>;

  abstract setStatus(
    ownerId: string,
    id: string,
    status: ProjectStatus,
    now: Date,
    context: TransactionContext,
  ): Promise<ProjectRecord>;

  // Removes the Project and its project-scoped rows in dependency order.
  // Media assets belong to the account and are never touched here.
  abstract remove(
    ownerId: string,
    id: string,
    context: TransactionContext,
  ): Promise<void>;

  abstract orderHistory(
    ownerId: string,
    id: string,
    context: TransactionContext,
  ): Promise<ProjectOrderHistory>;

  abstract advanceVersion(
    project: ProjectRecord, now: Date, context: TransactionContext,
  ): Promise<number>;

  abstract replaceMonth(
    project: ProjectRecord, number: number, patch: MonthPatch, context: TransactionContext,
  ): Promise<ProjectMonthRecord>;

  abstract specialDates(project: ProjectRecord, context: TransactionContext): Promise<SpecialDateRecord[]>;

  abstract saveSpecialDate(
    project: ProjectRecord, input: EventWrite, id: string | undefined, context: TransactionContext,
  ): Promise<string>;

  abstract deleteSpecialDate(project: ProjectRecord, id: string, context: TransactionContext): Promise<void>;

  abstract saveAR(
    project: ProjectRecord, input: ARWrite, now: Date, context: TransactionContext,
  ): Promise<ProjectIntentResult>;

  abstract deleteAR(project: ProjectRecord, now: Date, context: TransactionContext): Promise<boolean>;

  abstract replayIntent(intent: ProjectIntent, context: TransactionContext):
    Promise<(ProjectIntentResult & { digest: string }) | null>;

  abstract completeIntent(
    intent: ProjectIntent, digest: string, result: ProjectIntentResult, context: TransactionContext,
  ): Promise<void>;

  abstract months(
    ownerId: string,
    id: string,
    context: TransactionContext,
  ): Promise<ProjectMonthRecord[]>;
}
