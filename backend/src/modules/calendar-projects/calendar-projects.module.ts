import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { TemplatesModule } from '../templates/templates.module';
import {
  CALENDAR_TIME_ZONE,
  CreateProject,
} from './application/create-project';
import { ProjectCreationRepository } from './application/project-creation-repository';
import { ProjectOwnerService } from './application/project-owner';
import { ProjectRepository } from './application/project-repository';
import { PrismaProjectCreation } from './infrastructure/prisma-project-creation';
import { PrismaProjectRepository } from './infrastructure/prisma-project';
import { ProjectController } from './interface/project.controller';

@Module({
  imports: [DatabaseModule, IdentityModule, TemplatesModule],
  controllers: [ProjectController],
  providers: [
    CreateProject,
    ProjectOwnerService,
    {
      provide: CALENDAR_TIME_ZONE,
      useFactory: () => {
        const timeZone = process.env.CALENDAR_TIME_ZONE ?? 'Asia/Ho_Chi_Minh';
        try {
          return new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions()
            .timeZone;
        } catch {
          throw new Error(
            'CALENDAR_TIME_ZONE must be a valid calendar time zone.',
          );
        }
      },
    },
    { provide: ProjectCreationRepository, useClass: PrismaProjectCreation },
    { provide: ProjectRepository, useClass: PrismaProjectRepository },
  ],
  exports: [CreateProject],
})
export class CalendarProjectsModule {}
