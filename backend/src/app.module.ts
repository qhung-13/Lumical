import { Module } from '@nestjs/common';
import { CalendarProjectsModule } from './modules/calendar-projects/calendar-projects.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { MediaModule } from './modules/media/media.module';
import { MediaCleanup } from './modules/media/application/media-cleanup';
import {
  DURABLE_JOB_HANDLERS,
  DurableJobRunner,
} from './platform/jobs/job-runner';

@Module({
  imports: [
    HealthModule,
    IdentityModule,
    TemplatesModule,
    CalendarProjectsModule,
    MediaModule,
  ],
  providers: [
    DurableJobRunner,
    {
      provide: DURABLE_JOB_HANDLERS,
      useFactory: (media: MediaCleanup) => [media],
      inject: [MediaCleanup],
    },
  ],
})
export class AppModule {}
