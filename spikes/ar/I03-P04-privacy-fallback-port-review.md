# I03-P04 — Privacy, fallback and provider-port feasibility

- Item: [I03 Early AR Technology Spike](../../planning/I03-early-ar-technology-spike.md)
- Task: I03-P04 (owner MEMBER_3, reviewer LEAD). Depends on I03-P02; runs in parallel with I03-P03.
- Branch: `feature/I03-P04-privacy-fallback-port`
- Status: **IN_REVIEW, partial.** Harness-level and static evidence is complete. **Real-device evidence (network trace, storage, readability, denied/unsupported) is still to be recorded** in `evidence/P04-observations-template.md`. Nothing here selects an SDK; that is LEAD's decision in I03-P05.

> Device input received since this draft (I03-P03 owner, 2026-10-18, Redmi Note 13 / Android 14 / Chrome over an HTTPS tunnel): camera permission, MindAR start and one genuine recognition with the version-bound reveal worked. The camera area was black until a CSS stacking-context fix, and the first combined-artifact run was invalid (artifact choice changed after Start); both are fixed in I03-P02. This confirms the camera path loads over HTTPS on one device class. It is **not** a network trace and does not change section 3: the claim "no frame leaves the device" still needs the trace in `evidence/P04-observations-template.md`.

> Distinction required by the task: everything below that says "harness" proves a property of this spike only. It is **not** a final I12 proof. Final recipient access, public/private media and cookie-based sessions belong to I02/I11/I12.

## 1. Acceptance criteria status

| Criterion | Status | Evidence now | Still needed |
| --- | --- | --- | --- |
| No private unrelated target/content is exposed | Harness: met. Device: pending | Server tests: A never reveals B, other-version artifact, wrong index, no/invalid token, malformed input and the test-only combined artifact all give identical `404 NOT_FOUND`; content never appears in public files (`npm test`, 89 tests). Static review of page scripts (section 3) | Real scans of B in session A, of `unknown.png`, and of the combined artifact on a phone |
| Fallback preserves readable image/message | Harness: met. Device: pending | Same payload for reveal and `/api/spike/content`; alt text; message is DOM text (not baked into the image); contrast of image text 4.5:1 or better; no camera/AR code loaded by the page | Zoom 200%, small screen and screen-reader check on devices; real denial and unsupported browser |
| Proposed port preserves source version and immutable artifact semantics | Sketch: met. Not implemented | `port/ar-provider-port.ts` type-checks under `tsc --strict`; conformance tests against the real manifest and artifacts (section 5) | LEAD review; real port is I08/I12 work |

Tests required by the task:

| Case | Harness coverage (automated) | Device run needed |
| --- | --- | --- |
| Wrong target | Yes: wrong artifact, wrong index, other session's artifact, combined-artifact B inside A | Yes: scan B in session A, `unknown.png`, B in session A with the combined artifact |
| Denied camera | Page falls back to the camera-free view; same content (server test + readability test) | Yes: real permission denial |
| Unsupported | Insecure context / missing `mediaDevices` handled in page logic | Yes: real unsupported browser or device |
| Frame observations | Static: no pixel-reading API, no extra network channel (section 3) | **Yes: DevTools / remote inspector trace** |
| Network observations | Static: three same-origin fetch sites; CSP `connect-src 'self' blob:`; page logs off-origin requests and CSP violations | **Yes: DevTools / remote inspector trace** |

## 2. What was reviewed

1. `spikes/ar/public/client.js` and `public/fallback.js` (page code).
2. `src/server.mjs`, `src/registry.mjs` (authorization and response shapes).
3. The installed `mind-ar@1.2.5` build reachable from the entry the harness loads (`mindar-image-three.prod.js` and its sibling chunks), searched for network primitives and remote hosts.
4. `three@0.160.0` (one search for network primitives; it contains `fetch` only inside file loaders the harness never uses).

## 3. Frame and network processing: what static review shows

Facts, with how each can be re-checked (`npm test` runs `test/privacy-static.test.mjs`):

