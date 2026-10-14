# I03-P01 — AR Candidate Evaluation against ADR-005

- Item: [I03 Early AR Technology Spike](../../planning/I03-early-ar-technology-spike.md)
- Task: I03-P01 (owner MEMBER_3, reviewer LEAD)
- Status: **IN_REVIEW** (evaluation only, no code, no dependency added)
- Branch: `feature/I03-P01-ar-candidate-evaluation`
- Date of web research: 2026-10-15

> **No SDK is selected in this document.** Selection belongs to LEAD in I03-P05 after real-device evidence (P02–P04). Nothing here edits `docs/` (frozen authority) or ADR-005.

## 1. Purpose and rules this evaluation must respect

| Rule | Consequence for candidates |
| --- | --- |
| BR-AR-001 | One designated target + one genuine reveal. Image + meaningful message is enough; video/audio not required. |
| BR-AR-002 | Target artifact must be bound to the Order version; later Project edits cannot remap it. |
| BR-AR-003 / INV-08 | Recognition is not authorization. No global target→media lookup. Unknown/ambiguous target reveals nothing private. |
| BR-AR-004 | Denied/unsupported camera → authorized non-AR fallback with the same content. |
| ADR-005 | QR/direct-link-only or mocked "scan" cannot satisfy genuine AR. Provider metadata stays in the adapter. |
| Product Scope OUT | Native mobile apps are out, so native-only SDKs are not candidates. |

## 2. Candidates

| # | Candidate | Type | Why considered |
| --- | --- | --- | --- |
| C1 | MindAR (image tracking) | Open-source JS, runs in the browser | Compile target to a `.mind` file, three.js/A-Frame integration |
| C2 | AR.js (NFT / image) | Open-source JS (jsartoolkit-based) | Long-standing web image tracking |
| C3 | Zappar Universal AR / ZapWorks | Commercial SDK + hosting platform | Mature WebAR image tracking |
| C4 | 8th Wall engine binary | Former commercial platform, now wound down | Strong historical WebAR reputation |
| C5 | Custom CV (OpenCV.js / TF.js feature matching) | Build-our-own | Full control over privacy and version binding |
| C6 | WebXR image tracking | Browser standard | No third-party SDK |
| — | Native Vuforia / ARCore / ARKit | Native SDKs | **Excluded**: native apps are OUT of scope |
| — | QR / link-only "scan" | Navigation | **Rejected by ADR-005** as AR acceptance (still useful only as fallback navigation) |

## 3. Evaluation matrix

Legend: **OK** = supported by evidence found; **Partial** = partial, or needs a prototype question answered; **Unknown** = no evidence yet; **Against** = evidence against.
"Evidence" below means documentation/web sources only. **No cell is device-verified yet**; that is the job of I03-P02/P03.

| Criterion (ADR-005) | C1 MindAR | C2 AR.js NFT | C3 Zappar | C4 8th Wall | C5 Custom CV | C6 WebXR |
| --- | --- | --- | --- | --- | --- | --- |
| Web/mobile support | Partial: Browser JS on TF.js; iOS Safari/Android Chrome unverified | Partial: Browser JS; same gap | Partial: Vendor claims mobile web; unverified by us | Unknown: Platform shut down; engine binary only | Partial: Depends on our own implementation | Against: Image tracking support is not broad; iOS Safari expected unsupported (**verify**) |
| Reliability (distance/light/orientation) | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| Privacy (frames / artifacts) | OK: Claimed client-side processing; **verify no frame upload via network trace** | OK: Expected client-side; verify | Partial: Library does a license check at init and content is normally served from Zappar domains | Partial: Binary closed; frame handling unauditable | OK: Fully ours; server-side recognition would upload frames (avoid) | OK: Browser-native |
| HTTPS / camera | Partial: Needs HTTPS `getUserMedia`; to test on Vercel preview | Partial: same | Partial: same | Partial: same | Partial: same | Partial: same |
| Licensing / cost | OK: MIT reported by package metadata (**confirm in repo LICENSE**) | Partial: Mixed / LGPL-family reports (**confirm exact terms**) | Against: Commercial; self-hosting reported as Enterprise-only; free dev license watermarks | Partial: Binary "cannot be modified, recompiled or redistributed in altered form" | OK: OpenCV/TF.js permissive (**confirm**) | OK: Standard |
| Offline/online needs | Partial: Target file + library fetched; honest-unavailable UX needed | Partial: same | Against: Online license check at init | Unknown | Partial: Ours to define | Partial |
| Integration complexity | Partial: Medium: npm package, three.js/A-Frame, compile step | Partial: Medium: NFT marker generation tooling | Partial: Medium + account/plan constraints | Against: High: unmaintained platform, binary-only | Against: Highest: write detector, matcher and prep pipeline | Partial: Low code, low reach |
| Version binding (BR-AR-002) | Partial: Compiled `.mind` is an immutable file → can be keyed by Order/Project revision hash; **prove in P02** | Partial: NFT marker set per image → same approach; prove | Partial: `.zpt` target tied to platform tooling | Unknown | OK: Fully ours | Unknown |
| Fallback / accessibility | OK: Independent of SDK (same authorized content endpoint) | OK: same | OK: same | OK: same | OK: same | OK: same |

## 4. Candidate notes and evidence gaps

