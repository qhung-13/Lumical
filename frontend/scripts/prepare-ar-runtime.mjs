// Serve only the pinned image runtime and its local chunks, never a CDN or face runtime.
import { createRequire } from 'node:module';
import { readFile, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('mind-ar/package.json'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (pkg.version !== '1.2.5') throw new Error('Reviewed MindAR runtime version changed');
const dist = join(root, 'dist');
const out = new URL('../public/ar-runtime/vendor/', import.meta.url);
await mkdir(out, { recursive: true });
const seen = new Set();
async function copy(name) {
  if (seen.has(name)) return;
  if (!/^[\w.-]+\.js$/.test(name) || name.includes('face')) throw new Error('Unexpected runtime import');
  seen.add(name);
  const code = await readFile(join(dist, name), 'utf8');
  await copyFile(join(dist, name), new URL(name, out));
  for (const match of code.matchAll(/from\s*["']\.\/([^"']+)["']/g)) await copy(match[1]);
}
await copy('mindar-image.prod.js');
await copyFile(join(root, 'LICENSE'), new URL('MINDAR-LICENSE', out));
await writeFile(new URL('NOTICE', out), 'MindAR 1.2.5 (MIT). Bundled TensorFlow.js portions retain Apache-2.0 license notices in the distributed JavaScript. No compiler is used by the scanner.\n');
