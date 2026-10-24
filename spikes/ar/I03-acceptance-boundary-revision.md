# I03 acceptance boundary revision R1

## Decision and provenance

- Recorded: **2026-10-23**, on `fix/I03-ar-spike-closeout`, base `a6afcb8f54ab8f26106aeede6107a2605976a4b5` plus the closeout working tree.
- Source: LEAD's explicit follow-up instruction, attachment `8703732e-fd17-4d68-a299-cfaec958a630/Pasted text.txt`, following the stricter closeout authorization `462c565d-05ab-4644-8f22-105ea83a1b4f/Pasted text.txt` and its audit.
- LEAD-requested direction: **SELECT WITH CONDITIONS — MindAR image tracking**. Mandatory paid AR SDK/runtime cost: **PASS**; another prototype is not required by current evidence.
- Governance status: **READY FOR REVIEW**. LEAD requested the revised boundary and accepted the risks listed below; independent teammate review, coordinated technical-authority review and final repository closeout approval are **not recorded**. No reviewer identity, signature or acceptance timestamp is inferred.
- This is a new timing/ownership decision, not a claim that missing tests passed. Product Scope, Business Rules, API, database invariants and I00 acceptance are not waived.

The requested change is coordinated in I03 planning, I08/I12 obligations, Testing Strategy §13, Roadmap's I03 row,
Architecture §12 and the ADR-005 addendum. Those technical edits form this **review package**, not an assertion that the
previous frozen baseline has already received independent approval. Dependent implementation admission still needs that
review and its other gates. No Jira transition or duplicate ticket is created.

## Original boundary retained

