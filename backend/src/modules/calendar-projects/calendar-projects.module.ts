import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { TemplatesModule } from '../templates/templates.module';
import {
  CALENDAR_TIME_ZONE,
  CreateProject,
} from './application/create-project';
import { ProjectCreationRepository } from './application/project-creation-repository';
import { PrismaProjectCreation } from './infrastructure/prisma-project-creation';

@Module({
  imports: [DatabaseModule, IdentityModule, TemplatesModule],
  providers: [
    CreateProject,
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
  ],
  exports: [CreateProject],
})
export class CalendarProjectsModule {}
