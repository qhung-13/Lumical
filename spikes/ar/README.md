# I03-P02 — Synthetic target and version-bound reveal prototype (AR spike harness)

Isolated harness. Not in `pnpm-workspace.yaml`, touches neither `frontend/` nor `backend/` nor `docs/`, and adds no root
dependency. Synthetic data only. **No SDK is selected by this folder**; it prototypes C1 (MindAR) first, as ordered in the
P01 evaluation §8. LEAD still decides in I03-P05.

Branch: `feature/I03-P02-synthetic-target-prototype`.

## What it proves, and what it does not

| P02 acceptance / P01 question | How this harness answers it | Automated here | Needs a real phone |
| --- | --- | --- | --- |
| Prepared target genuinely resolves image + text (Q1) | MindAR scans the compiled `.mind`, then the server reveals the session's synthetic card (image + message) | – | **Yes** |
| Unknown / wrong-version target reveals nothing (Q2, Q3) | `unknown.png` control; A-session never reveals B; the test-only combined A+B artifact makes the tracker recognize B inside session A while the server must refuse | Server side (fail-closed, identical 404s, wrong index) | **Yes** (real scans of B in session A, and of `unknown.png`) |
| Artifacts identifiable by source version, reproducible (Q4) | `fixtures/manifest.json` binds `sourceImageSha256` → artifact sha256 / id / revision; `npm run compile:verify` recompiles and records a check | Hashes, binding, provenance status; byte-identical recompile in the recorded environment | Optional cross-check with the MindAR browser compile tool |
| Start/Exit releases camera (Q5) | Page wraps `getUserMedia`, lists tracks, reports live tracks after Stop | – | **Yes** |
| Denied / unsupported → same content without AR (Q6) | `/fallback` loads no camera code; same payload as the reveal | Same-content, works without artifact | **Yes** (real denial, real unsupported device) |
| Recognition ≠ authorization (Q7) | Reveal needs the session scope plus the artifact/index that scope allows; artifacts are only served to an authorized session, never as public files | Yes | Yes (combined-artifact scan) |
| Preparation failure | Missing / tampered artifact → `UNAVAILABLE`, fallback still works (`npm run fault`) | Yes | Optional |

`npm test` (97 tests) covers the server, manifest, committed artifacts, module graph, UI regressions, static privacy checks of
the page scripts and the installed MindAR build, fallback readability, port conformance, stale-reveal handling, artifact
identity, provenance and wording guards. **They are not AR evidence.**
P02's real-recognition criteria stay unchecked until the phone runs below are recorded in `evidence/`.

## Run it

Requirements: Node >= 22.2 and network access for the first install.

```bash
cd spikes/ar
npm ci --ignore-scripts        # mind-ar depends on native `canvas`: it is installed but NOT compiled with --ignore-scripts, and never loaded here
npm test                       # 97 tests
npm run compile:verify         # optional: recompile A, B and the combined artifact, record reproducibility, print feature counts
SPIKE_ENABLE_COMBINED=1 npm start
```

The server prints a Version A and a Version B session link (`#t=` fragment, removed from the address bar on load). Pin them
with `SPIKE_TOKEN_A` / `SPIKE_TOKEN_B` (>= 16 URL-safe characters) if you redeploy. `localhost` is a secure context, so a
desktop browser works for a smoke test; a phone needs HTTPS (next section).

Before relying on dependency versions record `npm view mind-ar version license` and `npm view three version license`.
Adding these packages needs the teammate approval described in `docs/DEV_WORKFLOW.md` §13 (reason, license, maintenance,
reviewed through the PR). Direct dependencies: `mind-ar@1.2.5` (MIT, last published 2024-01-16), `three@0.160.0`,
`@tensorflow/tfjs@4.22.0` (same copy mind-ar resolves, needed by the Node compile script) and `pngjs@7.0.0`
(decodes the synthetic PNGs). Not yet audited: transitive licenses.

### Fixtures and artifacts

- Source images are committed (`fixtures/targets/version-a.png`, `version-b.png`, `unknown.png`). `npm run gen:fixtures`
  regenerates them (pixel-deterministic; PNG bytes may differ across zlib versions, so the committed files are the source
  of truth). Regenerating changes the source hashes and invalidates registered artifacts; run `npm run compile -- --force`
  afterwards.
