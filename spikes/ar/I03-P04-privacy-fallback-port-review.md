# I03-P04 — Privacy, fallback and provider-port feasibility

- Item: [I03 Early AR Technology Spike](../../planning/I03-early-ar-technology-spike.md)
- Task: I03-P04 (owner MEMBER_3, reviewer LEAD). Depends on I03-P02; runs in parallel with I03-P03.
- Branch: `feature/I03-P04-privacy-fallback-port`
- Status: **IN_REVIEW, partial.** Harness-level and static evidence is complete. **Real-device evidence (network trace, storage, readability, denied/unsupported) is still to be recorded** in `evidence/P04-observations-template.md`. Nothing here selects an SDK; that is LEAD's decision in I03-P05.

> Distinction required by the task: everything below that says "harness" proves a property of this spike only. It is **not** a final I12 proof. Final recipient access, public/private media and cookie-based sessions belong to I02/I11/I12.

## 1. Acceptance criteria status

| Criterion | Status | Evidence now | Still needed |
| --- | --- | --- | --- |
| No private unrelated target/content is exposed | Harness: met. Device: pending | Server tests: A never reveals B, other-version artifact, wrong index, no/invalid token, malformed input and the test-only combined artifact all give identical `404 NOT_FOUND`; content never appears in public files (`npm test`, 47 tests). Static review of page scripts (section 3) | Real scans of B in session A, of `unknown.png`, and of the combined artifact on a phone |
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
| Data sent after a recognition | `{ artifactId, targetIndex }` and nothing else (test fails if the body changes) | Source only |
| Token in a URL | Never. `#t=` is moved to `sessionStorage` and removed from the address bar; requests use `Authorization`; pages send no Referer | Source only |
| MindAR loaded modules reaching a remote host | None that are executed. Remaining URL strings are licence headers and tfjs doc-comment examples (`storage.googleapis.com`, `my-server`) | Static search of minified code; dynamic URLs cannot be excluded |
| Face-tracking chunk loads MediaPipe WASM from `cdn.jsdelivr.net` | Present in `controller-d1-*.js`, used by `mindar-face*.js` only. Not reachable from the image entry; a test guards this | Would matter if face tracking were ever added |
| tfjs HTTP IO (`fetch(this.path)`) and storage handlers exist in the bundle | Present as library code (model load/save). Not invoked by the image-target path as far as the source shows | **Runtime confirmation needed**: check no request and no storage entries appear during a scan |
| MindAR's only app-level request | `imageTargetSrc`; the harness passes a blob URL created from bytes it already downloaded with the bearer token | Static |

**Conclusion allowed from this evidence:** nothing in the harness code or in the loaded MindAR modules is *designed* to send camera frames anywhere, and the page's own network surface is tiny and fixed. **Not allowed:** "no frame leaves the device." That claim needs a real trace per device class (template provided) because the library is minified third-party code and the CSP/log are supplements, not proof.

## 4. Fallback review

- `/fallback` loads no camera, AR or three.js code (test). It calls `/api/spike/content`, which applies the same authorization as the reveal and does not depend on the artifact, so it also works when preparation failed (`UNAVAILABLE`).
- The text is inserted with `textContent` (no markup injection). Language, `role="status"` / `aria-live`, viewport meta and image alt are present (tests).
- Not yet verified: zoom and reflow at 200%, landscape/small screens, screen-reader announcement order, keyboard focus order, and what a person sees when camera permission is denied versus the browser being unsupported.
- Library caveat for the adapter: `MindARThree.start()` rejects **without an error object** on camera denial, so denial cannot be told from other failures through MindAR alone. The adapter must keep its own `getUserMedia` handling (the harness already wraps it) to choose the right message.

## 5. Port feasibility

`port/ar-provider-port.ts` sketches `ARPreparationPort`, `ARArtifactStore`, `ARRecognizerPort`, `ARRevealService` and a shared `RevealContent`. It preserves:

| Requirement | How the sketch preserves it | Checked by |
| --- | --- | --- |
| Source version (BR-AR-002) | `PreparedARArtifact` carries `sourceRevisionId` and `sourceImageSha256`; a changed source is a new artifact | Conformance test maps every manifest entry onto the port shape |
| Immutable artifact | `ArtifactId` is content-addressed; store is append-only; `put` of an existing id with different bytes fails; `get` checks `artifactSha256` | Test: same bytes same id, one flipped byte new id; re-registering new bytes leaves old bytes untouched; identical bytes are idempotent |
| Recognition is not authorization (BR-AR-003, INV-08) | `reveal(scope, event)`: `event` is only a hint that must equal the scope's own binding; no function maps a target id to media; one `not_found` shape for every non-match | Server tests (harness level) |
| Camera-free path (BR-AR-004) | `content(scope)` shares `RevealContent` and authorization with `reveal` | Server test: same content; readability tests |
| Provider metadata stays in the adapter (ADR-005) | `providerMetadata: unknown`, never in DTOs | Review |

Gaps found in the **harness** that the real port must not copy:

1. `manifest.mjs` replaces the `artifact` pointer of a version in place, so the manifest keeps no history of earlier artifacts (the files stay, because ids are content-addressed). The real store must be an append-only ledger; the Order version must reference an `ArtifactId`, not "the current artifact of the project".
2. The recognizer reports `targetIndex` as a bare number; for the production one-target artifact it must always be 0, and the server must still check it.
3. The test-only combined artifact has `targetCount > 1`. Production artifacts must have exactly one target (BR-AR-001).
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
| 8 | Upstream MindAR last published 2024-01-16 and audit warnings exist (transitive, install-time) | Medium for P05 | Already listed in `README.md`; LEAD weighs it in the decision |
| 9 | Library hides denial vs failure | Medium (UX) | Adapter-owned `getUserMedia` handling |

## 7. What to do with the device evidence

1. For each device class in P03's matrix, open the harness over HTTPS with DevTools / remote inspector (Chrome: `chrome://inspect`; Safari: Web Inspector on a Mac) and fill `evidence/P04-observations-template.md`.
2. Any off-origin request, any request containing more than the three known API shapes, or any storage entry created by the library is a finding to report, not something to remove from the record.
3. When the table in section 1 has real results, change the status line at the top and tick the acceptance boxes in the task.

## 8. Out of scope

Final Sharing subsystem, public media endpoints, cookie sessions, payment, and any production AR code.
