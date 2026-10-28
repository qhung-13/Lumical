import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { PublicTemplateCatalog, TEMPLATE_CATALOG } from './application/template-catalog';
import { PrismaTemplateCatalog } from './infrastructure/prisma-template-catalog';
import { TemplateController } from './interface/template.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [TemplateController],
  providers: [PublicTemplateCatalog, PrismaTemplateCatalog, { provide: TEMPLATE_CATALOG, useExisting: PrismaTemplateCatalog }],
})
export class TemplatesModule {}
