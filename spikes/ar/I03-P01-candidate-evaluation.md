# I03-P01 — AR Candidate Evaluation against ADR-005

- Item: [I03 Early AR Technology Spike](../../planning/I03-early-ar-technology-spike.md)
- Task: I03-P01 (owner MEMBER_3, reviewer LEAD)
- Status: **DONE — research deliverable** (2026-10-23 closeout reconciliation; evaluation only, no SDK selected), revision r2
- Branch: `feature/I03-P01-ar-candidate-evaluation`
- Date of web research: 2026-10-15 (all `[Sx]` sources below were accessed on this date)

> **No SDK is selected in this document.** Selection belongs to LEAD in I03-P05 after real-device evidence (P02–P04). Nothing here edits `docs/` (frozen authority) or ADR-005.

## 0. Revision notes (r2, response to review)

| Review point | What changed |
| --- | --- |
| Source traceability | §9 is now a numbered source register `[S1]`–`[S17]` with URL, primary/secondary flag and what each source supports. Every important claim in §3/§4 carries a `[Sx]` tag. Claims with no first-hand source are marked "unverified". |
| Matrix coverage | Two new rows: **Target preparation / artifact generation** and **Camera frame processing / transfer**. The old "Privacy" row is narrowed to **third-party calls / artifact exposure** to avoid overlap. |
| Evidence status | Every cell that still said "expected / claimed / verify / confirm" is now **Partial** (or Unknown), never OK. Remaining **OK** cells have first-hand documentation behind them. |
| Wording | C3 Zappar: "likely conflicts with architecture" → "potential architecture/privacy compatibility risk". Recognition ≠ authorization is restated in §1 and §5. |
| Corrections found while adding sources | (a) C4 8th Wall: the project has since moved to open source at 8thwall.org (MIT framework without SLAM, Image Target Processor CLI, free limited-use engine binary) [S3][S4], so "wound down / unmaintained" in r1 was too strong. (b) C3: first-hand Zappar pages now exist [S12][S13]; r1's "free dev license watermarks" is not supported (the plans page only shows a Zappar-branded launch screen for Studio/Designer projects). (c) C1: the MIT license is confirmed only for a third-party TypeScript rewrite [S9], not for upstream `mind-ar-js`. (d) The 2027-02-28 date in r1 relates to Niantic Spatial services (VPS etc.) [S2], not to "hosted projects stay live". |

## 1. Purpose and rules this evaluation must respect

| Rule | Consequence for candidates |
| --- | --- |
| BR-AR-001 | One designated target + one genuine reveal. Image + meaningful message is enough; video/audio not required. |
| BR-AR-002 | Target artifact must be bound to the Order version; later Project edits cannot remap it. |
| BR-AR-003 / INV-08 | Recognition is not authorization. No global target→media lookup. Unknown/ambiguous target reveals nothing private. |
| BR-AR-004 | Denied/unsupported camera → authorized non-AR fallback with the same content. |
| ADR-005 | QR/direct-link-only or mocked "scan" cannot satisfy genuine AR. Provider metadata stays in the adapter. |
| Product Scope OUT | Native mobile apps are out, so native-only SDKs are not candidates. |

**Invariant restated (recognition ≠ authorization).** Even if a target artifact (or a recognition result) is obtained by someone who is not authorized, the backend must still check the caller's authorized Order/share scope before revealing any private content. Protecting artifact URLs is defense in depth, not the control. No candidate may be scored as "safe" because its artifact is hard to find.

## 2. Candidates

