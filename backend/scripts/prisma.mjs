import { loadEnvFile } from 'node:process';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
try {
  loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const args = process.argv.slice(2);
if (args[0] === 'migrate') {
  try {
    const value = process.env.MIGRATION_DATABASE_URL;
    const url = new URL(value);
    if (
      !value ||
      value.includes('REPLACE') ||
      !['postgresql:', 'postgres:'].includes(url.protocol) ||
      decodeURIComponent(url.username) !== 'lumical_migration' ||
      !url.password ||
      !url.hostname ||
      !/^\/[^/]+$/.test(url.pathname) ||
      url.searchParams.get('schema') !== 'lumical'
    )
      throw new Error();
  } catch {
    console.error(
      'Set a valid PostgreSQL MIGRATION_DATABASE_URL for lumical_migration (schema=lumical).',
    );
    process.exit(1);
  }
}

if (args[0] === 'migrate' && args[1] === 'deploy') {
  const client = new pg.Client({
    connectionString: process.env.MIGRATION_DATABASE_URL,
    connectionTimeoutMillis: 2_000,
    statement_timeout: 10_000,
  });
  try {
    await client.connect();
    const state = await client.query(`
      SELECT
        to_regclass('lumical._prisma_migrations') IS NOT NULL AS has_history,
        to_regclass('lumical.templates') IS NOT NULL AS has_templates
    `);
    const { has_history, has_templates } = state.rows[0];
    if (has_history && has_templates) {
      const history = await client.query(`
        SELECT migration_name
        FROM lumical._prisma_migrations
        WHERE migration_name IN (
          '20261027000100_template_catalog',
          '20261027000200_template_category_required'
        )
          AND finished_at IS NOT NULL
          AND rolled_back_at IS NULL
      `);
      const applied = new Set(history.rows.map((row) => row.migration_name));
      const categoryMigrationsPending =
        !applied.has('20261027000100_template_catalog') ||
        !applied.has('20261027000200_template_category_required');
      if (categoryMigrationsPending) {
        const templates = await client.query(
          'SELECT EXISTS (SELECT 1 FROM lumical.templates) AS has_rows',
        );
        if (templates.rows[0].has_rows) {
          const backfillTable = await client.query(
            "SELECT to_regclass('lumical.template_category_backfill') AS table_name",
          );
          if (!backfillTable.rows[0].table_name) {
            throw new Error(
              'Refusing migration deploy: legacy Templates exist. Run scripts/prepare-template-category-backfill.sql with the migration role and insert a reviewed category for every Template before retrying.',
            );
          }
          const incomplete = await client.query(`
            SELECT EXISTS (
              SELECT 1 FROM lumical.templates t
              LEFT JOIN lumical.template_category_backfill b ON b.template_id=t.id
              WHERE b.template_id IS NULL
            ) AS has_unmapped,
            EXISTS (
              SELECT 1 FROM lumical.template_category_backfill b
              LEFT JOIN lumical.templates t ON t.id=b.template_id
              WHERE t.id IS NULL OR b.category NOT IN ('GENERAL','BIRTHDAY','ANNIVERSARY','HOLIDAY')
            ) AS has_invalid
          `);
          if (incomplete.rows[0].has_unmapped || incomplete.rows[0].has_invalid) {
            throw new Error(
              'Refusing migration deploy: template_category_backfill must contain exactly one approved category for every existing Template and no stale Template IDs.',
            );
          }
        }
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
  if (process.exitCode) process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['node_modules/prisma/build/index.js', ...args],
  { stdio: 'inherit', env: process.env },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
