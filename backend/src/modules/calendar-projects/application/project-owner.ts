import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { TransactionContext } from '../../../platform/database/application/transactions';
import { ActiveAccounts, Clock } from '../../identity/application/ports';
import {
  type ActiveAccountPrincipal,
} from '../../identity/domain/identity';
import { CreateProject } from './create-project';
import {
  ProjectError,
  applyProjectPatch,
  assertProjectAction,
  assertProjectDeletionEligible,
  assertProjectOwner,
  encodeProjectCursor,
  projectListInput,
  projectStatusAfter,
  projectView,
  type ProjectListQuery,
  type ProjectView,
} from '../domain/project';
import {
  assertProjectVersion,
  projectDeletionConfirmation,
  projectPatch,
} from './project-contracts';
import {
  ProjectRepository,
  type ProjectMonthRecord,
} from './project-repository';

// The authentication boundary's request shape. Identity owns cookies, CSRF and
// Origin; this module only forwards them.
export interface ProjectBrowserContext {
  readonly secret?: string;
  readonly csrf?: string;
  readonly origin?: string;
}

export interface ProjectPage {
  readonly data: ProjectView[];
  readonly meta: { readonly nextCursor: string | null; readonly hasMore: boolean };
}

export interface ProjectMonthsView {
  readonly projectVersion: number;
  readonly months: ProjectMonthRecord[];
}

export interface ProjectDetailView extends ProjectView {
  readonly deletionEligible: boolean;
}

// A race is worth restarting; a refusal from Identity, the domain or the
// contract is a truthful answer that must reach the client unchanged.
function restartable(error: unknown): boolean {
  if (error instanceof ProjectError || error instanceof HttpException)
    return false;
  if (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  )
    return false;
  const code =
    error && typeof error === 'object' && 'code' in error
      ? error.code
      : undefined;
  const metadata =
    error && typeof error === 'object' && 'meta' in error ? error.meta : undefined;
  const raw =
    metadata && typeof metadata === 'object'
      ? (metadata as {
          code?: unknown;
          driverAdapterError?: { cause?: { originalCode?: unknown } };
        })
      : undefined;
  const sqlCode = raw?.code ?? raw?.driverAdapterError?.cause?.originalCode;
  if (code === 'P2034') return true;
  return (
    code === 'P2010' && (sqlCode === '40001' || sqlCode === '40P01')
  );
}

// §12: a mutation carries the ETag of the state it was decided on. An absent
// precondition is a domain decision (428); a malformed one is a bad request.
function expectedVersion(etag: string | undefined): number | undefined {
  if (etag === undefined) return undefined;
  const match = /^"([1-9][0-9]*)"$/.exec(etag);
  if (!match || !Number.isSafeInteger(Number(match[1])))
    throw new ProjectError('VALIDATION_FAILED');
  return Number(match[1]);
}

@Injectable()
export class ProjectOwnerService {
  constructor(
    @Inject(ActiveAccounts) private readonly accounts: ActiveAccounts,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(ProjectRepository) private readonly repository: ProjectRepository,
    @Inject(CreateProject) private readonly creation: CreateProject,
  ) {}

