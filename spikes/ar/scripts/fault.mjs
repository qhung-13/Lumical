// Simulate a preparation failure on the server for a device run (P02 "preparation failure" case).
//   node scripts/fault.mjs corrupt --version A   flip one byte of A's registered artifact (hash no longer matches)
//   node scripts/fault.mjs missing --version A   move A's registered artifact away
//   node scripts/fault.mjs restore --version A   undo
// The manifest hash is left untouched, so the server must answer UNAVAILABLE and the camera-free view must still work.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest } from '../src/manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [mode, flag, key] = process.argv.slice(2);
const art = loadManifest(ROOT).versions[key]?.artifact;
if (!['corrupt', 'missing', 'restore'].includes(mode) || flag !== '--version' || !art) {
  console.error('Usage: node scripts/fault.mjs corrupt|missing|restore --version A|B');
  process.exit(1);
}
const file = path.join(ROOT, art.file);
const backup = `${file}.bak`;
if (mode === 'restore') {
  if (!fs.existsSync(backup)) { console.error('Nothing to restore.'); process.exit(1); }
  fs.rmSync(file, { force: true });
  fs.renameSync(backup, file);
  console.log(`restored ${art.file}`);
} else {
  if (fs.existsSync(backup)) { console.error('A fault is already active. Run restore first.'); process.exit(1); }
  fs.copyFileSync(file, backup);
  if (mode === 'missing') fs.rmSync(file);
  else { const b = fs.readFileSync(file); b[b.length >> 1] ^= 0xff; fs.writeFileSync(file, b); }
  console.log(`${mode} applied to ${art.file}; restart not required, run restore when done`);
}
