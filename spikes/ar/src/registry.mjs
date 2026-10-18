// Synthetic authorized scope for the spike. NOT final security (that is I02/I11/I12).
// Rules exercised here: recognition is never authorization (INV-08), no global target -> media lookup,
// every failure of scope looks identical (fail closed), fallback works without any artifact.
import fs from 'node:fs';
import path from 'node:path';
import { sha256, shortArtifactId } from './manifest.mjs';

import { buildContent } from './content.mjs';

// An artifact registered before provenance was recorded is treated as unverified, never as verified.
const provenanceOf = (artifact) => artifact?.provenance?.status ?? 'manual-unverified';

export const NOT_FOUND = Object.freeze({ status: 404, body: { code: 'NOT_FOUND' } });
const UNAVAILABLE = Object.freeze({ status: 503, body: { code: 'UNAVAILABLE' } });

export function createRegistry({ manifest, rootDir, sessions, enableCombined = false }) {
  // sessions: [{ token, versionKey }] -> stored only as hashes of tokens.
  const byTokenHash = new Map(sessions.map((s) => [sha256(Buffer.from(s.token)), s.versionKey]));
  const lookup = (token) => (typeof token === 'string' && token ? byTokenHash.get(sha256(Buffer.from(token))) ?? null : null);

  /** Artifacts this version's session may touch. Never another version's. */
  function allowedEntries(versionKey) {
    const list = [];
    const own = manifest.versions[versionKey]?.artifact;
    if (own) list.push({ ...own, expectedIndex: 0, targetCount: 1, kind: 'version' });
    const combined = manifest.combined;
    if (enableCombined && combined && Number.isInteger(combined.targets?.[versionKey])) {
      list.push({ ...combined, expectedIndex: combined.targets[versionKey], targetCount: Object.keys(combined.targets).length, kind: 'combined' });
    }
    return list;
  }

  /** Preparation failure => UNAVAILABLE: file missing or bytes differ from the recorded hash. */
  function readArtifact(entry) {
    try {
      const buffer = fs.readFileSync(path.join(rootDir, entry.file));
      return sha256(buffer) === entry.sha256 ? { ok: true, buffer } : { ok: false };
    } catch {
      return { ok: false };
    }
  }

  return {
    describeSession(token) {
      const v = lookup(token);
      if (!v) return NOT_FOUND;
      const own = manifest.versions[v]?.artifact;
      const entries = allowedEntries(v);
      return {
        status: 200,
        body: {
          scopeLabel: v, // harness-only convenience so the tester knows which link they opened
          version: own ? { artifactId: own.artifactId, shortId: shortArtifactId(own.artifactId), provenance: provenanceOf(own), targetCount: 1, status: readArtifact(own).ok ? 'READY' : 'UNAVAILABLE' } : { artifactId: null, targetCount: 1, status: 'UNAVAILABLE' },
          combined: entries.find((e) => e.kind === 'combined')
            ? (() => {
                const c = entries.find((e) => e.kind === 'combined');
                return { artifactId: c.artifactId, shortId: shortArtifactId(c.artifactId), provenance: provenanceOf(c), targetCount: c.targetCount, status: readArtifact(c).ok ? 'READY' : 'UNAVAILABLE', testOnly: true };
              })()
            : null,
        },
      };
    },

    fetchArtifact(token, artifactId) {
      const v = lookup(token);
      if (!v) return NOT_FOUND;
      const entry = allowedEntries(v).find((e) => e.artifactId === artifactId);
      if (!entry) return NOT_FOUND; // other version's artifact looks identical to a nonexistent one
      const art = readArtifact(entry);
      return art.ok ? { status: 200, buffer: art.buffer } : UNAVAILABLE;
    },

    /** Recognition evidence (artifactId + targetIndex) is only an input; scope decides. */
    reveal(token, input) {
      const v = lookup(token);
      if (!v || !input || typeof input.artifactId !== 'string' || !Number.isInteger(input.targetIndex)) return NOT_FOUND;
      const entry = allowedEntries(v).find((e) => e.artifactId === input.artifactId);
      if (!entry || entry.expectedIndex !== input.targetIndex) return NOT_FOUND;
      if (!readArtifact(entry).ok) return UNAVAILABLE;
      return { status: 200, body: buildContent(v) };
    },

    /** Camera-free path (BR-AR-004): same content, independent of any artifact. */
    fallbackContent(token) {
      const v = lookup(token);
      return v ? { status: 200, body: buildContent(v) } : NOT_FOUND;
    },
  };
}