Original sources are the committed baseline above: [I03 planning](../../planning/I03-early-ar-technology-spike.md),
[Testing Strategy §13](../../docs/TESTING_STRATEGY.md#13-ar-acceptancedevice-testing),
[Roadmap §3](../../docs/ROADMAP.md#3-milestones), Architecture §12 and [ADR-005's original criteria](../../docs/adr/ADR-005-ar-provider-boundary.md#selection-criteria-and-required-spike-evidence).
The prior [closeout record](evidence/I03-closeout-2026-10-23.md) accurately concluded NOT READY under that earlier boundary.

| Task | Original acceptance / required verification at I03 |
| --- | --- |
| P01 | Candidate gaps listed; camera processing/artifact redistribution understood; no premature SDK selection; verifiable sources and prototype questions |
| P02 | Prepared target genuinely resolves intended image/text; unknown/wrong-version reveals no unrelated fixture; identifiable source versions; repeat real scans, preparation failure and version-mismatch cases |
| P03 | Actual supported combinations documented; start/denial/exit tested; honest repeatability/unsupported outcomes; **real mobile HTTPS/camera and manual start/exit/fallback accessibility** |
| P04 | No unrelated private target/content; readable fallback; source-version/immutable port feasibility; wrong-target/denied/unsupported and **frame/network observations** |
| P05 | Real-device/privacy/license evidence; selected approach or concrete blocker; reviewed downstream implications; evidence audit and teammate review |
| P06 | **Another member reproduces target/reveal**, source-version binding and fallback; supported-approach handoff; **real repeat scan/fallback/wrong-target checks** |
| I03 parent | Reliable target → correct authorized content, denied/unsupported fallback, version safety, privacy/license findings and team selection; all subtask gates and review |

The earlier P03/P04 device gaps and blank P06 record are preserved. The previous independent execution requirement has
**not been executed**; R1 transfers its execution to the named implementation acceptance gates below. A handoff procedure
is still not a completed independent reproduction.

## Revised I03 acceptance and rationale

I03 establishes **early technical feasibility and a conditional technology decision**, before the production UI, media,
sharing and backend integration exist. Physical/product acceptance is performed where that actual integrated experience
can be tested. This deliberately accepts that later integrated tests may require reopening the technology choice.

| Task | Revised deliverable | Current support / review state |
| --- | --- | --- |
| P01 | Sourced candidate evaluation and prototype questions | Research complete; no SDK support certification |
| P02 | Actual preparation/recognition prototype, source identity and scoped reveal/fallback tests | Genuine MindAR engine events from desktop synthetic camera; compiled artifacts/provenance and negative server tests; ready for review |
| P03 | Measured feasibility and evidence-based limits/defects, with untested combinations explicit | Chrome 155/Firefox 158 baseline, resolution sensitivity and Firefox 157 live denial check; physical rows remain NOT TESTED; ready for review |
| P04 | Conceptual privacy/provider-boundary feasibility and fallback, including known unknowns | Static/module review, scoped tests, proposed port, bounded denied-session inspection; scanning privacy not proved; ready for review |
| P05 | Conditional technology direction, cost/license disposition, risks, owners and reopen triggers | SELECT WITH CONDITIONS proposed for coordinated repository review; not Done merely by this request |
| P06 | Reproducible preparation/handoff procedure, scenario inventory and traceable downstream execution requirements | Package prepared; independent person/device execution remains absent and is explicitly transferred |

Acceptance of I03 under R1 requires these deliverables, relevant automated checks, the ownership mapping below, independent
review and LEAD closeout approval. It does not require production AR implementation or the deferred execution itself.
P01 research completion is retained; other tasks/parent are **IN_REVIEW / ready for closeout review**, not DONE.
The current I00 record still lacks human zoom/screen-reader/reviewer acceptance; that inherited gate is a separate
open approval requirement, not silently waived or reopened from a completed state.

## Deferred verification register

All execution below is **OPEN / NOT TESTED unless an explicitly scoped historical result is cited**. None is checked off
by this transfer. Existing tickets and their current TODO states are preserved. References to original Pxx mean their
pre-R1 criteria retained above. R1–R7 are the reopen triggers in the next section.

| ID / original requirement and source | Accountable owner / existing ticket | Concrete verification gate | Risk accepted now | Reopen trigger |
| --- | --- | --- | --- | --- |
| V01 — P02/P03 real mobile HTTPS; Testing §13; ADR web/mobile + camera | MEMBER_4, [I12-P05](../../planning/I12-ar-signature-experience.md#i12-p05); MEMBER_3 fixes I12-P03 runtime integration | Exact Android/device/browser matrix, including planned Redmi/Chrome and Mi Browser attempt if available; actual product HTTPS/permission flow; retain failures/untested rows | No mobile support established by I03 | R1/R2 |
| V02 — P02 repeat real scans; P03 light/distance/orientation/performance; ADR reliability | MEMBER_4, I12-P05; MEMBER_3 [I12-P02](../../planning/I12-ar-signature-experience.md#i12-p02) | Genuine physical target → image/message, repeated found/lost/re-found scans, conditions, attempts/successes and practical performance; no invented thresholds | Synthetic resolution-sensitive trials may not generalize | R1/R2 |
| V03 — P02/P04 wrong/unknown/version negatives; P06 wrong-target tests; BR-AR-003 | MEMBER_3, I12-P02; LEAD, [I12-P06](../../planning/I12-ar-signature-experience.md#i12-p06) | Correct/wrong/unknown/ambiguous/version-negative cases with real scoped backend; distinguish no recognition from refusal of a recognized-but-unauthorized event. Combined artifact stays a test-only scenario | Harness authorization is not real sharing acceptance | R3/R5 |
| V04 — P03 denial/start/exit/unsupported; P04 denied/unsupported tests; ADR HTTPS/camera | MEMBER_3, [I12-P03](../../planning/I12-ar-signature-experience.md#i12-p03); MEMBER_4, I12-P05 | Actual mobile denied/retry, unsupported/runtime outcomes, explicit Start, Stop/navigation/unmount and OS indicator; record real errors and track release | Firefox denial PASS is desktop-only; Chromium headless returned NotSupportedError | R2/R3 |
| V05 — P04 frame/network/storage observations; Testing §13 + ADR privacy | LEAD, [I12-P01](../../planning/I12-ar-signature-experience.md#i12-p01) and I12-P06; MEMBER_4 captures I12-P05 device evidence | Remote inspector over full genuine scan/reveal/loss/Stop/fallback; all origins and payloads including same-origin, browser stores and persistence; redact secrets; resolve unexpected transfers before I12 acceptance | Static/CSP/denied-session observations do not prove scanning privacy | R3 |
| V06 — P03 manual accessibility; P04 readable fallback; Testing §13 | MEMBER_2, [I12-P04](../../planning/I12-ar-signature-experience.md#i12-p04); MEMBER_4, I12-P05 | Manual Start/exit/fallback, keyboard/focus, readable text/alt/status, small screens/zoom and recorded assistive-technology checks; automated checks remain separately labelled | No manual or screen-reader pass exists | R2/R6 |
| V07 — P02/P04 fallback failure; BR-AR-004/005; ADR fallback | MEMBER_2, I12-P04; LEAD, I12-P06; MEMBER_3 owner preview [I08-P04](../../planning/I08-preview-and-readiness-and-target-preparation.md#i08-p04) | Same authorized pinned content through camera/fallback; artifact missing/corrupt does not block fallback; missing media is honest unavailable; revoke/rotate/disable blocks both | Harness same-content tests omit final sharing/media lifecycle | R3/R5/R6 |
| V08 — P02 preparation/provenance/identity; P04 immutable sketch; BR-AR-002 | MEMBER_3, [I08-P02](../../planning/I08-preview-and-readiness-and-target-preparation.md#i08-p02); MEMBER_4, [I08-P06](../../planning/I08-preview-and-readiness-and-target-preparation.md#i08-p06) | Verify source bytes/hash/current revision, provenance, full artifact integrity and immutable identity; real preparation/failure/retry plus PostgreSQL stale-result/race tests; do not promote unverified/harness READY | Prototype manifest/current-pointer storage is not production persistence | R5 |
| V09 — Historical target/content stability; ADR version binding; Database §§7/14 | LEAD, [I09-P02](../../planning/I09-order-snapshot-and-checkout.md#i09-p02); MEMBER_3, [I09-P07](../../planning/I09-order-snapshot-and-checkout.md#i09-p07); LEAD, I12-P06 integrated recipient validation | I09 persists actual captured Order snapshot references/immutable pins and verifies historical stability across Project/media/target edits; no mutable current pointer supplies historical content. I08-P02 supplies immutable preparation artifacts/revision binding and readiness for future Order pinning, not captured Order proof; source edits advance revision. I12-P06 verifies integrated historical recipient behavior | Durable application history not yet implemented | R3/R5 |
| V10 — P06 **another member independently reproduces preparation/source binding** | MEMBER_4, I08-P06, with actual reproducer different from primary implementer | Fresh setup, recorded commit/toolchain, forced preparation and honest MATCH/DIFFER, correct source-bound owner reveal/fallback and negative/failure results; real identity/date/LEAD review | Independent prep run has not happened | R1/R5 |
| V11 — P06 **another member independently repeats live recognition/fallback/wrong-target proof** | MEMBER_4, I12-P05; LEAD reviews I12-P06; reproducer must differ from primary runtime implementer | Own device/machine/current product build; genuine repeat scans, scope negatives, fallback and lifecycle; fill/redact [reproduction record](evidence/P06-reproduction-record.md), actual person/sign-offs. Codex/test reruns do not count | Handoff is a procedure, not independently executed acceptance | R1/R2/R3/R5/R6 |
| V12 — P01/P05 cost/license/maintenance; DEV_WORKFLOW §13 | LEAD, I12-P01; MEMBER_3, I08-P02 | Before dependency/runtime use, record applicable license/notice/redistribution obligations and compatibility disposition; retest changed dependencies; core AR requires no mandatory monetary SDK/runtime/service payment | MIT inspection/lock metadata is not complete transitive review | R4/R7 |

I08 owner-preview/device proof already required by its plan is retained; R1 does not defer I08 readiness until after an Order.
I12's full recipient acceptance remains a mandatory product gate before I19/final demo, not an optional backlog.

## Risks explicitly accepted by LEAD and reopen triggers

The instruction accepts **selection-before-physical-product-validation**, bounded prototype target/resolution sensitivity,
no current mobile support matrix, incomplete scanning privacy/manual evidence, an unexecuted independent handoff and
old/internal compiler/dependency coupling. Monetary cost PASS is supported by MIT inspection/self-hosting; transitive
obligations remain open. No privacy, authorization, history, fallback, cost or licensing **failure** is accepted as product behavior.

Reopen the technology decision, stop affected acceptance and review alternatives if:

- **R1:** genuine physical recognition cannot satisfy the required P0 target → personalized reveal.
- **R2:** a mandatory browser/device or lifecycle/accessibility requirement is not achievable.
- **R3:** privacy/security requirements cannot be satisfied.
- **R4:** core P0 needs mandatory paid SDK/runtime/subscription/usage/cloud AR access; trials/credits do not qualify.
- **R5:** integration cannot preserve source/Order version safety or application-owned authorization.
- **R6:** camera-free fallback cannot satisfy approved same-authorized-content/error/revocation rules.
- **R7:** a material license restriction prevents intended use.

The affected ticket owner reports evidence to LEAD and the relevant authority owner; the team reassesses MindAR/alternatives
through reviewed decision control. It does not quietly relax requirements or substitute QR/mock/fallback for genuine AR.

## Review and dependency disposition

- [ ] Independent teammate reviews the boundary change, evidence and ownership mapping; name/date pending.
- [ ] Affected technical-authority owners review coordinated Testing Strategy/Roadmap/Architecture/ADR wording; approval pending.
- [ ] LEAD reviews final diff and records closeout acceptance; not inferred from the instruction to prepare it.
- [ ] Existing I00 manual/common-gate and owner/reviewer acceptance is supplied/linked; no waiver is recorded.

The **I03 technology-decision content is sufficient under the requested boundary**, subject to those approvals. After
accepted closeout, I07 may consume the conditional choice and constraints but still needs I05/I06; I08 still needs I07
and its own readiness proof; I12 still needs I08/I11 and must pass V01–V12 as applicable. No whole downstream ticket is
declared unlocked by this document, and no downstream implementation is performed.

## Verification of this review package

Executed on 2026-10-23, Windows x64 / Node v24.21.0 / npm 11.19.0, base `a6afcb8` plus the current preserved closeout/R1 diff:

- `npm test` from `spikes/ar`: **106 passed, 0 failed, 0 skipped**, exit 0 (69.6 s); includes updated handoff guards that preserve the blank independent record.
- `node test/dependencies.test.mjs` from `spikes/ar`: **4 passed**, no failure; no fresh advisory lookup or new external research.
- Provider sketch: `node ../../frontend/node_modules/typescript/bin/tsc --noEmit --strict --target es2022 --moduleResolution bundler --module esnext --skipLibCheck port/ar-provider-port.ts`: PASS, exit 0.
- Node-built-in source/artifact SHA-256, canonical id and size verification: PASS for A/B and combined test-only artifact.
- Local Markdown target/anchor validation: **358 references across 18 documents**, no missing target/anchor; `git diff --check` passes.

No new browser/device/manual/independent run is represented by this pass. The previous Firefox JSON and earlier executable
closeout work are preserved; current changes concern the acceptance record, coordinated technical/planning documents and
handoff guard. No application feature, product/business rule, API, database model or locked dependency is changed.
