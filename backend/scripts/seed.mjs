import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  PrismaDatabase,
} = require('../dist/platform/database/infrastructure/prisma-database.js');
const {
  seedSynthetic,
} = require('../dist/platform/database/infrastructure/synthetic-seed.js');
const database = new PrismaDatabase();
try {
  await seedSynthetic(database);
  console.log(
    'Synthetic seed complete (disabled accounts; no provider fixtures).',
  );
} finally {
  await database.onModuleDestroy();
}
