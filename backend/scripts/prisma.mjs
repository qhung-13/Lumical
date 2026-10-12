import { loadEnvFile } from 'node:process';
import { spawnSync } from 'node:child_process';
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
const result = spawnSync(
  process.execPath,
  ['node_modules/prisma/build/index.js', ...args],
  { stdio: 'inherit', env: process.env },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