| # | Candidate | Type | Why considered |
| --- | --- | --- | --- |
| C1 | MindAR (image tracking) | Open-source JS, runs in the browser | Compile target to a `.mind` file, three.js/A-Frame integration [S8] |
| C2 | AR.js (NFT / image) | Open-source JS (artoolkit-based) | Long-standing web image tracking [S10] |
| C3 | Zappar Universal AR / ZapWorks | Commercial SDK + hosting platform | Mature WebAR image tracking [S12][S13][S14] |
| C4 | 8th Wall (engine binary + open-source modules) | Former commercial platform, now free/open-source distribution | Strong historical WebAR reputation; status changed since r1 [S1][S3][S4] |
| C5 | Custom CV (OpenCV.js / TF.js feature matching) | Build-our-own | Full control over privacy and version binding |
| C6 | WebXR image tracking | Browser standard (draft) | No third-party SDK [S16] |
| — | Native Vuforia / ARCore / ARKit | Native SDKs | **Excluded**: native apps are OUT of scope |
| — | QR / link-only "scan" | Navigation | **Rejected by ADR-005** as AR acceptance (still useful only as fallback navigation) |

## 3. Evaluation matrix

Legend: **OK** = supported by first-hand documentation found; **Partial** = partial, or still needs a prototype question answered (anything "expected / claimed / to verify" is Partial); **Unknown** = no evidence yet; **Against** = documented evidence against.
`[Sx]` points to the source register in §9. "Evidence" means documentation/web sources only. **No cell is device-verified yet**; that is the job of I03-P02/P03.

| Criterion (ADR-005) | C1 MindAR | C2 AR.js NFT | C3 Zappar | C4 8th Wall | C5 Custom CV | C6 WebXR |
| --- | --- | --- | --- | --- | --- | --- |
| Web/mobile support | Partial: browser JS, TF.js WebGL backend [S8][S9]; iOS Safari / Android Chrome not tested by us | Partial: browser JS image tracking [S10]; not tested by us | Partial: vendor/press describes mobile-web image tracking [S14, secondary]; not tested | Partial: vendor docs describe a browser WebAR engine [S7]; not tested | Partial: depends on our own implementation | Against: image tracking is draft-spec and needs a Chrome flag on Android [S16]; Safari on iPhone reported without WebXR [S17] (both secondary; re-check current compat tables) |
| Reliability (distance/light/orientation) | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| **Target preparation / artifact generation** | Partial: browser-based compiler produces `.mind` [S8]; headless/CI use and deterministic output not verified (P02 Q4) | Partial: NFT descriptors come from a separate generator tool in AR-js-org [S11]; its license and determinism not checked | Unknown: ZapWorks target tooling not read first-hand yet | Partial: Image Target Processor CLI / Desktop app produce target metadata JSON + images [S3][S6]; CI use and determinism unverified; [S4] footnotes Image Targets as "binary only", so what is runnable needs confirming | Partial: ours to design; highest effort | Partial: reference images are handed to the browser at session start (via wrapper API) [S16]; no precompiled artifact, so the source image itself is the recognition asset and needs authorized delivery |
| **Camera frame processing / transfer** | Partial: detection described as in-browser on TF.js [S9]; sources do not state "no upload" either way → network trace in P02 | Partial: in-browser tracking library [S10]; no explicit statement on uploads → network trace | Partial: browser library [S14]; init contacts ZapWorks for a license check [S12]; whether anything frame-related leaves the device is not established | Partial: closed-source binary [S2][S5], cannot be audited → network trace only | Partial: fully ours if kept client-side; server-side recognition would upload frames (avoid, BR-AR-003) | Unknown: how tracking results/frames are exposed to the page not read first-hand |
| Privacy: third-party calls / artifact exposure | Partial: examples load library and targets from a public CDN [S8]; self-hosting looks possible (confirm); no provider service seen; confirm by trace | Partial: examples load from public CDN hosts [S10]; same open points | Partial: init license check contacts the vendor [S12]; non-Enterprise content must be Zappar-hosted on `*.zappar.io` (inferred from [S12][S13]) → potential privacy compatibility risk with private same-origin delivery | Partial: binary can be run from our own copy [S1][S5]; closed source, so third-party calls not auditable by reading | Partial: ours to guarantee | Partial: browser-native, no third-party SDK; frame handling open (see row above) |
| HTTPS / camera | Partial: `getUserMedia` needs HTTPS; test on Vercel preview | Partial: same | Partial: vendor docs require HTTPS for self-hosted content [S13]; test on preview | Partial: same | Partial: same | Partial: same |
| Licensing / cost | Partial: upstream LICENSE not read first-hand; MIT confirmed only for a third-party TS rewrite [S9] | Partial: AR.js code MIT; artoolkit5-js LGPLv3 with additional permission [S10]; generator tool license unchecked; LGPL obligations for bundling need reading | Against: self-hosting only on Enterprise (1 domain, 100k views/yr); Developer/Pro/Education plans show self-hosted = not included [S12][S13] | Partial: engine binary free but limited-use, no modify/recompile/altered redistribution [S1][S2][S5]; open-source modules MIT [S3][S4]; exact binary license text for coursework not read | Partial: OpenCV/TF.js licenses not checked | OK: web standard, no third-party SDK license |
| Offline/online needs | Partial: target file + library fetched; honest-unavailable UX needed | Partial: same | Partial: license check at library init [S12]; whether it needs network at that moment is inferred, confirm by trace | Partial: Buildable Code Export is designed for offline/local running [S1][S2] | Partial: ours to define | Partial |
| Integration complexity | Partial: medium (npm/CDN, three.js/A-Frame, compile step) [S8] | Partial: medium (NFT descriptor tooling) [S10][S11] | Partial: medium + account/plan constraints [S12][S13] | Partial: medium-high (binary + MIT modules, A-Frame/three.js docs [S7]); project continues as community-run open source [S3], long-term support level unverified | Against: highest (detector, matcher, prep pipeline all ours) | Partial: low code, low reach |
| Version binding (BR-AR-002) | Partial: compiled `.mind` is a static file → can be keyed by revision hash; prove in P02 | Partial: NFT descriptor set per image → same approach; prove | Unknown: target format/tooling not read first-hand | Partial: target metadata JSON + images are static files [S6] → can be keyed by hash; prove | Partial: ours to prove | Partial: images supplied per session; binding is ours to enforce |
| Fallback / accessibility (BR-AR-004) | Partial: by design independent of SDK (same authorized content endpoint); demonstrate in P02 Q6 | Partial: same | Partial: same | Partial: same | Partial: same | Partial: same |

