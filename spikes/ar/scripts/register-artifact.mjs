// Register a MindAR-compiled .mind file against a source version, or compare a re-compile (reproducibility).
//   node scripts/register-artifact.mjs --version A --file ~/Downloads/targets.mind [--tool-version <ver>] [--require-verified]
//   node scripts/register-artifact.mjs --version A --file ~/Downloads/second.mind --check-reproducible
//   node scripts/register-artifact.mjs --combined --order A,B --file ~/Downloads/both.mind [--tool-version <ver>]
//
// Before binding, the source image hash and the file structure are verified. If the bytes cannot be shown to come from the
// source image (for example a browser-tool compile), the artifact is recorded as `manual-unverified`, never as verified.
import fs from 'node:fs';
import { loadManifest, saveManifest, checkReproducible } from '../src/manifest.mjs';
import { ROOT } from '../src/prepare.mjs';
import { verifyAndBind, ProvenanceError } from '../src/provenance.mjs';

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
const tool = 'MindAR browser compile tool (external file)';
const toolVersion = opt('tool-version') ?? 'unrecorded';
const requireVerified = flag('require-verified');

try {
  if (flag('combined')) {
    const order = (opt('order') ?? 'A,B').split(',');
    const c = await verifyAndBind(ROOT, manifest, { kind: 'combined', order, buffer, tool, toolVersion, requireVerified });
    console.log(`Registered TEST-ONLY combined artifact (provenance: ${c.provenance.status}):`, c);
  } else {
    const versionKey = opt('version');
    if (!versionKey) {
      console.error('Missing --version A|B');
      process.exit(1);
    }
    if (flag('check-reproducible')) {
      const r = checkReproducible(manifest, { versionKey, buffer });
      console.log(r.match ? 'MATCH: re-compile is byte-identical in this environment' : 'DIFFER: re-compile is NOT byte-identical (record this in evidence)', r);
    } else {
      const a = await verifyAndBind(ROOT, manifest, { versionKey, buffer, tool, toolVersion, requireVerified });
      console.log(`Registered (provenance: ${a.provenance.status}):`, a);
      if (a.provenance.status === 'manual-unverified') console.warn('WARNING: this artifact is manual-unverified. Do not describe it as verified in evidence.');
    }
  }
} catch (err) {
  if (err instanceof ProvenanceError) {
    console.error(`Refused: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
saveManifest(ROOT, manifest);
