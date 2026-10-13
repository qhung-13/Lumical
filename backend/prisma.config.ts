import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generate/validate/diff do not connect. Migration scripts separately require and validate this URL.
  datasource: { url: process.env.MIGRATION_DATABASE_URL ?? '' },
});
