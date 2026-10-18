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
| Artifacts identifiable by source version, reproducible (Q4) | `fixtures/manifest.json` binds `sourceImageSha256` → artifact sha256 / id / revision; `npm run compile:verify` recompiles and records a check | Hashes, binding, byte-identical recompile | Optional cross-check with the MindAR browser compile tool |
| Start/Exit releases camera (Q5) | Page wraps `getUserMedia`, lists tracks, reports live tracks after Stop | – | **Yes** |
| Denied / unsupported → same content without AR (Q6) | `/fallback` loads no camera code; same payload as the reveal | Same-content, works without artifact | **Yes** (real denial, real unsupported device) |
| Recognition ≠ authorization (Q7) | Reveal needs the session scope plus the artifact/index that scope allows; artifacts are only served to an authorized session, never as public files | Yes | Yes (combined-artifact scan) |
| Preparation failure | Missing / tampered artifact → `UNAVAILABLE`, fallback still works (`npm run fault`) | Yes | Optional |

`npm test` (36 tests) covers the server, manifest, committed artifacts and module graph. **They are not AR evidence.**
P02's real-recognition criteria stay unchecked until the phone runs below are recorded in `evidence/`.

## Run it

Requirements: Node >= 22.2 and network access for the first install.

```bash
cd spikes/ar
npm ci --ignore-scripts        # mind-ar depends on native `canvas`: it is installed but NOT compiled with --ignore-scripts, and never loaded here
npm test                       # 36 tests
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
  committed result: 1024x1024 sources, about 3.7k matching feature points each, byte-identical on recompile.
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
- Recognition result handed to the server is only `{ artifactId, targetIndex }`; no frames are ever sent.
- The artifact is downloaded by the page with the bearer token and handed to MindAR as a blob URL.
- `/vendor/mindar/` serves MindAR's whole `dist/` folder (its entry file imports sibling chunks); `test/vendor.test.mjs`
  crawls the module graph so a missing chunk fails in CI instead of on the phone.
- CSP: `default-src 'none'`, `connect-src 'self' blob:`, `camera=(self)`; an off-origin request or CSP violation shows in
  the evidence log. `style-src 'unsafe-inline'` is allowed for the spike so MindAR/three styling cannot cause false
  failures; review before any production reuse.
- Token in `sessionStorage` is a spike convenience; final recipient access is I02/I11/I12 (cookie-based).
- Not final: no scanner UI, no participant media, no payment, no real authentication.

## Findings so far (build-time, not device evidence)

- Artifact preparation works in plain Node and is byte-reproducible (two recompiles identical, recorded in the manifest).
- `mind-ar@1.2.5` depends on native `canvas`; a normal install failed in the build sandbox, so install with
  `--ignore-scripts`. `npm audit` reports vulnerabilities (the count changes with the advisory database; 6 to 7 seen), all
  transitive through `mind-ar`: `canvas` → `@mapbox/node-pre-gyp` → `tar` (critical/high; install-time tooling, and
  `canvas` is never loaded by this harness because installs use `--ignore-scripts`) and `@tensorflow/tfjs` →
  `argparse` → `sprintf-js` (moderate). npm reports no fix available. Do not run `npm audit fix --force` (it would
  change pinned versions); re-check before any workspace reuse.
- Upstream `mind-ar` last published 2024-01-16 (maintenance risk for P05). MIT license confirmed first-hand from the
  published package metadata and its LICENSE file.
- MindAR's entry module imports `three/addons/renderers/CSS3DRenderer.js` and uses `outputEncoding`/`sRGBEncoding`;
  `three@0.160.0` still provides these (deprecated since r152), but this has only been checked statically.
- `MindARThree.start()` rejects without an error object on camera denial, so denial cannot be told apart from other
  failures without extra checks; the library also registers a window `resize` listener it never removes.
- Artifacts are plain files; per P01 §1 the control is the backend authorization check, not hiding the artifact.
  Serving them only to an authorized session is defense in depth.

## Known unverified points (first real run settles them)

- `public/client.js` follows MindAR's documented `MindARThree` API (`addAnchor`, `onTargetFound/Lost`, `start`, `stop`,
  `uiLoading/uiScanning/uiError`) and has never run in a browser. If the API differs, only `client.js` changes.
- Whether `mindar.stop()` releases every camera track is exactly what the evidence panel measures.
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
