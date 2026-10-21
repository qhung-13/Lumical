# I03-P05 — AR Technology Recommendation

## 1. Decision status

- **Status: PROVISIONAL** — not final/Done.
- **Recommendation: PROVISIONAL SELECT WITH CONDITIONS — MindAR image tracking**.
- Owner: LEAD; independent teammate review and final LEAD approval: **pending**.
- Recorded: 2026-10-21, on `feature/I03-P05-ar-technology-recommendation`.
- Evidence baseline: `6c252b84571ae1bb923f0dadb2f20452566ae2c9`; working tree clean before this document. P01–P04 are present.
- P03 acceptance: **incomplete**. Its measured harness baseline is `0654135`; subsequent changes through the evidence baseline add P03 records/scripts, not harness fixes.
- P06: **not yet unlocked** for accepted-direction reproduction.

LEAD authorized this provisional recommendation and documentation only. This record does **not** authorize production AR implementation, change an ADR, or establish supported mobile browsers. Planning dependencies remain gates, including inherited I00 acceptance; code/PR presence alone does not establish completion.

## 2. Decision question

Based on P01–P04 evidence, is MindAR an appropriate P0 AR direction for LumiCal, under what conditions and residual risks?

[I03-P05 planning](../../planning/I03-early-ar-technology-spike.md#i03-p05) requires a recommendation citing real-device/privacy/license evidence, an explicit selected approach or blocker, reviewed downstream port/version/fallback implications, an evidence-completeness audit and teammate review. Production preparation, recipient integration and scope redesign are outside this decision record.

## 3. Mandatory LumiCal constraints

| Constraint | Authority |
| --- | --- |
| AR is mandatory P0: a genuine target → personalized reveal. An image plus meaningful readable message is sufficient; advanced/multi-target effects are not required. | [Product Scope §13](../../docs/PRODUCT_SCOPE.md#13-ar-product-scope--signature-final-project-experience); [Business Rules §9](../../docs/BUSINESS_RULES.md#9-ar-experience), BR-AR-001 and BR-MED-001; [ADR-005](../../docs/adr/ADR-005-ar-provider-boundary.md) |
| Camera-free fallback returns the same authorized meaningful content. Missing media/revoked access produces an honest error. | Business Rules BR-AR-004/005 |
| Recognition is not authorization. No global recognized-target → private-media lookup; wrong/unknown/ambiguous targets reveal nothing unrelated. | Business Rules BR-AR-003; [Architecture §12](../../docs/ARCHITECTURE.md#12-ar-architecture-boundary) |
| Preparation binds to the correct Project revision; Orders retain their captured target/media/fallback. Later edits cannot remap historical Orders. | BR-AR-002; Architecture §§12/15; [Database §14](../../docs/DATABASE.md#14-immutable-snapshot-strategy) |
| Provider details stay behind the AR boundary. Production application/server access control replaces spike bearer tokens and sessionStorage. | ADR-005; Architecture §§12/14/19; [API Contract §17, recipient endpoints](../../docs/API_CONTRACT.md#owner-sharing-and-recipient-access) |
| Core P0 AR must not require paid SDK licensing, mandatory paid runtime access, recurring AR subscriptions, usage-based recognition fees or a required paid cloud AR service. Trials/temporary credits do not qualify. Ordinary application hosting is separate. | Explicit LEAD selection constraint authorizing this P05 record; not represented as an existing frozen BR/ADR amendment |

Real mobile HTTPS acceptance follows [Testing Strategy §13](../../docs/TESTING_STRATEGY.md#13-ar-acceptancedevice-testing). Reviewed changes follow [Development Workflow §§7–9](../../docs/DEV_WORKFLOW.md#7-review). [Roadmap §3](../../docs/ROADMAP.md#3-milestones) separates I03 selection from I08 preparation and I12 recipient integration.

## 4. Evidence register

Labels: **IMPLEMENTED** = present code; **TESTED/OBSERVED** = scoped recorded execution; **DOCUMENTED** = a source report, not independently rerun; **PROPOSED** = review sketch/condition; **NOT TESTED/OPEN** = no acceptance claim. Tests present in the tree are not automatically passing results for this baseline.

### P01

**DOCUMENTED:** [candidate evaluation](I03-P01-candidate-evaluation.md), revision r2, §§3/4/8, compares six directions and prioritizes MindAR, then AR.js NFT if needed, then custom CV. It is research, not device verification or final selection. Its corrected 8th Wall assessment supersedes r1's overly strong abandonment claim. Candidate facts were researched on 2026-10-15; no external research was refreshed for this record.

### P02

**IMPLEMENTED:** [harness README](README.md), [preparation](src/prepare.mjs), [provenance checks](src/provenance.mjs), [manifest/storage](src/manifest.mjs) and [scoped registry](src/registry.mjs): Node compilation, verified source hashes, full SHA-256 artifact identities, write-once files, version-scoped artifact/reveal routes and artifact-independent same-content fallback.

**TESTED, read-only on 2026-10-21:** committed A/B source hashes, artifact hashes, canonical IDs and sizes match [the manifest](fixtures/manifest.json). **DOCUMENTED:** A/B matching recompiles on 2026-10-18, Linux x64 / Node v22.22.2 / CPU, MindAR 1.2.5 / TF.js 4.22.0. This is recorded-toolchain reproducibility, not universal determinism; no recompile was run for this record. Historical Order safety requires retaining bound bytes, not recompiling identically forever.

Coverage exists in [real-artifact tests](test/real-artifacts.test.mjs), [identity tests](test/artifact-identity.test.mjs) and [server tests](test/server.test.mjs): wrong scope/index, unauthorized fetch, recognized-event mismatch, corruption/missing files and fallback. Injecting recognition events tests server refusal, not genuine camera recognition.

**OPEN:** production sharing/security, durable historical bindings and readiness. The manifest overwrites its current artifact pointer; retained files alone do not preserve binding history. Harness `READY` checks artifact integrity, not sufficient business readiness/provenance. These must not become production contracts.

### P03

**OBSERVED in [merged P03 matrix](evidence/I03-P03-device-browser-camera-matrix.md), §§2–10:** 2026-10-19, Ubuntu 26.04.1 LTS; Chrome 155.0.8059.84 and Firefox 158.0 (Puppeteer-managed). Both verdicts are **partial**. Recognition uses a Chrome fake-camera rig; Firefox recognition was not measured.

| Recorded observation | Scope / limit |
| --- | --- |
| Start/scanning/Stop works; Stop reaches `1 created, 0 live` | Desktop synthetic camera only; not mobile OS-indicator proof; restart acceptance not recorded |
| A: 6 found, 5 lost, 6 correct A reveals over 40 seconds | Chrome cycling rig, not physical phone scans |
| A 4/5 at 512×512; B 0/5 at 512×512 and 3/5 at native 1024×1024 | Five trials per configuration; resolution-sensitive. Preserve both B results; native success does not establish reliable mobile recognition |
| Main-thread evaluate round-trip 0–1 ms during scanning | Not device FPS or recognition latency |
| Permission denial **FAILS** on both desktop browsers | Browser returns NotAllowedError; MindAR start rejects undefined; client reads err.name and throws TypeError before cleanup/status update. Fallback link remains reachable; recovery is not passing |
| Automated DOM/keyboard checks 18/18; scoped fallback responses recorded | Not manual accessibility or screen-reader acceptance |
| Per-version wrong/unknown images reveal nothing | Some runs produce no recognition/request, so they do not establish server refusal. Combined-artifact recognition/refusal cases remain unexecuted |

**NOT TESTED:** current Redmi Note 13 Chrome and Mi Browser runs; mobile HTTPS/tunnel permission flow; physical lighting/distance/orientation; OS camera indicator after Stop; mobile performance/FPS; real inspector network capture. The previous phone run is explicitly superseded. P03 does not establish a supported mobile combination.

[Reproduction scripts](evidence/i03-p03-scripts/README.md) separate lifecycle, denial isolation, trial and automated accessibility checks. They were inspected, not executed for this documentation pass.

### P04

**DOCUMENTED/static:** [P04 review](I03-P04-privacy-fallback-port-review.md), §§1–6, remains partial. Page/module inspection supports an on-device recognition path and a limited same-origin request surface. **OPEN:** actual runtime transfers/storage; CSP and off-origin logs supplement a trace and cannot prove no frame data leaves the device.

**IMPLEMENTED/harness coverage:** same scoped content without artifact availability, readable DOM text/alt attributes, and stale-reveal abort/generation protection. Manual device readability, denied/unsupported flows and storage/network observations remain incomplete.

**PROPOSED:** [provider port r2](port/ar-provider-port.ts) separates artifact byte identity from source binding and keeps provider indexes internal. It is not a production-approved API. Some [conformance tests](test/port-conformance.test.mjs) assert sketch text rather than execute a production adapter.

## 5. Decision matrix

Statuses describe current evidence, not final production acceptance. No numeric scoring or new performance threshold is introduced.

| Criterion | Evidence | Status | Limitation / risk | Decision impact |
| --- | --- | --- | --- | --- |
| Recognition feasibility | P03 genuine engine events/reveals from synthetic video | PARTIAL | Small trials; resolution-sensitive | Continue; obtain physical mobile repeatability |
| Mobile/browser feasibility | P03 mobile rows untested | OPEN | No current mobile support claim | Final-selection blocker |
| Camera lifecycle | P03 desktop Start/Stop, zero live tracks | PARTIAL | Mobile indicator/restart/exit evidence missing | Complete scoped lifecycle evidence |
| Permission/error handling | P03 denial crash; unchanged client catch | FAIL | Undefined rejection; no validated workaround | Fix/disposition and retest before acceptance |
| Artifact preparation | P02 artifacts, hashes and recorded recompiles | PASS WITH CONDITION | Environment-specific, internal compiler imports | Pin/record toolchain; retain bytes |
| Source/version binding | Source provenance and immutable files; port sketch | PASS WITH CONDITION | Current pointer lacks durable history; stale-result handling downstream | Explicit I08/Order conditions |
| Authorization boundary | Scope-first registry; negative test coverage | PASS WITH CONDITION | Synthetic sessions lack real share/account lifecycle | Preserve approved application enforcement |
| Runtime privacy | P04 static review | OPEN | No real network/storage capture | Final-selection blocker |
| Fallback | Same scoped payload; no artifact dependency | PARTIAL | Manual/mobile/error-flow checks incomplete | Keep mechanism; close acceptance |
| Provider abstraction | P04 split records and index-free sketch | PASS WITH CONDITION | Not a reviewed production contract | Review contracts before implementation |
| Mandatory paid AR cost | Recorded MIT inspection; self-hosted runtime/compiler | PASS | Monetary conclusion only | Hard cost gate met on repository evidence |
| Licensing | Direct license metadata and documented upstream inspection | PARTIAL | Transitive obligations/redistribution review incomplete | Record applicable obligations and material restrictions |
| Dependency/security | Overrides and passing lock checks | PARTIAL | Audit snapshots conflict; disclosure check fails | Reconcile evidence, not automatic SDK rejection |
| Maintenance | Recorded old publication date; internal API coupling | PASS WITH CONDITION | Compatibility ownership needed; age alone does not prove abandonment | Assign owner and retest triggers |
| Developer complexity | Documented Node/harness workflow | PARTIAL | Canvas install workaround; mobile loading/performance unknown | Assess bounded workflow during remaining evidence runs |

## 6. Cost and licensing decision

**Mandatory paid AR SDK/runtime cost: PASS**.

This is a repository-based monetary conclusion: README §“Findings so far” records first-hand inspection of upstream MindAR's published MIT license; [package-lock.json](package-lock.json) identifies `mind-ar@1.2.5` as MIT. [The server](src/server.mjs) self-hosts vendor modules/artifacts and [the compiler](src/prepare.mjs) prepares targets locally. No required paid AR cloud API, runtime subscription, usage fee or license key is configured. P01's earlier upstream-license uncertainty is addressed by this later P02 evidence.

| Category | Disposition |
| --- | --- |
| SDK/runtime monetary cost | PASS for the recorded MindAR path; no trial/credits dependency |
| Application hosting | Separate infrastructure cost; not promised free forever |
| Optional infrastructure | Host/tunnel choices do not establish a required paid AR service; optional paid services may not become prerequisites for core P0 AR |
| Development tooling | Node preparation implemented; no paid compiler/tool requirement recorded |
| License compliance | OPEN in part: transitive-license review is incomplete. Record applicable notices/obligations for the resolved tree before reuse; MIT alone is not blanket legal/compliance clearance |

No external licensing or price research was performed. Revisit the monetary gate if the selected path gains a service/key/subscription dependency.

## 7. Current blockers to FINAL selection

1. **Current physical mobile evidence:** genuine prepared image/message reveal over HTTPS, repeat scans, wrong/unknown/version-negative outcomes and recorded device/OS/browser/light/distance/orientation/performance observations are missing.
2. **Runtime privacy:** no real inspector network/payload and storage observations for the intended device class; static review cannot close this gate.
3. **Denial failure:** currently unresolved, not fixed/retested and not a validated application workaround. Normalize provider behavior and retest clear feedback, fallback and cleanup. This is not evidence that desktop Stop fails or that MindAR must be rejected.
4. **Remaining P03 acceptance:** unsupported outcomes and required manual start/exit/fallback accessibility checks remain incomplete. Desktop fake-camera results cannot satisfy real-mobile acceptance.
5. **Evidence closure:** reconcile dependency reports and the failing disclosure check before claiming the pack passes. This is an evidence/check closure item, not an independently established security failure; minor status/count wording does not justify rejecting an SDK.

Production I08/I12 completion and exhaustive prototyping of all candidates are not P05 prerequisites.

## 8. Accepted risks / selection conditions

These are **PROPOSED conditions for eventual selection**, not claims that risks have already received final acceptance:

- Bound target/resolution sensitivity using demonstrated mobile conditions; retain failed trials and target-quality limitations.
- Claim only tested device/browser combinations, including honest unsupported/untested outcomes; no universal support promise.
- Pin compatible runtime/compiler dependencies and record preparation environment. Existing `--ignore-scripts`/canvas avoidance and overrides are harness trade-offs, not upstream repairs.
- Assign maintenance ownership for old/deprecated integration APIs and internal compiler imports. Revalidate preparation, recognition, privacy and lifecycle after material SDK/browser/toolchain/dependency changes or failed acceptance.
- Keep preparation/recognition/content network requirements explicit and report unavailable states honestly; no offline guarantee follows from local recognition.

## 9. Alternatives disposition

**No second SDK prototype is required now.** This is LEAD's provisional position, consistent with P01 §8. Revisit alternatives if MindAR fails a mandatory gate or its remaining blockers cannot be mitigated.

| P01 direction | Current disposition |
| --- | --- |
| AR.js NFT | Next researched option; fee-free path plausible, but generator/LGPL obligations and device feasibility remain unverified |
| 8th Wall r2 direction | Retain corrected free/open-source/binary evidence; exact license and runnable image-target path remain unresolved; no new prototype now |
| Zappar | Not currently qualified under the hard cost gate: the repository does not establish a zero-mandatory-cost deployed path and records Enterprise/self-hosting restrictions. Do not invent prices |
| Custom CV | Last-resort direction if simpler candidates fail; dependencies, effort and mobile viability remain unproven |
| WebXR image tracking | No SDK fee identified, but researched draft/flag/browser limitations have no local P0 device proof |

Native-only apps remain OUT; QR/link-only or mocked scans cannot replace genuine AR acceptance. No new candidate research is introduced.

## 10. Provisional recommendation

**PROVISIONAL SELECT WITH CONDITIONS — MindAR image tracking**.

**Assessment:** MindAR has the strongest implemented evidence among the current candidates: a fee-free/self-hosted P0 path, demonstrated artifact preparation, observed recognition feasibility, version-scoped reveal, camera-free fallback and a plausible provider boundary. Completing its missing evidence is warranted before another prototype.

This is not final because current mobile/privacy evidence is absent, denial recovery fails and acceptance/evidence closure remains open. Stronger selection requires §13; failed mandatory gates trigger reconsideration rather than scope relaxation or mock acceptance.

## 11. Conditions for I08 / I12

These are handoff constraints, **not implementation authorization**. Approved Architecture/API/Database/BR boundaries govern; the P04 sketch does not replace them.

1. Keep provider classes, target/anchor indexes, compiler internals and metadata behind the AR boundary. Provider indexes never become authorization or business identity; preserve approved scoped target endpoints.
2. Replace spike tokens/sessionStorage with real owner/recipient application access. Recheck authorized version, current share generation and active owner; no global target-to-private-content lookup (Architecture §§12/14; API Contract §17).
3. Verify source bytes/hash and revision before preparation; reject stale results. A changed source image advances Project revision, rather than redefining an old revision. I08 owns preparation/retry outside DB transactions, not this spike.
4. Retain full integrity hashes, verified preparation provenance and write-once artifact bytes. Verify delivered bytes before recognition as proposed by the sketch; current client blob loading is not that verification. Do not promote `manual-unverified` or hash-only harness `READY` to production readiness.
5. Persist durable historical bindings and immutable Order references. Never resolve an Order using a mutable current-artifact pointer (BR-AR-002; Database §§7/14).
6. Preserve one designated P0 target. One target per production artifact is a proposed adapter restriction consistent with P0, not a universal business file-format rule; combined artifacts remain test-only.
7. Keep same-authorized-content fallback independent of missing/corrupt AR artifacts. Missing media/revoked access remains an honest error; the sketch's restricted `ContentResult` cannot erase those outcomes (BR-AR-004/005).
8. Normalize undefined/provider errors; clean up on Stop/failure/navigation; preserve [stale-reveal cancellation](public/reveal-guard.js) and [race coverage](test/stale-reveal.test.mjs). Measure camera-track release rather than assuming provider success.
9. Publish only evidence-backed support claims and retain failed-device limits and maintenance/retest ownership.
10. Protect historical bytes from ordinary mutation, while allowing authorized retention cleanup. The sketch's “no delete in P0” wording is not indefinite retention (BR-PRV-004/005; Database §23).

## 12. Evidence inconsistencies / reconciliation backlog

Source history is left unchanged in this documentation-only pass.

| Source mismatch / interpretation risk | Severity | Blocks final P05? | Smallest reconciliation |
| --- | --- | --- | --- |
| I03 planning still says TODO/no evidence despite merged work | Low | Not SDK feasibility; formal acceptance still needs accurate status | Link reviewed evidence and update status without marking incomplete tasks Done |
| README 47 tests versus P04 89; README “never run”/“not deployed or device-tested” snapshots | Low | Not by itself; cannot claim a current passing full suite | Attach dated commit/environment-specific results; distinguish desktop from missing mobile runs |
| P04/P03 report clean dependencies; README describes 6–7 findings; saved audit contains 6 (4 moderate, 1 high, 1 critical) | Medium | Evidence reconciliation required; not proof of current vulnerability reachability | Label historical audit; attach dated current-lock audit and mitigation/compatibility disposition |
| Dependency disclosure test fails while P04 says tests unchanged/passing | Medium | Check closure required; not SDK rejection | Add accurate override trade-off disclosure and rerun the focused check |
| P04 historical Redmi anecdote versus P03 explicitly superseded pre-fix phone run | Medium | Yes if used as current mobile proof | Identify build/run; record a current real-mobile matrix instead of borrowing historical success |
| P04 denial/fallback wording versus P03 crash and client catch | High functional | Yes until recovery disposition/retest | Separate reachable fallback from failed feedback; fix under separate authorization and retest |
| P03 zero page errors “across all runs” versus recorded denial errors | Low wording | No separate blocker beyond denial defect | Restrict zero-error claim to successful scan runs |
| Automated 18/18 accessibility versus required manual acceptance | Medium acceptance gap; P03 already labels it honestly | Missing required manual checks remain open | Record manual start/exit/fallback checks; do not relabel automation as screen-reader evidence |
| Port/conformance sketch versus approved production contract | Medium adoption risk | Review required before dependent integration | Review against existing target IDs/API/schema; reconcile source-revision, media-unavailable and retention wording |

**TESTED, read-only on 2026-10-21:** `node spikes/ar/test/dependencies.test.mjs` → 3 passed, 1 failed (README trade-off disclosure). Lockfile checks pass: tar 7.5.22, argparse 2.0.1, no sprintf-js. No fresh network audit, browser run, compilation or full suite was performed; spike dependencies are absent locally. Historical clean-audit reports and current lock mitigation are supporting evidence, not a new clean-audit assertion.

## 13. Finalization gates

Conversion to **SELECT WITH CONDITIONS** requires recorded evidence and review; all gates below remain unchecked. P05 is not final/Done.

- [ ] MEMBER_4 / P03: current genuine mobile HTTPS target-to-image/message proof, exact device/OS/browser matrix, repeated scans, recorded lighting/distance/orientation and performance observations; retain planned Mi Browser attempt and honest unsupported outcomes without inventing universal coverage.
- [ ] P02/P03: correct/wrong/unknown/version-negative scenarios, including valid recognized-but-unauthorized combined-artifact checks; do not substitute “no recognition occurred” for server refusal.
- [ ] P03: mobile Start/Stop/exit and track/OS-indicator observations; complete required manual start/exit/fallback accessibility and same-content failure-path evidence.
- [ ] P02 owner with P03 retest: denial/provider-error disposition and validated recovery/cleanup; do not close on a proposed workaround alone.
- [ ] P04 owner with device tester: real network/payload and storage observations for the intended device class; resolve findings and document processing/transfers compatible with privacy constraints.
- [ ] LEAD with owners: reconcile dependency/audit/check evidence and material license obligations; retain mandatory-zero-cost PASS only while the chosen P0 path needs no paid AR dependency.
- [ ] LEAD: review downstream port/version/fallback conditions, record residual-risk owners/retest triggers and verify inherited planning gates, including I00 acceptance.
- [ ] Independent teammate: review the evidence-completeness audit and proposed decision under planning Review Rules / DEV_WORKFLOW §7.
- [ ] LEAD: explicitly approve final selection and the coordinated technology-decision update after evidence closure; then update statuses through a separately authorized reviewed change.

If a mandatory gate fails without credible mitigation, record a concrete blocker and reconsider P01 alternatives. Do not convert an incomplete record into a positive final decision.

## 14. ADR-005 disposition

The accepted provider-boundary decision remains valid. Final technology selection may require a reviewed ADR-005 technology-selection clarification/update after P05 is accepted, preserving the frozen reveal/access/version/fallback rules and decision history (DEV_WORKFLOW §§8/9).

**No ADR-005 content or status changes in this documentation change.**

## 15. P06 readiness

**P06 is NOT yet unlocked for accepted-direction reproduction.**

After final P05 acceptance, [I03-P06](../../planning/I03-early-ar-technology-spike.md#i03-p06) requires another member to reproduce the accepted candidate using clean synthetic artifacts: genuine repeat scans/reveal, correct source-version binding, same-content fallback and wrong-target checks. Hand off explicit preparation/integration constraints, supported environments, failed-device limits and license conditions to I07/I08/I12.

Preparing instructions earlier is not accepted-direction reproduction. P06 does not substitute for missing P03 evidence, a production scanner, or final I12 recipient-access acceptance.
