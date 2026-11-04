import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
// ActiveAccounts is IdentityModule's documented export: authentication supplies a principal,
// and TemplatesModule owns the Admin check that follows it.
import { IdentityModule } from '../identity/identity.module';
import { PublicTemplateCatalog, TEMPLATE_CATALOG } from './application/template-catalog';
import { TemplateAdminRepository } from './application/ports';
import { TemplateAdminService } from './application/template-admin';
import { PrismaTemplateCatalog } from './infrastructure/prisma-template-catalog';
import { PrismaTemplateAdminRepository } from './infrastructure/prisma-template-admin';
import { TemplateController } from './interface/template.controller';
import { AdminTemplateController } from './interface/admin-template.controller';

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [TemplateController, AdminTemplateController],
  providers: [PublicTemplateCatalog, PrismaTemplateCatalog, { provide: TEMPLATE_CATALOG, useExisting: PrismaTemplateCatalog },
    PrismaTemplateAdminRepository, { provide: TemplateAdminRepository, useExisting: PrismaTemplateAdminRepository },
    TemplateAdminService],
})
export class TemplatesModule {}