## 4. Candidate notes and evidence gaps

### C1 — MindAR
- **What we know:** web library supporting image and face tracking; target images are compiled into a `.mind` file with a browser-based compiler; integrates with A-Frame and three.js [S8]. A third-party TypeScript rewrite (MIT) states that it uses TensorFlow.js with a WebGL backend [S9]; upstream is expected to be similar but that is not confirmed.
- **Evidence gaps:** (1) maintenance/release cadence of upstream `mind-ar-js` [S8] vs the third-party rewrite [S9]; (2) iOS Safari and mid-range Android frame rate; (3) whether compile can run in Node/CI (deterministic artifacts) or only in the browser tool; (4) behavior with similar-looking targets (ambiguity → must reveal nothing); (5) bundle size and TF.js backend (WebGL/WASM) fallback; (6) exact upstream LICENSE text and third-party model licenses.
- **Camera/artifact redistribution:** `.mind` file is a derived artifact of our synthetic image; it should contain feature data, not frames (to confirm by inspecting a compiled file). Serve it only behind authorization as defense in depth; per §1, a leaked `.mind` must still reveal nothing private.

### C2 — AR.js NFT
- **What we know:** AR.js offers image tracking, location-based AR and marker tracking; its own code is MIT and the artoolkit5-js dependency is LGPLv3 with additional permission [S10]; image descriptors are produced by a separate generator in the same org [S11]. MindAR's README points to AR.js for location/marker tracking [S8].
- **Evidence gaps:** (1) current maintenance state; (2) descriptor generator tooling and its license; (3) tracking quality on plain calendar-page imagery; (4) iOS support; (5) practical LGPL obligations when bundling.

