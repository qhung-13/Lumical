import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { TemplatesModule } from './modules/templates/templates.module';

@Module({
  imports: [HealthModule, IdentityModule, TemplatesModule],
})
export class AppModule {}
