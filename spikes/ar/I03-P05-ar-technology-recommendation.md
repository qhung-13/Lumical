# I03-P05 — AR Technology Recommendation

## 1. Decision status

- **Decision: SELECT WITH CONDITIONS — MindAR image tracking** under the explicitly revised early-spike boundary.
- **Repository status: IN_REVIEW / READY FOR CLOSEOUT REVIEW**, not DONE. Independent teammate, coordinated technical-authority and final repository acceptance remain **pending**.
- Owner: LEAD. Direction/scope provenance: [boundary revision R1](I03-acceptance-boundary-revision.md), LEAD's explicit follow-up instruction; no independent sign-off is inferred.
- Current baseline: `a6afcb8f54ab8f26106aeede6107a2605976a4b5` plus the preserved uncommitted closeout diff on `fix/I03-ar-spike-closeout`.
- P03: feasibility/risk record ready for review; physical product acceptance remains NOT TESTED and assigned to I12.
- P06: handoff package ready for review; independent execution is **not done**, explicitly transferred to I08-P06/I12-P05.

**Decision history preserved:** the original 2026-10-21 record at `6c252b8` and the first 2026-10-23 closeout were
PROVISIONAL SELECT WITH CONDITIONS because the then-current I03 gate required mobile/privacy/independent execution.
The [closeout results](evidence/I03-closeout-2026-10-23.md) remain valid evidence. LEAD's subsequent R1 request intentionally
changes verification timing, not those results: product/device/manual/privacy and independent checks move to named
implementation gates, not to passed status. The reviewed technical documents/ADR addendum carry that proposal.

No production implementation, mobile/browser support claim, privacy certification, Jira completion or I00 waiver follows
from this decision. Admission still requires coordinated review, inherited acceptance and each downstream dependency.

## 2. Decision question

Based on P01–P04 evidence, is MindAR an appropriate P0 AR direction for LumiCal, under what conditions and residual risks?