  // Authentication, CSRF and Origin are re-checked on every attempt because a
  // restarted transaction restarts the whole workflow with it.
  private async run<T>(
    browser: ProjectBrowserContext,
    mutation: boolean,
    work: (
      actor: ActiveAccountPrincipal,
      context: TransactionContext,
    ) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.accounts.withActiveAccount(browser, mutation, work);
      } catch (error) {
        if (attempt >= 3 || !restartable(error)) throw error;
      }
    }
  }

  async list(
    input: unknown,
    browser: ProjectBrowserContext,
  ): Promise<ProjectPage> {
    const query: ProjectListQuery = projectListInput(input);
    return this.run(browser, false, async (actor, context) => {
      const rows = await this.repository.list(
        actor.id,
        { state: query.state, after: query.after, take: query.limit + 1 },
        context,
      );
      const hasMore = rows.length > query.limit;
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return {
        data: page.map(projectView),
        meta: {
          nextCursor:
            hasMore && last
              ? encodeProjectCursor({ createdAt: last.createdAt, id: last.id })
              : null,
          hasMore,
        },
      };
    });
  }

  async get(
    id: string,
    browser: ProjectBrowserContext,
  ): Promise<ProjectDetailView> {
    return this.run(browser, false, async (actor, context) => {
      const record = await this.repository.find(actor.id, id, context);
      if (!record) throw new ProjectError('NOT_FOUND');
      assertProjectOwner(actor, record);
      const history = await this.repository.orderHistory(actor.id, id, context);
      return { ...projectView(record), deletionEligible: history === 'NEVER_ORDERED' };
    });
  }

  async months(
    id: string,
    browser: ProjectBrowserContext,
  ): Promise<ProjectMonthsView> {
    return this.run(browser, false, async (actor, context) => {
      const record = await this.repository.find(actor.id, id, context);
      if (!record) throw new ProjectError('NOT_FOUND');
      assertProjectOwner(actor, record);
      const months = await this.repository.months(actor.id, id, context);
      return { projectVersion: record.version, months };
    });
  }

  // POST /projects: P02 owns the atomic baseline write, this read renders the
  // created Project as the contract's 201 body.
  async create(
    input: unknown,
    key: string | undefined,
    browser: ProjectBrowserContext,
  ): Promise<ProjectView> {
    // §11: the same Idempotency-Key vocabulary identity and Admin templates use.
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key))
      throw new ProjectError('VALIDATION_FAILED');
    const created = await this.creation.execute(browser, input, key);
    // §11: the replay returns the outcome this intent bound, not the row as it
    // happens to be now, so the answer comes from the creation transaction.
    return created.view;
  }

  async patch(
    id: string,
    input: unknown,
    etag: string | undefined,
    browser: ProjectBrowserContext,
  ): Promise<ProjectView> {
    const patch = projectPatch(input);
    if (Object.keys(patch).length === 0)
      throw new ProjectError('VALIDATION_FAILED');
    const expected = expectedVersion(etag);
    return this.run(browser, true, async (actor, context) => {
      const target = await this.repository.lock(actor.id, id, context);
      if (!target) throw new ProjectError('NOT_FOUND');
      assertProjectVersion(target, expected);
      // BR-PRJ-005: Archived is read-only, so identity edits stop here.
      assertProjectAction(actor, target, 'EDIT');
      const values = applyProjectPatch(target, target.stylePresets, patch);
      const updated = await this.repository.patch(
        actor.id,
        id,
        values,
        this.clock.now(),
        context,
      );
      return projectView(updated);
    });
  }

  async archive(
    id: string,
    etag: string | undefined,
    browser: ProjectBrowserContext,
  ): Promise<ProjectView> {
    return this.transition(id, etag, 'ARCHIVE', browser);
  }

  async restore(
    id: string,
    etag: string | undefined,
    browser: ProjectBrowserContext,
  ): Promise<ProjectView> {
    return this.transition(id, etag, 'RESTORE', browser);
  }

  private async transition(
    id: string,
    etag: string | undefined,
    action: 'ARCHIVE' | 'RESTORE',
    browser: ProjectBrowserContext,
  ): Promise<ProjectView> {
    const expected = expectedVersion(etag);
    return this.run(browser, true, async (actor, context) => {
      const target = await this.repository.lock(actor.id, id, context);
      if (!target) throw new ProjectError('NOT_FOUND');
      assertProjectVersion(target, expected);
      const status = projectStatusAfter(actor, target, action);
      // §17: repeated desired state is safe — it answers 200 and writes nothing.
      if (target.status === status) return projectView(target);
      const updated = await this.repository.setStatus(
        actor.id,
        id,
        status,
        this.clock.now(),
        context,
      );
      return projectView(updated);
    });
  }

  async remove(
    id: string,
    input: unknown,
    etag: string | undefined,
    browser: ProjectBrowserContext,
  ): Promise<void> {
    projectDeletionConfirmation(input);
    const expected = expectedVersion(etag);
    await this.run(browser, true, async (actor, context) => {
      const target = await this.repository.lock(actor.id, id, context);
      if (!target) throw new ProjectError('NOT_FOUND');
      assertProjectVersion(target, expected);
      const history = await this.repository.orderHistory(
        actor.id,
        id,
        context,
      );
      assertProjectDeletionEligible(actor, target, history);
      await this.repository.remove(actor.id, id, context);
    });
  }
}