| Observation | Result | Limit of this evidence |
| --- | --- | --- |
| Page scripts read pixels or capture streams (`toBlob`, `toDataURL`, `getImageData`, `MediaRecorder`, `ImageCapture`, `createImageBitmap`) | None | Source only; the library itself processes frames on the device (below) |
| Page scripts open other channels (`XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, service workers, `localStorage`, `indexedDB`, cookies) | None. Only `sessionStorage` for the bearer token | Source only |
| All `fetch` calls | Three call sites, all to `/api/spike/*` on this origin | Source only |
| Data the page's own code sends after a recognition | `{ artifactId, targetIndex }` and nothing else (a test fails if the body changes). `targetIndex` is a harness API field; the proposed port has none | Source only; says nothing about what the recognizer library does |
| Token in a URL | Never. `#t=` is moved to `sessionStorage` and removed from the address bar; requests use `Authorization`; pages send no Referer | Source only |
| MindAR loaded modules reaching a remote host | None that are executed. Remaining URL strings are licence headers and tfjs doc-comment examples (`storage.googleapis.com`, `my-server`) | Static search of minified code; dynamic URLs cannot be excluded |
| Face-tracking chunk loads MediaPipe WASM from `cdn.jsdelivr.net` | Present in `controller-d1-*.js`, used by `mindar-face*.js` only. Not reachable from the image entry; a test guards this | Would matter if face tracking were ever added |
| tfjs HTTP IO (`fetch(this.path)`) and storage handlers exist in the bundle | Present as library code (model load/save). Not invoked by the image-target path as far as the source shows | **Runtime confirmation needed**: check no request and no storage entries appear during a scan |
| MindAR's only app-level request | `imageTargetSrc`; the harness passes a blob URL created from bytes it already downloaded with the bearer token | Static |

**What this evidence supports:** the page's own code, and the loaded MindAR modules as far as minified source can be read, contain no path that sends camera pixels, and the page's own request surface is small and fixed.

**What it does not support:** any claim that no frame data leaves the device. The recognizer is third-party minified code, its runtime behavior was not traced, and the CSP and the page's off-origin log only supplement a trace. That claim stays open until a network trace per device class is recorded in `evidence/P04-observations-template.md`.

## 4. Fallback review

- `/fallback` loads no camera, AR or three.js code (test). It calls `/api/spike/content`, which applies the same authorization as the reveal and does not depend on the artifact, so it also works when preparation failed (`UNAVAILABLE`).
- The text is inserted with `textContent` (no markup injection). Language, `role="status"` / `aria-live`, viewport meta and image alt are present (tests).
- Not yet verified: zoom and reflow at 200%, landscape/small screens, screen-reader announcement order, keyboard focus order, and what a person sees when camera permission is denied versus the browser being unsupported.
- Library caveat for the adapter: `MindARThree.start()` rejects **without an error object** on camera denial, so denial cannot be told from other failures through MindAR alone. The adapter must keep its own `getUserMedia` handling (the harness already wraps it) to choose the right message.

## 5. Port feasibility

`port/ar-provider-port.ts` (revision 2, after review) sketches `ARPreparationPort`, `ARArtifactStore`, `ARBindingStore`,
`ARRecognizerPort` and `ARRevealService`. Artifact byte identity (`PreparedARArtifact`) and the source-revision binding
(`ARArtifactBinding`) are separate append-only records. It preserves:

| Requirement | How the sketch preserves it | Checked by |
| --- | --- | --- |
| Source version (BR-AR-002) | `ARArtifactBinding` records `sourceRevisionId`, `sourceImageSha256`, `artifactId` and provenance; a changed source or toolchain is a new artifact and a new binding, old bindings never change | Conformance test maps every manifest entry onto the two records; identical bytes bound to two revisions give one artifact and two bindings |
| Immutable artifact | `ArtifactId` is `ar-` + the full SHA-256; the store is append-only; `put` recomputes the hash and fails on mismatch or `id-collision`; `get` re-verifies | Tests: full-hash id, collision refused with the old file untouched, identical bytes idempotent, a short prefix never resolves |
| Verified preparation | `prepare()` hashes `imageBytes` against the declared source hash before any work, guarantees one target and `artifactId === 'ar-' + sha256(bytes)` | Sketch text asserted by test; harness equivalent is `src/provenance.mjs` |
| Recognition is not authorization (BR-AR-003, INV-08) | `RecognitionEvent` is `{ artifactId }` only; `reveal(scope, event)` treats it as a hint that must equal `scope.boundArtifactId`; one `not_found` shape for every non-match; no function maps a target to media | Server tests (harness level) |
| No provider semantics at the boundary | No `targetIndex` or anchor in any shared type; a provider keeps its own index inside the adapter; multi-target artifacts are a test-only adapter extension | Test asserts `RecognitionEvent` has no index; `tsc` rejects a `targetIndex` field |
| Camera-free path (BR-AR-004) | `content(scope)` returns `ContentResult` (`revealed` or `not_found`), never `unavailable`, and never reads an artifact | `tsc` rejects `unavailable` in `ContentResult`; server tests show content works while the artifact is UNAVAILABLE |
| Provider metadata stays in the adapter (ADR-005) | `providerMetadata: unknown`, never in DTOs | Review |

Gaps found in the **harness** that the real port must not copy:

1. `manifest.mjs` keeps only the current `artifact` pointer per version, so a replaced artifact leaves no record in the manifest (the files stay, because ids are content-addressed). The real binding store must be append-only; the Order version must reference a binding or `ArtifactId`, never "the current artifact of the project".
2. The harness API carries `targetIndex` in `/api/spike/reveal` and the test-only combined artifact has more than one target. Both exist only to make the tracker recognize B inside session A; production artifacts have exactly one target (BR-AR-001) and the port has no index.
3. A `.mind` file stores target sizes and features, not the source pixels, so provenance cannot be proven by comparing pixels. The harness proves it by hash-checking the source, checking structure, and comparing with a recompile in the recorded toolchain; anything else is `manual-unverified` and is never shown as verified.
4. `MindARThree.stop()` does not report released camera tracks; `ARRecognizerPort.stop()` returns `liveTracks` so this stays observable whatever the provider.

Feasibility verdict for the port itself: **no provider-specific type is required on the server**, so the boundary is feasible for MindAR. This says nothing about whether MindAR recognizes reliably; that is device evidence (P02/P03).

## 6. Findings and risks for LEAD (I03-P05 input)

| # | Finding | Severity for P0 | Mitigation / owner |
| --- | --- | --- | --- |
| 1 | Cannot yet assert "no frame leaves the device"; only static evidence | High until traced | Record the DevTools / remote-inspector trace per device class (this task, evidence template) |
| 2 | Session links are printed to stdout at startup (Render logs) | Low (spike only) | Pin `SPIKE_TOKEN_A/B` via env, rotate after the run, do not paste logs into evidence. Final design: I02/I11/I12 |
| 3 | Bearer token in `sessionStorage` | Low (spike only) | Final recipient access is cookie-based in I02/I11 |
| 4 | tfjs storage/HTTP IO code present in the bundle | Medium until traced | Check Application storage and network after a scan |
| 5 | Face chunk fetches WASM from a CDN | None now | Test guards that the image entry cannot reach it; re-review if scope grows |
| 6 | CSP allows `style-src 'unsafe-inline'` | Low | Harness convenience; review before production reuse |
| 7 | Artifact is a plain file whose exposure grants recognition only | Low | Recognition is not authorization; the backend check is the control (P01 section 5). Serving only to an authorized session is defense in depth |
| 8 | Upstream MindAR last published 2024-01-16; its dependency tree had 6 audit findings (`canvas`/`tar` chain and `tfjs`/`argparse`/`sprintf-js` chain) | Medium for P05 | Mitigated in the harness with `overrides` (`tar`, `argparse`), audit now clean, tests and recompile unchanged; see README for the trade-off. The maintenance risk of an unmaintained upstream remains for LEAD to weigh |
| 9 | Library hides denial vs failure | Medium (UX) | Adapter-owned `getUserMedia` handling |
| 10 | A late `/api/spike/reveal` response could render after the target was lost or AR stopped | Medium (could show content for a target no longer in view) | Fixed in the harness: abort plus generation guard (`public/reveal-guard.js`) with tests for found, lost or stop, late response. Real adapter must keep the same rule |
| 11 | Artifact id was only 16 hex of the SHA-256 and a name collision could overwrite a file | Medium for immutability | Fixed in the harness: full SHA-256 id, write-once files, collision refused. Port requires the same |
| 12 | An artifact could be bound to a revision without proof it came from that image | Medium for BR-AR-002 | Fixed in the harness: source hash and structure checks, provenance status, `manual-unverified` surfaced in session, page and log. A `.mind` has no source pixels, so full proof is not possible |

## 7. What to do with the device evidence

1. For each device class in P03's matrix, open the harness over HTTPS with DevTools / remote inspector (Chrome: `chrome://inspect`; Safari: Web Inspector on a Mac) and fill `evidence/P04-observations-template.md`.
2. Any off-origin request, any request containing more than the three known API shapes, or any storage entry created by the library is a finding to report, not something to remove from the record.
3. When the table in section 1 has real results, change the status line at the top and tick the acceptance boxes in the task.

## 8. Out of scope

Final Sharing subsystem, public media endpoints, cookie sessions, payment, and any production AR code.