### C3 — Zappar Universal AR / ZapWorks
- **What we know (first-hand vendor docs):** a license check runs when the Universal AR library initializes and self-hosted sites must register their domain; self-hosting is offered only on Enterprise plans with 1 free web license [S12]. The plans page shows self-hosted as not included for Developer, Pro and Education, and 1 domain / 100k views per year for Enterprise [S13]. Press coverage describes face, image and world tracking for mobile web with three.js/A-Frame bindings [S14, secondary]. A competitor blog reports the same self-hosting/license-check points [S15, secondary, now superseded by S12/S13].
- **Evidence gaps:** how ZapWorks prepares and delivers image targets (not read first-hand); whether any course/education arrangement permits our hosting (Vercel/Render); whether serving from vendor domains is compatible with BR-AR-003 and private media delivery.
- **Risk (not a conclusion):** potential architecture/privacy compatibility risk with our same-origin private-delivery design, plus a plan/cost constraint for self-hosting. Keep on the matrix; not a prototype target unless LEAD asks.

### C4 — 8th Wall (engine binary + open-source modules)
- **What we know (primary sources):** hosted platform access ended 2026-02-28 [S1]; a free, closed-source engine binary was released with a limited-use license, no source access, and no right to modify, recompile or redistribute in altered form [S1][S2][S5]; features that depend on Niantic Spatial services (VPS, Maps, Geospatial Browser) are not included and are unavailable offline after 2027-02-28 [S2]. Since r1, 8th Wall has moved to 8thwall.org as a free open-source project: an MIT-licensed engine framework without SLAM, including Image Targets, plus an Image Target Processor CLI; SLAM stays binary-only [S3][S4]. Image targets are generated with `npx @8thwall/image-target-cli` and tracked from metadata JSON files, up to 32 simultaneously [S6]. The binary is installable from npm / script tag [S5].
- **Evidence gaps:** [S4] lists Image Targets as open source but footnotes it "available via XR engine binary only": confirm what can actually run without the binary; exact binary license text for coursework/demo; long-term maintenance of the community project; whether image-target compile runs in CI.
- **Status change:** r1 described this as wound-down/unmaintained and high risk. With [S3][S4] that is no longer supported. It stays Partial everywhere; it is **not** added to the prototype list by this document. LEAD may decide whether it deserves a P02 slot.

### C5 — Custom computer vision
- **What we know:** only option with full control over privacy and version binding; also the most implementation work (feature detection, matching, pose or at least "match/no-match", target preparation).
- **Evidence gaps:** realistic effort for a student team; mobile performance in WASM; false-positive rate on ambiguous targets; OpenCV.js / TF.js license check. Treat as the fallback plan if C1/C2 fail.
- **Warning:** any design that uploads camera frames to the backend must be justified against BR-AR-003/NFR privacy and is not preferred.

### C6 — WebXR image tracking
- **What we know (secondary sources):** the image-tracking API is still a draft; on Android it needs Chrome's "WebXR Incubations" flag [S16]; Safari on iPhone is reported as not supporting WebXR [S17]; the iOS route in [S16] goes through a native App Clip, which is out of scope for us.
- **Evidence gaps:** current official compatibility tables (not consulted); how frames/results reach page code. Probably unusable as the primary path because P0 needs supported mobile devices; listed so the exclusion is documented.

## 5. Camera processing and artifact redistribution (what must be understood)

