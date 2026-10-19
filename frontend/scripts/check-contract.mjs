import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const frontend = fileURLToPath(new URL('..', import.meta.url));
const directory = await mkdtemp(path.join(tmpdir(), 'lumical-i02-contract-'));
try {
  const generated = path.join(directory, 'generated.ts');
  await promisify(execFile)(process.execPath, [path.join(frontend, 'node_modules/openapi-typescript/bin/cli.js'),
    path.resolve(frontend, '../backend/openapi.json'), '-o', generated]);
  const expected = await readFile(path.join(frontend, 'src/api/generated.ts'), 'utf8');
  assert.equal((await readFile(generated, 'utf8')).replaceAll('\r\n', '\n'), expected.replaceAll('\r\n', '\n'), 'Generated frontend contract drift: run pnpm contract:generate.');
  console.log('PASS: frontend types derive from the current backend OpenAPI.');
} finally {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
  assert.ok(path.basename(resolved).startsWith('lumical-i02-contract-'));
  await rm(resolved, { recursive: true });
}
