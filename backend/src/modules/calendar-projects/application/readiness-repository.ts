import type { TransactionContext } from '../../../platform/database/application/transactions';
import type { ReadinessSnapshot } from '../domain/readiness';
import type { ProjectRecord } from './project-repository';

export abstract class ReadinessRepository {
  // Must use the caller's authoritative transaction, not independent frontend
  // reads. No provider work, jobs, content writes or review creation here.
  abstract read(
    project: ProjectRecord,
    context: TransactionContext,
  ): Promise<ReadinessSnapshot>;
}