| Question | Why it matters | How P02/P04 will answer |
| --- | --- | --- |
| Where are camera frames processed? | NFR privacy; BR-AR-003 | Browser DevTools network capture during a scan; expect zero frame uploads (matrix row "Camera frame processing / transfer") |
| What does the prepared artifact contain, and who may fetch it? | Public artifact URL could enable recognition without authorization | Serve through an authorized endpoint in the harness; test unauthenticated fetch. **Also test that a successfully fetched artifact + successful recognition still reveals nothing without authorized Order/share scope** (§1 invariant) |
| Does recognition output include any ID that maps to media? | Global lookup is forbidden | Recognition returns only an opaque target index/hash; backend resolves within the share's Order version |
| Can artifacts be re-generated identically from a given source version? | BR-AR-002 | Compile twice from the same image; compare hashes; record the source image hash in artifact metadata (matrix row "Target preparation") |
| License restrictions on redistributing the SDK or artifacts | Course/demo use | Read each LICENSE first-hand; record in P05 handoff |

## 6. Questions the I03-P02 prototypes must answer

1. Does a prepared **synthetic** calendar-page image genuinely resolve to its intended image + message on a real phone over HTTPS?
2. Does a different/unknown image reveal nothing (and no unrelated fixture)?
3. With two synthetic versions (A and B) of the same project, does an A-scoped session never reveal B's content, even if B's target is presented?
4. Are artifact files identifiable by source version (hash/revision), and can they be reproduced?
5. Does Start/Exit stop the camera tracks and release the camera indicator?
6. What happens on permission denial and on unsupported devices, and does fallback show the same image + message?
7. If an unauthorized party fetches the target artifact and recognizes the target, does the backend still refuse to reveal private content? (recognition ≠ authorization)

These are prototype questions, not performance targets. No numeric thresholds are invented here.

## 7. Proposed port shape (sketch only, for P04 review)

```ts
// Provider-neutral. Adapter-specific data stays inside `providerMetadata`.
interface ARPreparationPort {
  prepare(input: {
    projectRevisionId: string;
    sourceImageSha256: string;
  }): Promise<{
    artifactId: string;            // immutable
    sourceRevisionId: string;      // BR-AR-002
    sourceImageSha256: string;
    providerMetadata: unknown;     // adapter-bound, never exposed in DTOs
  }>;
}
// Recognition result is local to the client; the backend resolves content
// only inside the caller's authorized share -> Order version.
```

This is a sketch to guide review. It is not a contract change; any API change follows DEV_WORKFLOW §11.

## 8. Preliminary prioritization (not a decision)

Order to **prototype first**, to produce evidence cheaply:

1. **C1 MindAR**: open-source, client-side, simplest path to a real prepared-target scan.
2. **C2 AR.js NFT**: second open-source comparison if C1 fails on devices.
3. **C5 Custom CV**: only if both fail or license/privacy review rules them out.

C3, C4 and C6 stay on the matrix with listed risks; they are not prototype targets unless LEAD asks. Note for LEAD: C4's picture changed since r1 (§4), so it is the one most worth a second look if C1/C2 disappoint.

## 9. Sources (web research on 2026-10-15; secondary sources flagged)

