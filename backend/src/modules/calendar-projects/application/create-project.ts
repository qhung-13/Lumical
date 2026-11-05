import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ActiveAccounts, Clock } from '../../identity/application/ports';
import { PublicTemplateCatalog } from '../../templates/application/template-catalog';
import { projectName, ProjectError } from '../domain/project';
import { prepareProjectCreation } from './project-contracts';
import {
  ProjectCreationRepository,
  type CreatedProject,
} from './project-creation-repository';

export const CALENDAR_TIME_ZONE = Symbol('CALENDAR_TIME_ZONE');
// Leave room in the composite PostgreSQL B-tree index for the actor and operation.
const maxIdempotencyKeyBytes = 1024;
const requestKeys = [
  'templateId',
  'title',
  'year',
  'recipientName',
  'stylePresetId',
];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function canonicalRequest(input: unknown) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== requestKeys.length ||
    !requestKeys.every((key) => Object.hasOwn(input, key))
  ) {
    throw new ProjectError('VALIDATION_FAILED');
  }
  const { templateId, title, year, recipientName, stylePresetId } =
    input as Record<string, unknown>;
  if (typeof templateId !== 'string' || !uuid.test(templateId))
    throw new ProjectError('VALIDATION_FAILED');
  if (
    typeof year !== 'number' ||
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999
  )
    throw new ProjectError('VALIDATION_FAILED', 'year');
  if (typeof stylePresetId !== 'string' || !stylePresetId)
    throw new ProjectError('VALIDATION_FAILED', 'stylePresetId');
  return {
    templateId: templateId.toLowerCase(),
    title: projectName(title, 'title'),
    year,
    recipientName: projectName(recipientName, 'recipientName'),
    stylePresetId,
  };
}

@Injectable()
export class CreateProject {
  constructor(
    @Inject(ActiveAccounts) private readonly accounts: ActiveAccounts,
    @Inject(PublicTemplateCatalog)
    private readonly templates: PublicTemplateCatalog,
    @Inject(ProjectCreationRepository)
    private readonly repository: ProjectCreationRepository,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(CALENDAR_TIME_ZONE) private readonly calendarTimeZone: string,
  ) {}

  async execute(
    authentication: Parameters<ActiveAccounts['withActiveAccount']>[0],
    input: unknown,
    key: string | undefined,
  ): Promise<CreatedProject> {
    const now = this.clock.now();
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.accounts.withActiveAccount(
          authentication,
          true,
          async (actor, context) => {
            if (
              typeof key !== 'string' ||
              !key.trim() ||
              !key.isWellFormed() ||
              /\p{Cc}/u.test(key) ||
              Buffer.byteLength(key, 'utf8') > maxIdempotencyKeyBytes
            )
              throw new ProjectError('VALIDATION_FAILED');
            const request = canonicalRequest(input);
            const digest = createHash('sha256')
              .update(JSON.stringify(request))
              .digest('hex');
            const intent = { actorId: actor.id, key };
            const replay = await this.repository.replay(intent, context);
            if (replay) {
              if (replay.digest !== digest)
                throw new ProjectError('IDEMPOTENCY_CONFLICT');
              return replay.project;
            }

            // Creation-time eligibility applies only to a new intent.
            const root = prepareProjectCreation(
              actor,
              request,
              { now: () => now },
              this.calendarTimeZone,
            );
            const template = await this.templates.findAvailable(
              request.templateId,
              context,
            );
            if (!template) throw new ProjectError('TEMPLATE_UNAVAILABLE');
            const revision = template.publishedRevision;
            if (
              !revision.presets.some(({ id }) => id === request.stylePresetId)
            )
              throw new ProjectError('VALIDATION_FAILED', 'stylePresetId');
            return this.repository.create(
              { ...root, revision, stylePresetId: request.stylePresetId },
              intent,
              digest,
              context,
            );
          },
        );
      } catch (error) {
        // Restart the entire transaction, including active-account authorization.
        if (attempt >= 3 || !this.repository.isRetryable(error)) throw error;
      }
    }
  }
}