- `npm run compile` prepares artifacts in plain Node (the native `canvas` package is present but not compiled, and is not used) and registers them in the manifest. The
  committed result: 1024x1024 sources, about 3.7k matching feature points each. Recompiles were byte-identical in the
  recorded environment only (each check in `fixtures/manifest.json` records Node, OS, architecture); this is not
  claimed for other Node, OS or tfjs versions, and a differing recompile is recorded as DIFFER, not hidden.
- The MindAR browser compile tool (<https://hiukim.github.io/mind-ar-js-doc/tools/compile>) remains a valid cross-check:
  `npm run register -- --version A --file ~/Downloads/targets.mind --tool-version "<date>"`, and
  `--check-reproducible` to compare a second compile.
- Artifacts live in `artifacts/` and are served only to an authorized session via `/api/spike/artifacts/<id>`.

## Deploy for the phone (HTTPS)

The camera needs a secure context. The harness is a plain Node server, so the BE host fits (Render web service):

- Build command: `npm ci --ignore-scripts`. Start command: `npm start`. Root directory: `spikes/ar`.
- Environment: `HOST=0.0.0.0`, `SPIKE_ENABLE_COMBINED=1`, `SPIKE_PUBLIC_URL=https://<service>.onrender.com`,
  `SPIKE_TOKEN_A`, `SPIKE_TOKEN_B` (pin so links survive restarts; keep them out of the repo and out of evidence files).
- Render terminates TLS; the process listens on HTTP behind it. A tunnel (cloudflared, ngrok) in front of
  `127.0.0.1:8787` works too. Remove the deployment after I03. Not deployed or device-tested yet.

## Cases to run on each device

1. Session A, per-version artifact, scan `version-a.png` (on another screen or printed): expect the A card. Repeat scans
   (lose and re-find the target several times).
2. Session A, scan `version-b.png`: expect nothing / the neutral "nothing to show" message.
3. Session B, scan `version-b.png`: expect the B card; session B, scan `version-a.png`: nothing.
4. Session A, combined test artifact, scan `version-b.png`: the tracker recognizes it, the server must still refuse
   (recognition ≠ authorization).
5. Session A, scan `unknown.png`: nothing.
6. Press Stop: status must say no live camera tracks; the OS camera indicator must go off.
7. Deny camera permission, then open on an unsupported browser/device: honest message, "View without camera" shows the
   same image + message.
8. Preparation failure: `npm run fault -- corrupt --version A` (or `missing`), reload session A: the page must say the
   target is unavailable and "View without camera" must still work; then `npm run fault -- restore --version A`.
9. Record light, distance and orientation honestly; failures are results, not omissions.

Fill `evidence/P02-device-run-template.md` per device and use the page's "Copy evidence JSON". Also capture a
DevTools/remote-inspector network trace once per device class (the page's off-origin log and the CSP
`connect-src 'self' blob:` are supplements, not proof).

## Design notes

- `src/registry.mjs`: sessions are a synthetic authorized scope (hashed tokens). Every scope failure returns the same
  `404 NOT_FOUND`; `503 UNAVAILABLE` only for an authorized session whose own artifact is missing or fails its recorded
  hash. Fallback content never depends on the artifact.
- No global target→media lookup: content is resolved from the session's version, never from the recognized index alone.
- After a recognition the page's own code sends only `{ artifactId, targetIndex }` (a harness API; the proposed port has no
  `targetIndex`). Whether the recognizer library sends anything else is **not established**: that needs a real-device
  network trace (`evidence/P04-observations-template.md`). The static checks in `test/privacy-static.test.mjs` do not
  prove it.
- The artifact is downloaded by the page with the bearer token and handed to MindAR as a blob URL.
- `/vendor/mindar/` serves MindAR's whole `dist/` folder (its entry file imports sibling chunks); `test/vendor.test.mjs`
  crawls the module graph so a missing chunk fails the local `npm test` instead of surfacing on the phone. The repository CI
  does not run the spike tests yet, so a PR check does not cover them.
- CSP: `default-src 'none'`, `connect-src 'self' blob:`, `camera=(self)`; an off-origin request or CSP violation shows in
  the evidence log. `style-src 'unsafe-inline'` is allowed for the spike so MindAR/three styling cannot cause false
  failures; review before any production reuse.
