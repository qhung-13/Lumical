import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DatabaseConfigurationError,
  runtimeDatabaseUrl,
} from '../../../config/database';
import { DatabaseAvailability } from '../application/database-availability';
import { PrismaClient } from './generated/client';

@Injectable()
export class PrismaDatabase
  extends DatabaseAvailability
  implements OnModuleDestroy
{
  private readonly database?: PrismaClient;

  constructor() {
    super();
    try {
      const connectionString = runtimeDatabaseUrl(process.env.DATABASE_URL);
      this.database = new PrismaClient({
        adapter: new PrismaPg(
          {
            connectionString,
            max: 5,
            connectionTimeoutMillis: 2000,
            statement_timeout: 2000,
            query_timeout: 2000,
          },
          { schema: 'lumical' },
        ),
      });
    } catch (error) {
      if (!(error instanceof DatabaseConfigurationError)) throw error;
      // Fail closed: only technical liveness remains available; readiness is 503.
    }
  }

  get client(): PrismaClient {
    if (!this.database) throw new DatabaseConfigurationError();
    return this.database;
  }

  async isReady(): Promise<boolean> {
    if (!this.database) return false;
    try {
      // LIMIT 0 checks schema/table SELECT permission without reading private
      // rows. Catalog visibility alone also permits INSERT-only principals.
      await this.database.$queryRaw`SELECT 1 FROM lumical.users LIMIT 0`;
      const result = await this.database.$queryRaw<{ ready: boolean }[]>`
        SELECT count(*) = 30 AS ready
        FROM information_schema.tables
        WHERE table_schema = 'lumical'
          AND table_type = 'BASE TABLE'
          AND table_name IN (
            'users','sessions','templates','template_revisions','calendar_projects',
            'calendar_months','media_assets','project_month_media','special_dates',
            'ar_target_artifacts','project_ar_experiences','checkout_intents','orders',
            'order_calendar_versions','order_month_snapshots','order_special_date_snapshots',
            'order_media_references','order_ar_snapshots','payment_attempts','payment_operations',
            'payment_settlements','fulfillments','fulfillment_events','recipient_shares',
            'recipient_access_sessions','admin_content_access','admin_audit_events',
            'idempotency_records','provider_event_inbox','job_records'
          )
      `;
      return result[0]?.ready === true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.database?.$disconnect();
  }
}
