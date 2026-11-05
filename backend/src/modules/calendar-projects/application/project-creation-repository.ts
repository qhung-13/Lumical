import type { TransactionContext } from '../../../platform/database/application/transactions';
import type { PublicTemplateDto } from '../../templates/application/template-catalog';
import type { ProjectIdentity, ProjectRoot } from '../domain/project';

export interface CreationIntent {
  actorId: string;
  key: string;
}

export interface CreatedProject {
  id: string;
}

export interface ProjectCreation extends ProjectIdentity, ProjectRoot {
  revision: PublicTemplateDto['publishedRevision'];
  stylePresetId: string;
}

export abstract class ProjectCreationRepository {
  abstract replay(
    intent: CreationIntent,
    context: TransactionContext,
  ): Promise<{ digest: string; project: CreatedProject } | null>;

  abstract create(
    project: ProjectCreation,
    intent: CreationIntent,
    digest: string,
    context: TransactionContext,
  ): Promise<CreatedProject>;

  abstract isRetryable(error: unknown): boolean;
}