- Token in `sessionStorage` is a spike convenience; final recipient access is I02/I11/I12 (cookie-based).
- Artifact identity is the FULL SHA-256 (`ar-<64 hex>`), also the file name; a short form (`ar-` + 12 hex) is display only.
  An existing artifact file is never overwritten: identical bytes are a no-op, different bytes under the same name are
  refused as a collision or tampering.
- An artifact is bound to a source revision only through `src/provenance.mjs`: the source image hash must match the
  manifest, the `.mind` must parse with the expected target count and sizes, then provenance is recorded as
  `built-from-verified-source`, `verified-recompile` or `manual-unverified`. A `.mind` file does not contain the source
  pixels, so "verified" can only mean "equals a fresh recompile of the hash-checked source in the recorded toolchain";
  anything else (for example a browser-tool compile) is shown as `manual-unverified` in the session, the page and the log.
- A reveal response that arrives after the target was lost, AR was stopped or a newer recognition started is dropped
  (`public/reveal-guard.js`: abort plus generation check; `test/stale-reveal.test.mjs`).
- Not final: no scanner UI, no participant media, no payment, no real authentication.

## Findings so far (build-time, not device evidence)

- Artifact preparation works in plain Node. In the recorded environment (see `reproducibilityChecks` in the manifest:
  Node version, platform, architecture, `mind-ar@1.2.5`, `@tensorflow/tfjs@4.22.0` cpu backend) recompiling the same source
  gave byte-identical output. Nothing is claimed beyond that environment.
- `mind-ar@1.2.5` depends on native `canvas`; a normal install failed in the build sandbox, so install with
  `--ignore-scripts`. Before the overrides below, `npm audit` reported 6 vulnerabilities on
  the recorded run (1 critical, 1 high, 4 moderate), from two chains: `mind-ar` → `canvas@2.11.2` →
  `@mapbox/node-pre-gyp@1.0.11` → `tar@6.2.1` (12 advisories on `tar <=7.5.20`) and `@tensorflow/tfjs` → `argparse@1` →
  `sprintf-js` (moderate; no patched `sprintf-js` exists, latest 1.1.3 is in the affected range).
  `package.json` now carries `overrides` `{ "tar": "^7.5.22", "argparse": "^2.0.1" }`. After a fresh install `npm audit`
  reports 0 vulnerabilities, `argparse@2` has no `sprintf-js`, and only the `tar` chain and `argparse` changed in the
  lockfile. The files the browser receives (`mind-ar/dist`, `three`) are byte-identical to the versions before the
  overrides, and all tests and the byte-identical recompile still pass in the recorded environment.
  These overrides replace transitive dependencies with majors their parents were not published against, so they are a
  deliberate trade-off, not an upstream fix: `tar` is used only by `node-pre-gyp` inside `canvas`'s install script, which
  `--ignore-scripts` skips (`node_modules/canvas/build` does not exist), and `argparse` is declared in the `tfjs` package
  metadata but required by no shipped file. A plain `npm install` with scripts enabled could fail in `canvas`'s install
  script with `tar@7`; this harness never needs `canvas`. Re-check the overrides when `mind-ar` or `tfjs` changes. A clean
  `npm audit` does not mean the libraries are safe; it only means no known advisory matches the installed versions.
- Upstream `mind-ar` last published 2024-01-16 (maintenance risk for P05). MIT license confirmed first-hand from the
  published package metadata and its LICENSE file.
- MindAR's entry module imports `three/addons/renderers/CSS3DRenderer.js` and uses `outputEncoding`/`sRGBEncoding`;
  `three@0.160.0` still provides these (deprecated since r152), but this has only been checked statically.
- `MindARThree.start()` rejects with `undefined` on camera denial. **Measured** by the I03-P03 owner on Chrome 155 and Firefox 158
  (2026-10-19): the page then read `err.name`, threw a TypeError inside its own `catch`, never stopped or cleaned up, and left
  the status on "Loading…" with no message. Fixed in `client.js` + `public/start-failure.js`: the cause is taken from the
  rejected value, else the last `getUserMedia` error the wrapper saw, else the browser's camera permission state, else an
  honest generic message; `test/start-failure.test.mjs` covers it. That fix is verified by unit and static tests only; a real
  denial run must confirm it. The library also registers a window `resize` listener it never removes.
