import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module.js');
const { openApiDocument } = require('../dist/platform/http/openapi.js');
const app = await NestFactory.create(AppModule, { logger: false });
try {
  app.setGlobalPrefix('api/v1');
  const document = openApiDocument(app);
  const result = JSON.stringify(document, null, 2) + '\n';
  const file = new URL('../openapi.json', import.meta.url);
  if (process.argv.includes('--check')) {
    if (await readFile(file, 'utf8') !== result) throw new Error('OpenAPI drift: run pnpm contract:generate.');
    console.log('PASS: backend HTTP OpenAPI matches the reviewed artifact.');
  } else { await writeFile(file, result); console.log('Generated backend HTTP OpenAPI.'); }
} finally { await app.close(); }