### C1 — MindAR
- **What we know:** web library supporting image and face tracking; target images are compiled into a `.mind` file with a browser-based compiler; integrates with A-Frame and three.js; core detection is TensorFlow.js-based; a TypeScript rewrite exists on npm under MIT.
- **Evidence gaps:** (1) maintenance/release cadence of the upstream `mind-ar` package; (2) iOS Safari and mid-range Android frame rate; (3) whether compile can run in Node/CI (deterministic artifacts) or only in the browser tool; (4) behavior with similar-looking targets (ambiguity → must reveal nothing); (5) bundle size and TF.js backend (WebGL/WASM) fallback; (6) exact LICENSE text and third-party model licenses.
- **Camera/artifact redistribution:** `.mind` file is a derived artifact of our synthetic image; it contains feature data, not frames. Confirm it can be served only behind authorization, since a public `.mind` URL would let anyone fetch recognition data.

### C2 — AR.js NFT
- **What we know:** AR.js is the established open-source WebAR project and is the one MindAR's own README points to for location/marker tracking.
- **Evidence gaps:** (1) current maintenance state; (2) NFT marker generation tooling and its license; (3) tracking quality on plain calendar-page imagery; (4) iOS support; (5) exact license mix across jsartoolkit components.

### C3 — Zappar Universal AR / ZapWorks
- **What we know:** commercial WebAR SDK with image, face and world tracking and three.js/A-Frame bindings; a vendor-neutral comparison (secondary source, from a competitor's blog) reports that self-hosting is limited to Enterprise plans, a license check runs at library init, and the free dev license watermarks output.
- **Evidence gaps:** need the vendor's own current license/pricing page; whether a course/demo plan permits our hosting (Vercel/Render), and whether serving from vendor domains conflicts with BR-AR-003 and private media delivery.
- **Preliminary risk:** likely conflicts with our same-origin private-delivery architecture. Keep on the matrix only until the licence page is read first-hand.

### C4 — 8th Wall engine binary
- **What we know (primary sources):** hosted platform access ended 2026-02-28; hosted projects stay live until 2027-02-28; an engine binary and some tooling (e.g., Image Target Processor) were released; the binary cannot be modified, recompiled or redistributed in altered form; Niantic Spatial VPS is not included.
- **Evidence gaps:** exact binary license for coursework/demo; how image targets are prepared outside the hosted platform; no vendor support after wind-down.
- **Preliminary risk:** high maintenance/licensing risk for a project that must work through the final assessment.

### C5 — Custom computer vision
- **What we know:** only option with full control over privacy and version binding; also the most implementation work (feature detection, matching, pose or at least "match/no-match", target preparation).
- **Evidence gaps:** realistic effort for a student team; mobile performance in WASM; false-positive rate on ambiguous targets. Treat as the fallback plan if C1/C2 fail.
- **Warning:** any design that uploads camera frames to the backend must be justified against BR-AR-003/NFR privacy and is not preferred.

### C6 — WebXR image tracking
- **Evidence gaps:** per-browser support for image tracking (believed limited and not available on iOS Safari — **verify against current compatibility tables before relying on it**). Probably unusable as the primary path because P0 needs supported mobile devices; listed so the exclusion is documented.

## 5. Camera processing and artifact redistribution (what must be understood)

| Question | Why it matters | How P02/P04 will answer |
| --- | --- | --- |
| Where are camera frames processed? | NFR privacy; BR-AR-003 | Browser DevTools network capture during a scan; expect zero frame uploads |
| What does the prepared artifact contain, and who may fetch it? | Public artifact URL could enable recognition without authorization | Serve through an authorized endpoint in the harness; test unauthenticated fetch |
| Does recognition output include any ID that maps to media? | Global lookup is forbidden | Recognition returns only an opaque target index/hash; backend resolves within the share's Order version |
| Can artifacts be re-generated identically from a given source version? | BR-AR-002 | Compile twice from the same image; compare hashes; record the source image hash in artifact metadata |
| License restrictions on redistributing the SDK or artifacts | Course/demo use | Read each LICENSE first-hand; record in P05 handoff |

## 6. Questions the I03-P02 prototypes must answer

1. Does a prepared **synthetic** calendar-page image genuinely resolve to its intended image + message on a real phone over HTTPS?
2. Does a different/unknown image reveal nothing (and no unrelated fixture)?
3. With two synthetic versions (A and B) of the same project, does an A-scoped session never reveal B's content, even if B's target is presented?
4. Are artifact files identifiable by source version (hash/revision), and can they be reproduced?
5. Does Start/Exit stop the camera tracks and release the camera indicator?
6. What happens on permission denial and on unsupported devices, and does fallback show the same image + message?

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

C3, C4 and C6 stay on the matrix with listed risks; they are not prototype targets unless LEAD asks.

## 9. Sources (web research on 2026-10-15; secondary sources flagged)

- Niantic Spatial blog: 8th Wall next chapter and Buildable Code Export (platform end 2026-02-28; engine binary restrictions).
- 8th Wall migration FAQ (hosted projects live until 2027-02-28; VPS not included).
- MindAR README / npm page of the TypeScript rewrite (features, `.mind` compiler, TF.js core, MIT on the rewrite).
- Banuba comparison blog (**secondary, competitor**): Zappar self-hosting and license-check claims, to be confirmed on Zappar's own pages.
- Zappar Universal AR press coverage (feature set).

## 10. Acceptance checklist for I03-P01

- [x] Each candidate has evidence gaps listed (§4).
- [x] Camera processing and artifact redistribution are covered (§5).
- [x] No SDK is labeled selected (§8 is explicitly a prototype order, not a decision).