- Artifacts are plain files; per P01 §1 the control is the backend authorization check, not hiding the artifact.
  Serving them only to an authorized session is defense in depth.

## Known unverified points (first real run settles them)

- `public/client.js` follows MindAR's documented `MindARThree` API (`addAnchor`, `onTargetFound/Lost`, `start`, `stop`,
  `uiLoading/uiScanning/uiError`) and has never run in a browser. If the API differs, only `client.js` changes.
- Whether `mindar.stop()` releases every camera track is exactly what the evidence panel measures. On desktop it did
  (`1 created, 0 live` on Chrome 155 and Firefox 158, per the I03-P03 report); a phone and the OS camera indicator are still open.
- Whether the denial fix above shows the right message on a real denial (Chrome, Firefox, and the Redmi Note 13).
- Whether the harness page loads on a real device with the CSP (importmap hash, `wasm-unsafe-eval`, workers).
- Real recognition quality of the synthetic images (distance, light, orientation).

## Device observations so far (MEMBER_4, 2026-10-18, not yet in `evidence/`)

Source: a test report by the I03-P03 owner against commit `166b7f9`. Redmi Note 13, Android 14 (HyperOS), Chrome, over an
HTTPS tunnel; desktop Chrome 155 on Ubuntu for rendering.

| Case | Result | Reading |
| --- | --- | --- |
| HTTPS load, camera permission, MindAR start | Works; tracks live, tracking runs | Infrastructure is viable |
| Session A + `version-a.png` | Card A shown | Genuine recognition + version-bound reveal worked once |
| Session A + `version-b.png` (per-version artifact) | Nothing shown | **Weak evidence**: that artifact contains only target A, so no request is ever made |
| Session A + combined artifact + `version-b.png` | Nothing shown, expected the "nothing to show" message | **Not valid**: the artifact choice was changed after Start, so the per-version artifact was still in use |
| Camera area | Black on desktop and phone | Fixed in this branch: `#container` had no stacking context (`z-index: 0`) |

Fixes made after that report: camera area stacking context; the camera summary now updates on start and on track events;
the artifact choice is locked while AR runs and the status names the artifact in use; the status shows loading and
scanning progress. `test/ui-static.test.mjs` guards these. Case 4 must be re-run before it counts as evidence.
Still not recorded anywhere: permission denied, unsupported browser, repeatability, light/distance/orientation, network trace.

### Desktop run, I03-P03 owner, 2026-10-19 (harness commit `0654135` on `dev`, synthetic camera, not yet in `evidence/`)

Chrome 155 and Firefox 158 on Ubuntu 26.04.1, Node 24.21.0, localhost (a secure context, so no HTTPS run). Reported results:

| Area | Result | Reading |
| --- | --- | --- |
| Camera start, scanning status | Works on both browsers | Desktop only |
| Stop | `1 created, 1 live` then `1 created, 0 live`, no video stream left | Camera-track cleanup passed on desktop |
| Permission denial | **Failed** on both: TypeError, status stuck, no message | Fixed here (see Findings); re-run needed |
| Repeat scans (Chrome, synthetic feed) | A: 6 found / 5 lost / 6 reveals over 40 s, no JS errors; 4/5 trials; B: 0/5 at 512 px, 3/5 at 1024 px | Recognition is probabilistic and resolution-sensitive; a desktop approximation, not phone evidence |
| Automated DOM and keyboard checks | 18/18 | Not a manual or screen-reader pass |
| Camera-free page, fail-closed API | As expected | Matches the server tests |
| Byte-identical recompile of A | Reported MATCH on Node 24.21.0 / Ubuntu 26.04 | A second environment next to the recorded one; still only per environment |

Not done and not claimed: any real phone run on this commit, HTTPS camera prompt, OS camera indicator, light, distance,
orientation, and a network capture. The combined-artifact rows were not recognized in that rig and are left blank.

## I03-P04 (privacy, fallback, provider port)

- Review and findings: `I03-P04-privacy-fallback-port-review.md`.
- Port sketch (type-checks under `tsc --strict`, not compiled by the workspace): `port/ar-provider-port.ts`.
- Real-device network, storage and readability record: `evidence/P04-observations-template.md`.
- Tests: `test/privacy-static.test.mjs`, `test/fallback-readability.test.mjs`, `test/port-conformance.test.mjs`.
  They inspect source and the installed library; they do not replace a real network trace.