| ID | Type | Source | Supports |
| --- | --- | --- | --- |
| S1 | Primary | Niantic Spatial blog, "Buildable Code Export Now Available" — https://info.nianticspatial.com/blog/buildable-code-export-now-available | Platform access ends 2026-02-28; binary cannot be modified, recompiled or redistributed in altered form; VPS and platform services not included; offline export |
| S2 | Primary | Niantic Spatial blog, "8th Wall Transition Update: Engine Distribution and Open Source Plans" — https://info.nianticspatial.com/blog/8th-wall-update-engine-distribution-and-open-source-plans | Free closed-source binary, no source access; Niantic Spatial features unavailable offline after 2027-02-28 |
| S3 | Primary | "8th Wall is now open source" — https://8thwall.org/blog/8th-wall-open-source (mirror: https://info.nianticspatial.com/blog/8th-wall-open-source) | MIT engine framework without SLAM, Image Targets, Image Target Processor CLI; SLAM binary-only; community governance |
| S4 | Primary | 8thwall.org home/FAQ — https://8thwall.org/ | Open-source components under MIT; binary under limited-use license permitting commercial use as part of a broader app; Image Targets footnote "binary only" |
| S5 | Primary | GitHub, 8thwall/engine (distributed binary) — https://github.com/8thwall/engine | npm `@8thwall/engine-binary`, script-tag usage, includes Image Targets, no source/modify, limited-use license |
| S6 | Primary | 8th Wall docs, Image Targets — https://8thwall.org/docs/engine/guides/image-targets | CLI `npx @8thwall/image-target-cli@latest`, metadata JSON, up to 32 simultaneous targets |
| S7 | Primary | 8th Wall docs home — https://8thwall.org/docs | Engine described as WebAR for browsers; A-Frame/three.js/PlayCanvas/Babylon.js integration |
| S8 | Primary | MindAR upstream repo https://github.com/hiukim/mind-ar-js and docs https://hiukim.github.io/mind-ar-js-doc (compiler: https://hiukim.github.io/mind-ar-js-doc/tools/compile) | Image + face tracking, `.mind` compiler, A-Frame/three.js, CDN examples. **Upstream LICENSE text not read first-hand** |
| S9 | Secondary (third-party rewrite) | https://github.com/krsbx/mind-ar-ts | TypeScript rewrite of MindAR, MIT, TF.js with WebGL backend. Not upstream |
| S10 | Primary | AR.js repo — https://github.com/AR-js-org/AR.js | Image tracking/location/marker; AR.js code MIT; artoolkit5-js LGPLv3 with additional permission; npm `@ar-js-org/ar.js` |
| S11 | Primary | AR-js-org organization page — https://github.com/AR-js-org | Separate image-descriptor generator for AR.js; artoolkit5-js port |
| S12 | Primary | Zappar docs, Universal AR licensing — https://docs.zap.works/universal-ar/general/licensing/ | License check at library init; domain registration for self-hosting; self-hosting only on Enterprise (1 free web license); no registration needed on `*.zappar.io` |
| S13 | Primary | Zappar docs, Workspace plans — https://docs.zap.works/workspaces/workspace-plans/ (self-hosting page: https://docs.zap.works/universal-ar/unity/testing-and-publishing/self-hosting/) | Self-hosted: not included for Developer/Pro/Education, 1 domain and 100k views/yr for Enterprise; HTTPS required for self-hosted content |
| S14 | Secondary (press) | App Developer Magazine on Zappar Universal AR — https://appdevelopermagazine.com/zappar-computer-vision-libraries-now-available-as-sdks/ | Face/image/world tracking in mobile web browsers; three.js/A-Frame at launch |
| S15 | Secondary (competitor blog) | Banuba — https://www.banuba.com/blog/best-web-ar-face-tracking | Cross-check of Zappar self-hosting/license-check; superseded by S12/S13 |
| S16 | Secondary (third-party vendor docs) | Needle Engine, WebXR image tracking — https://engine.needle.tools/docs/how-to-guides/xr/image-tracking | Draft spec; Android Chrome "WebXR Incubations" flag; iOS route via App Clip; images passed with URL + width |
| S17 | Secondary (third-party docs) | Galacean XR compatibility — https://galacean.antgroup.com/engine/en/docs/xr/compatibility/ | Safari on iPhones does not support WebXR |

## 10. Acceptance checklist for I03-P01

- [x] Each candidate has evidence gaps listed (§4).
- [x] Camera processing and artifact redistribution are covered (§5) and are explicit matrix criteria (§3: "Target preparation / artifact generation", "Camera frame processing / transfer").
- [x] Important claims are traceable to numbered sources (§9); secondary sources are flagged.
- [x] No cell is OK while it still depends on "expected / claimed / verify".
- [x] Recognition ≠ authorization restated (§1, §5, §6 Q7).
- [x] No SDK is labeled selected (§8 is explicitly a prototype order, not a decision).
