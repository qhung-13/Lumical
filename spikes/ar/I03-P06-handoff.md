# I03-P06 — Selected spike reproduction and handoff

- Item: [I03 Early AR Technology Spike](../../planning/I03-early-ar-technology-spike.md#i03-p06)
- Task: I03-P06 (owner MEMBER_3, reviewer LEAD). Depends on [I03-P05](I03-P05-ar-technology-recommendation.md).
- Status: **IN PROGRESS. Handoff prepared; independent reproduction NOT done.** Nothing in this file is a pass result.
- Started on LEAD's instruction to the owner (reported by the owner on 2026-10-22). In `dev`, I03-P05 is still
  **PROVISIONAL** and its section 13 gates are unchecked, and its section 15 says P06 is not yet unlocked. This handoff is
  therefore conditional: it describes the provisional direction (MindAR image tracking) and must be re-read against the
  final P05 decision before any I07/I08/I12 work depends on it. LEAD should record the unlock in the P05 record or the planning status.
- Out of scope (planning): a product-ready scanner, final recipient integration, and acceptance by recording alone.

## 1. What is being handed off

The isolated harness in `spikes/ar/` (not part of the pnpm workspace, no change to `frontend/`, `backend/` or `docs/`):
a Node server with version-scoped reveal, prepared MindAR targets compiled in Node, a scanner page, a camera-free page,
tests and evidence templates. Entry points: [README](README.md), [review](I03-P04-privacy-fallback-port-review.md),
[port sketch](port/ar-provider-port.ts), [P03 matrix](evidence/I03-P03-device-browser-camera-matrix.md).

It is a **baseline to reproduce**, not code to copy into production. Items that must not become production contracts are
listed in section 5.

## 2. Evidence the baseline rests on (no new claims here)

| Area | Source | Status |
| --- | --- | --- |
| Candidate comparison | [P01](I03-P01-candidate-evaluation.md) | Documented research |
| Harness behavior, scoped reveal, fallback, provenance | [README](README.md), tests under `test/` | Tests are integration checks, not AR evidence |
| Desktop device observations, denial failure, resolution sensitivity | [P03 matrix](evidence/I03-P03-device-browser-camera-matrix.md) | Desktop, synthetic camera; mobile rows not tested |
| Privacy and fallback review, findings | [P04 review](I03-P04-privacy-fallback-port-review.md) | Static; no real network trace |
| Provisional recommendation and gates | [P05](I03-P05-ar-technology-recommendation.md) | PROVISIONAL |
| Owner smoke check | The owner reported that the camera opened and scanning started on a desktop browser and on an Android phone over an HTTPS tunnel | **Not recorded evidence.** Device models, browser versions and results were not written down; it does not count as P03 or P06 acceptance |

## 3. Reproduction procedure (for the independent reproducer)

Run on the reproducer's own machine and phone. The author must not be the reproducer.

1. Fresh clone of the commit under test; record the commit hash, OS, CPU architecture, `node -v` and `npm -v`.
2. `cd spikes/ar`, then `npm ci --ignore-scripts`, `npm audit`, `npm test`. Record the counts and any failure. Do not run `npm audit fix`.
3. Clean artifacts: in a scratch copy delete `artifacts/*.mind` and run `npm run compile -- --force`. Compare each new artifact id with the committed one and record MATCH or DIFFER with the environment. DIFFER is a valid result; it limits reproducibility claims to the recorded toolchain.
4. In `fixtures/manifest.json` confirm the provenance of A, B and the combined (test-only) artifact is `built-from-verified-source`.
5. Start the server with your own tokens (at least 16 URL-safe characters) and `SPIKE_ENABLE_COMBINED=1`; open an HTTPS tunnel to `http://127.0.0.1:8787`. Never reuse tokens that appeared in chat, PRs or earlier evidence.
6. On a real phone, with the targets from `fixtures/targets/` on a second screen or printed, run these cases:

| # | Case | Expected | Record |
| --- | --- | --- | --- |
| 1 | Session A, per-version artifact, scan `version-a.png`, lose and re-find it repeatedly | Card A each time; hidden when the target is lost | Successes / attempts, light, distance, orientation |
| 2 | Session B, per-version, scan `version-b.png`, then `version-a.png` | B card; nothing for A | As above |
| 3 | Session A, **combined (test-only)** artifact chosen before Start, scan `version-b.png` | Recognized, then "nothing to show"; no B content | Log lines `target:found` and `reveal:denied` |
| 4 | Scan `unknown.png` | Nothing | |
| 5 | Stop | "No live camera tracks", `0 live`; OS camera indicator off | What the OS indicator did |
| 6 | Deny camera permission, then Start | Clear denial message, Start usable again, fallback link works | Exact message |
| 7 | `npm run fault -- corrupt --version A`, reload session A, then `npm run fault -- restore --version A` | AR unavailable; "View without camera" shows the same title, image and message as the reveal | Fallback text vs reveal text |

7. Source-version binding check: for A and B, the artifact id in the evidence log (`ar:started`) equals the manifest id and the reveal belongs to the session's own version.
8. Record everything in [evidence/P06-reproduction-record.md](evidence/P06-reproduction-record.md). Failures and "nothing revealed" are valid results; do not invent thresholds. Replace every token and tunnel hostname with `<redacted>`. Stop the server and tunnel afterwards.

## 4. Supported-approach constraints for downstream tasks

The binding constraints are LEAD's P05 section 11 (items 1 to 10). This table only routes them; it adds no new authority.

| Task | Must carry from P05 section 11 | Gaps this spike does not answer |
| --- | --- | --- |
| I07 (Studio) | Source image bytes and hash become the identity input for preparation (item 3); one designated target per production artifact (item 6) | Quality rules for real customer photos. Only synthetic, feature-rich images were tested; I07 must define and evidence them, not assume them |
| I08 (Preview, AR preparation) | Verify source bytes/hash and revision before preparing and reject stale results (3); full integrity hashes, verified provenance, write-once artifact bytes (4); durable historical bindings, never a mutable "current artifact" pointer (5); preparation and retry outside DB transactions (3); never promote `manual-unverified` or harness `READY` to production readiness (4) | Production preparation service, storage and retention (10) |
| I11 (Sharing, fallback) | Same authorized content without the AR artifact; honest error for missing media or revoked access (7) | Real share lifecycle and access checks |
| I12 (AR signature, recipient) | Provider details and target/anchor indexes stay behind the AR boundary (1); recheck version, share generation and active owner, no global target-to-private-content lookup (2); normalize provider errors, clean up on Stop, failure and navigation, keep stale-reveal cancellation, measure track release (8); publish only evidence-backed support claims (9) | Supported mobile browsers: none established yet |

## 5. Harness behaviors that must NOT be copied into production

- Bearer tokens in `sessionStorage` and the scope-by-token registry (replace with real owner and recipient access).
- The manifest's single current-artifact pointer per version (no durable history).
- The test-only combined multi-target artifact and the `targetIndex` field of `/api/spike/reveal`.
- A harness `READY` that only checks artifact integrity, and loading the artifact as a blob without verifying delivered bytes against the recorded hash.
- Installing with `--ignore-scripts` and the `tar` and `argparse` overrides as a way of life: they are trade-offs for this spike, not upstream repairs.

## 6. Failed-device limits and known defects to preserve

From the P03 matrix and the P04 review; keep them in any support statement.

- Real mobile runs are not recorded yet: no current Redmi Note 13 (Chrome, Mi Browser) matrix, no light, distance or orientation data, no OS camera indicator observation, no device performance, no network trace.
- Recognition is probabilistic and resolution-sensitive in the desktop synthetic rig: version A 4/5 at 512 px; version B 0/5 at 512 px and 3/5 at native 1024 px. Preserve both B results.
- Camera permission denial crashed the page on Chrome 155 and Firefox 158 (MindAR 1.2.5 rejects `start()` with `undefined`). A fix (`public/start-failure.js`) exists in the follow-up change; it is verified by unit and static tests only and needs a real denial re-run.
- Combined-artifact recognition-then-refusal cases were not recognized in the P03 rig; they remain to be executed on a device.
- Accessibility so far is automated (18 of 18 checks); no manual or screen-reader pass.

## 7. License and dependency conditions to preserve

- MindAR upstream `mind-ar@1.2.5` is MIT; last published 2024-01-16 (maintenance risk; internal API coupling to compiler modules).
- Transitive license obligations are not fully reviewed; MIT alone is not blanket compliance clearance (P05 section 6).
- Core P0 AR must not require paid SDK licensing, runtime access, subscriptions, usage fees or a required paid cloud AR service (P05 section 3). Re-check this gate if a service or key dependency appears.
- Pin and record the toolchain: Node, `mind-ar@1.2.5`, `@tensorflow/tfjs@4.22.0` (CPU), `three@0.160.0`. Reproducibility of artifact bytes is claimed only for recorded environments; historical Orders must keep the stored bytes, not rely on recompiling.
- `npm audit` was clean after the overrides on the recorded run; a clean audit means no known advisory matches installed versions, not that the libraries are safe.

## 8. P06 acceptance mapping (tick only from independent, live results)

- [ ] Another member reproduces the target/reveal proof (section 3, cases 1 and 2).
- [ ] Source-version binding and fallback remain correct (cases 3, 4, 7 and step 7).
- [ ] I07/I08/I12 receive explicit supported-approach constraints (section 4 reviewed by LEAD against the final P05).
- [ ] Tests required: real selected-candidate repeat scan, fallback and wrong-target checks (cases 1, 3, 4, 7).

Reviewer sign-off: LEAD, after the reproduction record is filled by someone other than the owner.