[I03-P05 planning](../../planning/I03-early-ar-technology-spike.md#i03-p05) originally required real-device/privacy/license evidence before selection. R1 explicitly revises that timing to documented feasibility, limits, conditions and downstream verification ownership. Evidence audit, teammate/LEAD review and authority discipline remain required. Original requirements are retained in R1; no missing test becomes a pass.

## 3. Mandatory LumiCal constraints

| Constraint | Authority |
| --- | --- |
| AR is mandatory P0: a genuine target → personalized reveal. An image plus meaningful readable message is sufficient; advanced/multi-target effects are not required. | [Product Scope §13](../../docs/PRODUCT_SCOPE.md#13-ar-product-scope--signature-final-project-experience); [Business Rules §9](../../docs/BUSINESS_RULES.md#9-ar-experience), BR-AR-001 and BR-MED-001; [ADR-005](../../docs/adr/ADR-005-ar-provider-boundary.md) |
| Camera-free fallback returns the same authorized meaningful content. Missing media/revoked access produces an honest error. | Business Rules BR-AR-004/005 |
| Recognition is not authorization. No global recognized-target → private-media lookup; wrong/unknown/ambiguous targets reveal nothing unrelated. | Business Rules BR-AR-003; [Architecture §12](../../docs/ARCHITECTURE.md#12-ar-architecture-boundary) |
| Preparation binds to the correct Project revision; Orders retain their captured target/media/fallback. Later edits cannot remap historical Orders. | BR-AR-002; Architecture §§12/15; [Database §14](../../docs/DATABASE.md#14-immutable-snapshot-strategy) |
| Provider details stay behind the AR boundary. Production application/server access control replaces spike bearer tokens and sessionStorage. | ADR-005; Architecture §§12/14/19; [API Contract §17, recipient endpoints](../../docs/API_CONTRACT.md#owner-sharing-and-recipient-access) |
| Core P0 AR must not require paid SDK licensing, mandatory paid runtime access, recurring AR subscriptions, usage-based recognition fees or a required paid cloud AR service. Trials/temporary credits do not qualify. Ordinary application hosting is separate. | Explicit LEAD selection constraint authorizing this P05 record; not represented as an existing frozen BR/ADR amendment |

Real mobile HTTPS product acceptance remains mandatory in I12 under the proposed [Testing Strategy §13 timing revision](../../docs/TESTING_STRATEGY.md#13-ar-acceptancedevice-testing). I08 retains production preparation/owner preview proof. Reviewed changes follow [Development Workflow §§7–9](../../docs/DEV_WORKFLOW.md#7-review); [Roadmap §3](../../docs/ROADMAP.md#3-milestones) and R1 coordinate the stage/owner changes without weakening product invariants.

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

**PROPOSED:** [provider port](port/ar-provider-port.ts), now revision 3, separates byte identity from source binding, keeps indexes internal and clarifies retention/source edits/media unavailability. It is not a production-approved API. Some conformance tests inspect sketch text rather than execute a production adapter; strict type-checking does not establish runtime authorization.

## 5. Decision matrix

Statuses describe current evidence, not final production acceptance. No numeric scoring or new performance threshold is introduced.

| Criterion | Evidence | Status | Limitation / risk | Decision impact |
| --- | --- | --- | --- | --- |
| Recognition feasibility | Actual engine events/reveals from synthetic video | PASS WITH CONDITION | Small trials; resolution-sensitive | Early feasibility established; physical proof V01/V02 at I12 |
| Mobile/browser feasibility | P03 mobile rows untested | OPEN | No current mobile support claim | Mandatory I12 V01/V02 gate; R1/R2 failure reopens choice |
| Camera lifecycle | P03 desktop Start/Stop, zero live tracks | PARTIAL | Mobile indicator/restart/exit evidence missing | Complete scoped lifecycle evidence |
| Permission/error handling | Historical crash; workaround and Firefox 157 live PASS | PASS WITH CONDITION | Chromium denial not exercised (NotSupportedError); mobile pending | I12 V04 must validate actual product path |
| Artifact preparation | P02 artifacts, hashes and recorded recompiles | PASS WITH CONDITION | Environment-specific, internal compiler imports | Pin/record toolchain; retain bytes |
| Source/version binding | Source provenance and immutable files; port sketch | PASS WITH CONDITION | Current pointer lacks durable history; stale-result handling downstream | I08 preparation; I09 Order pins/history |
| Authorization boundary | Scope-first registry; negative test coverage | PASS WITH CONDITION | Synthetic sessions lack real share/account lifecycle | Preserve approved application enforcement |
| Runtime privacy | Static review and Firefox denied-session inspection | PARTIAL | No physical scanning trace | I12 V05 gate; R3 failure reopens choice |
| Fallback | Same scoped payload; Firefox live denied fallback matches | PARTIAL | Manual/mobile checks incomplete | Keep mechanism; close acceptance |
| Provider abstraction | P04 split records and index-free sketch | PASS WITH CONDITION | Not a reviewed production contract | Review contracts before implementation |
| Mandatory paid AR cost | Recorded MIT inspection; self-hosted runtime/compiler | PASS | Monetary conclusion only | Hard cost gate met on repository evidence |
| Licensing | Direct license metadata and documented upstream inspection | PARTIAL | Transitive obligations/redistribution review incomplete | Record applicable obligations and material restrictions |
| Dependency/security | Overrides, passing disclosure/lock checks and full local suite | PASS WITH CONDITION | Saved audit is historical; no fresh audit here | Retain dated provenance and maintenance review |
| Maintenance | Recorded old publication date; internal API coupling | PASS WITH CONDITION | Compatibility ownership needed; age alone does not prove abandonment | Assign owner and retest triggers |
| Developer complexity | Documented Node/harness workflow | PARTIAL | Canvas install workaround; mobile loading/performance unknown | Assess bounded workflow during remaining evidence runs |

## 6. Cost and licensing decision

**Mandatory paid AR SDK/runtime cost: PASS**.

This is a repository-based monetary conclusion: the installed MindAR 1.2.5 LICENSE was re-read in closeout and is MIT;
[package-lock.json](package-lock.json) agrees. Preserve its copyright/permission notice in distributed copies. The self-hosted
runtime and local compiler have no configured paid AR API, runtime subscription, usage fee or license key. Lock metadata
also includes ISC, BSD-2/3-Clause, Apache-2.0, Apache-2.0 AND MIT, Python-2.0 and BlueOak-1.0.0. These are inventory facts,
not completed obligation/compliance review. P01's initial upstream-license uncertainty has been addressed.

| Category | Disposition |
| --- | --- |
| SDK/runtime monetary cost | PASS for the recorded MindAR path; no trial/credits dependency |
| Application hosting | Separate infrastructure cost; not promised free forever |
| Optional infrastructure | Host/tunnel choices do not establish a required paid AR service; optional paid services may not become prerequisites for core P0 AR |
| Development tooling | Node preparation implemented; no paid compiler/tool requirement recorded |
| License compliance | OPEN in part: transitive-license review is incomplete. Record applicable notices/obligations for the resolved tree before reuse; MIT alone is not blanket legal/compliance clearance |

No external licensing or price research was performed. Revisit the monetary gate if the selected path gains a service/key/subscription dependency.

## 7. Review requirements and deferred product gates

The former blockers are not silently waived: physical mobile/repeats/negative/conditions evidence is R1 V01–V04;
runtime scanning privacy V05; manual accessibility/equivalent fallback V06/V07; production source/history proof V08/V09;
independent execution V10/V11; dependency/license obligations V12. Each has an existing accountable task and reopen trigger.
They remain OPEN at those mandatory implementation gates and are not claimed passed here.

What still prevents repository closeout as DONE is independent/technical-authority review of the coordinated revision,
final LEAD diff/closeout acceptance and the unchanged inherited I00 acceptance. Current evidence does not contradict a
mandatory technical invariant: no unsupported-device claim is made, and production boundary work has not been implemented.
If downstream verification proves an invariant cannot be met, reopen the choice rather than relax it.

## 8. Accepted risks / selection conditions

LEAD explicitly accepts selecting before physical/product validation under R1. That timing risk and the known evidence
limits remain visible; repository approval is pending. These implementation conditions preserve the product requirements:

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

## 10. Conditional technology decision

**SELECT WITH CONDITIONS — MindAR image tracking**.

**Assessment:** MindAR has the strongest implemented evidence among the current candidates: a fee-free/self-hosted P0 path, demonstrated artifact preparation, observed recognition feasibility, version-scoped reveal, camera-free fallback and a plausible provider boundary. Completing its missing evidence is warranted before another prototype.

This is the conditional direction under the requested early-feasibility boundary, not completed product acceptance or a
merged/approved repository change. Review remains open in §13; actual product proof belongs to the traceable I08/I09/I12 gates.
Explicit R1–R7 reopen triggers cover real-device/browser failure, privacy/security, mandatory paid AR dependency,
authorization/version safety, fallback or material licensing restrictions. No second prototype is needed unless such evidence arises.

## 11. Conditions for I08 / I09 / I12

These are handoff constraints, **not implementation authorization**. Approved Architecture/API/Database/BR boundaries govern; the P04 sketch does not replace them.

1. Keep provider classes, target/anchor indexes, compiler internals and metadata behind the AR boundary. Provider indexes never become authorization or business identity; preserve approved scoped target endpoints.
2. Replace spike tokens/sessionStorage with real owner/recipient application access. Recheck authorized version, current share generation and active owner; no global target-to-private-content lookup (Architecture §§12/14; API Contract §17).
3. Verify source bytes/hash and revision before preparation; reject stale results. A changed source image advances Project revision, rather than redefining an old revision. I08 owns preparation/retry outside DB transactions, not this spike.
4. Retain full integrity hashes, verified preparation provenance and write-once artifact bytes. Verify delivered bytes before recognition as proposed by the sketch; current client blob loading is not that verification. Do not promote `manual-unverified` or hash-only harness `READY` to production readiness.
5. I08 verifies immutable preparation artifacts and readiness for future Order pinning. I09-P02/P07 persist durable captured Order snapshot references/immutable pins and verify historical stability; I12-P06 retains integrated historical recipient validation. Never resolve an Order using a mutable current-artifact pointer (BR-AR-002; Database §§7/14).
6. Preserve one designated P0 target. One target per production artifact is a proposed adapter restriction consistent with P0, not a universal business file-format rule; combined artifacts remain test-only.
7. Keep same-authorized-content fallback independent of missing/corrupt AR artifacts. Missing media/revoked access remains an honest error; the sketch's restricted `ContentResult` cannot erase those outcomes (BR-AR-004/005).
8. Normalize undefined/provider errors; clean up on Stop/failure/navigation; preserve [stale-reveal cancellation](public/reveal-guard.js) and [race coverage](test/stale-reveal.test.mjs). Measure camera-track release rather than assuming provider success.
9. Publish only evidence-backed support claims and retain failed-device limits and maintenance/retest ownership.
10. Protect historical bytes from ordinary mutation, while allowing authorized retention cleanup. The sketch's “no delete in P0” wording is not indefinite retention (BR-PRV-004/005; Database §23).

## 12. Evidence inconsistencies / reconciliation backlog

The original 2026-10-21 audit is preserved below; current reconciliations are noted explicitly. This closeout also changes the isolated harness cleanup and proposed sketch, not production application code.

| Source mismatch / interpretation risk | Severity | Current R1 disposition | Smallest reconciliation |
| --- | --- | --- | --- |
| Historical I03 TODO/no evidence wording | Low | Research complete; revised packet IN_REVIEW | Formal review/closeout still pending, not inferred Done |
| Historical 47/89/97 test counts and “never run” snapshots | Low | Resolved in current summaries | Current exact commands/counts live in closeout evidence; old device tables remain dated |
| P04/P03 report clean dependencies; README describes 6–7 findings; saved audit contains 6 (4 moderate, 1 high, 1 critical) | Medium | Evidence reconciliation required; not proof of current vulnerability reachability | Label historical audit; attach dated current-lock audit and mitigation/compatibility disposition |
| Historical dependency disclosure failure | Medium | Resolved: current check passes | Preserve dated 3/1 result below; current full-suite result supersedes it |
| P04 historical Redmi anecdote versus superseded pre-fix P03 phone run | Medium | Not current support proof; V01/V02 open at I12 | Record actual product matrix rather than borrow old success |
| Historical denial crash versus current workaround | High functional | Firefox desktop resolved; V04 product/device evidence open | Mobile/Chromium cannot inherit the Firefox pass |
| P03 zero page errors “across all runs” versus denial errors | Low wording | Resolved | Scope zero-error statement to successful scans |
| Automated 18/18 versus manual accessibility | Medium product-verification risk | V06 open at I12-P04/P05 | Record actual manual/assistive-tech results; no relabelled automated pass |
| Port/conformance sketch versus approved production contract | Medium adoption risk | Actual contract review remains required | Sketch now clarifies revision/media/retention wording; it still cannot replace API/schema authority |

**Historical TESTED result, 2026-10-21:** dependency check → 3 passed, 1 failed; dependencies were absent and the full suite/browser were not run then. **Current closeout:** the locked install and disclosure check pass; exact full-suite/browser results are linked above. Tar 7.5.22, argparse 2.0.1, no sprintf-js remain locked. No fresh advisory audit was run; historical clean reports are not today's audit assertion.

## 13. Review gates under R1

The original physical/privacy/manual/independent finalization requirements are retained in R1's original-boundary table
and V01–V12, with mandatory downstream gates; they are not checked as passed. The conditional direction is now recorded,
but formal P05/I03 acceptance remains pending:

- [ ] Independent teammate reviews the feasibility evidence, selection conditions and explicit transfer; actual name/date pending.
- [ ] Affected technical-authority owners review the coordinated Testing Strategy/Roadmap/Architecture/ADR addendum; no approval inferred.
- [ ] LEAD reviews and approves final diff/closeout, including maintenance/obligation owners and R1–R7 reopen handling.
- [ ] For formal I03 closure/admission, supply the unchanged inherited I00 acceptance record; it is not waived by changing AR verification timing.

No product test result is manufactured to clear these review gates. Later failed mandatory verification reopens selection
through R1–R7; it does not silently relax LumiCal's requirements.

## 14. ADR-005 disposition

The accepted provider-boundary decision remains valid. This review package adds a minimal **R1 technology-selection/timing
addendum** to ADR-005: SELECT WITH CONDITIONS as LEAD's direction, independent/coordinated approval pending. The original
accepted decision/criteria remain historical; provider neutrality, authorization, versions, fallback, replacement and
revisit triggers are preserved. No production implementation specification or false accepted status is added.

## 15. P06 readiness

**P06's reproducible package is READY FOR REVIEW under R1; actual independent execution is NOT DONE.**

Original I03-P06 execution requirements are explicitly retained and transferred: preparation/source-binding reproduction
to MEMBER_4 / I08-P06 (V10), product repeat-scan/negative/fallback/lifecycle reproduction to MEMBER_4 / I12-P05 and LEAD
I12-P06 review (V11). The actual human must differ from the primary implementer. The existing record remains blank;
neither this document nor Codex verification supplies a signature. See [handoff](I03-P06-handoff.md) and R1 for exact gates.
