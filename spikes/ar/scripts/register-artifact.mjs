// Register a MindAR-compiled .mind file against a source version, or compare a re-compile (reproducibility).
//   node scripts/register-artifact.mjs --version A --file ~/Downloads/targets.mind --tool-version <ver>
//   node scripts/register-artifact.mjs --version A --file ~/Downloads/second.mind --check-reproducible
//   node scripts/register-artifact.mjs --combined --order A,B --file ~/Downloads/both.mind --tool-version <ver>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, saveManifest, registerArtifact, registerCombined, checkReproducible } from '../src/manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);

const file = opt('file');
if (!file || !fs.existsSync(file)) {
  console.error('Missing or unreadable --file');
  process.exit(1);
}
const buffer = fs.readFileSync(file);
const manifest = loadManifest(ROOT);
const tool = 'MindAR browser compile tool';
const toolVersion = opt('tool-version') ?? 'unrecorded';

if (flag('combined')) {
  const order = (opt('order') ?? 'A,B').split(',');
  console.log('Registered TEST-ONLY combined artifact:', registerCombined(ROOT, manifest, { buffer, order, tool, toolVersion }));
} else {
  const versionKey = opt('version');
  if (!versionKey) {
    console.error('Missing --version A|B');
    process.exit(1);
  }
  if (flag('check-reproducible')) {
    const r = checkReproducible(manifest, { versionKey, buffer });
    console.log(r.match ? 'MATCH: re-compile is byte-identical' : 'DIFFER: re-compile is NOT byte-identical (record this in evidence)', r);
  } else {
    console.log('Registered:', registerArtifact(ROOT, manifest, { versionKey, buffer, tool, toolVersion }));
  }
}
saveManifest(ROOT, manifest);
