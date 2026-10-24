# I03 — Early AR Technology Spike

## Summary

Prove viable web target recognition and provider boundary before downstream design commits.

Current item status: **IN_REVIEW — READY FOR I03 CLOSEOUT REVIEW under R1**, not DONE. LEAD explicitly revises I03 to early
feasibility, conditional technology choice and reproducible handoff. [Boundary revision R1](../spikes/ar/I03-acceptance-boundary-revision.md)
preserves original requirements and provenance, assigns V01–V12 to I08/I09/I12 and records pending approvals. P05 direction is
SELECT WITH CONDITIONS — MindAR image tracking; physical/product tests and independent execution remain unperformed,
not falsely passed. Required independent/coordinated/LEAD review and inherited I00 acceptance remain open.

## Milestone

M1 — Core Platform

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

MEMBER_3

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

LEAD, MEMBER_4. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I00](I00-repository-project-foundation.md)
- Soft/helpful dependencies: [I02](I02-identity-and-sessions.md) (optional authenticated spike harness only)
- Blocked by: [I00](I00-repository-project-foundation.md) until their acceptance artifacts are available.
- Blocks: [I07](I07-studio-personalization.md), [I08](I08-preview-and-readiness-and-target-preparation.md), [I12](I12-ar-signature-experience.md) (direct roadmap consumers).
- Can run in parallel with: [I01](I01-database-foundation.md) and [I02](I02-identity-and-sessions.md) after the [I00](I00-repository-project-foundation.md) gate; no final AR/Studio/snapshot implementation before the selected approach passes [I03](I03-early-ar-technology-spike.md).

The authoritative dependency row is **I00; I02 optional for authenticated spike harness** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [PRODUCT_SCOPE](../docs/PRODUCT_SCOPE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)
- [ADR-005-ar-provider-boundary](../docs/adr/ADR-005-ar-provider-boundary.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Prove viable web target recognition and provider boundary before downstream design commits. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Synthetic prepared target.
- genuine image+message reveal.
- mobile/HTTPS/privacy/licensing matrix.
- decision update to ADR-005 and adapter plan.

R1 explicitly changes when product verification occurs: I03 owns prototype/evidence/risk/decision/package, I08 production
preparation, I12 actual recipient/device/privacy/manual acceptance. Original P03 real-mobile/manual and P06 independent
execution requirements are retained in the R1 original-boundary table and delegated register, not silently removed.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Final scanner UI, advanced effects, participant private media, hardcoded global target URLs.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

LEAD's requested conditional direction is MindAR image tracking, with coordinated repository approval pending. Use synthetic
prototype content; actual product mobile HTTPS/device acceptance remains mandatory in I12. Recognition is never permission;
image plus meaningful message is sufficient and same-authorized-content fallback remains mandatory.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

Acceptance/tests below use **explicit revised boundary R1**, not reinterpretation of the old checkboxes. Original criteria
and verification obligations remain traceable in R1; an unchecked/unexecuted device test is not marked passing by transfer.

<a id="i03-p01"></a>

### I03-P01 — Candidate evaluation against ADR-005

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: DONE — research deliverable; no SDK selection or inherited-gate waiver
- Depends on: [I00](I00-repository-project-foundation.md) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Identify feasible approaches without choosing one prematurely.

**Scope:** Candidate matrix for browser/device support, preparation, licensing/cost, network needs, frame transfer and complexity.

**Expected areas/files/modules:** Isolated spike evaluation artifacts; AR boundary design. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Evaluate against the authority criteria; do not invent procurement promises or numeric performance targets.

**Acceptance criteria:**

- [x] Each considered candidate has evidence gaps listed.
- [x] Camera processing and artifact redistribution are understood at research level; runtime questions are assigned to the spike evidence tasks.
- [x] No SDK is labeled selected before LEAD decision.

**Tests required:** Document verifiable evaluation sources and prototype questions; no mock acceptance.

**Out of scope:** Final AR UI or advanced effects.

**Review focus:** Supported environment, license and privacy risks.

---

<a id="i03-p02"></a>

### I03-P02 — Synthetic target and version-bound reveal prototypes

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: IN_REVIEW — technical prototype ready; shared product verification assigned to I08/I12
- Depends on: [I03-P01](I03-early-ar-technology-spike.md#i03-p01) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Test actual recognition and artifact preparation.

**Scope (R1):** Isolated preparation/recognition/reveal prototype with synthetic image/message, explicit start/stop and two
synthetic authorized versions. Localhost secure-context evidence is labelled honestly; actual product HTTPS moves to V01.

**Expected areas/files/modules:** Isolated AR spike harness and adapter feasibility examples. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** A scoped synthetic fixture can be used before I02; it does not prove final paid-recipient security.

**Acceptance criteria:**

- [ ] Review actual prepared-target engine recognition and intended image/text evidence, explicitly labelled desktop synthetic camera rather than physical-device support.
- [ ] Review scoped prototype wrong/version/recognized-event negative tests and no-unrelated-content behavior; actual product scenarios remain V03.
- [x] Preparation artifacts have identifiable source versions.

R1 ownership: production preparation/provenance/integrity/revision/stale-result/failure verification and readiness for future Order pinning is V08 at I08-P02/P06.
V09 actual captured Order snapshot/pin persistence and historical stability are verified at I09-P02/P07, with integrated historical recipient validation at I12-P06. Actual physical
repeat scans and product recognition/version negatives are V01–V03 at I12-P02/P05/P06; no duplicate phone run is invented.

**Tests required (R1):** Preparation/provenance/integrity and scoped reveal/fallback/version-negative prototype tests,
plus recorded actual engine recognition feasibility. Original repeat-real-scan requirement remains at I12 via V02/V03.

**Out of scope:** Participant media or fake production authentication.

**Review focus:** Genuine recognition and portable version boundary.

---

<a id="i03-p03"></a>

### I03-P03 — Device, browser and camera feasibility matrix

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: IN_REVIEW — measured feasibility/risk inventory ready; product-device/manual verification delegated
- Depends on: [I03-P02](I03-early-ar-technology-spike.md#i03-p02) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I03-P04](I03-early-ar-technology-spike.md#i03-p04) once each task's prerequisites are accepted.

**Purpose (R1):** Characterize measured feasibility and risks; keep all support claims evidence-based.

**Scope:** Record device/OS/browser versions, light/distance/orientation, permission denial, exit, performance and repeat scans.

**Expected areas/files/modules:** Spike device test records and reproducible harness steps. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use available devices honestly; do not promise universal support or infer viability from desktop only.

**Acceptance criteria:**

- [ ] Review exact measured environments and explicit NOT TESTED rows; no invented mobile certification.
- [ ] Review scoped camera/denial/exit and recognition observations, known failures/workaround and method limitations.
- [ ] V01–V07 map original real-device/HTTPS/environment/lifecycle/privacy/manual obligations to existing I12 owners, verification and reopen gates.

**Tests required (R1):** Available automated/live desktop verification and evidence audit. Original real mobile HTTPS and
manual Start/exit/fallback tests remain OPEN at I12-P03/P04/P05, not waived or claimed passed.

**Out of scope:** Production hosting rollout.

**Review focus:** Device evidence and camera-track cleanup.

2026-10-23: actual Firefox 157 / Windows denied-permission recovery passes automated live checks. Earlier Chrome 155 /
Firefox 158 failures remain historical. Chromium 156 yielded NotSupportedError, not validated denial. No current physical
phone run, manual accessibility or OS-indicator result has been supplied; R1 changes their verification stage, not the requirement.

---

<a id="i03-p04"></a>

### I03-P04 — Privacy, fallback and provider-port feasibility

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: IN_REVIEW — conceptual/static/provider/fallback feasibility ready; product privacy acceptance delegated
- Depends on: [I03-P02](I03-early-ar-technology-spike.md#i03-p02) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I03-P03](I03-early-ar-technology-spike.md#i03-p03) once each task's prerequisites are accepted.

**Purpose:** Reject approaches that break authorization or accessible fallback.

**Scope:** Frame/artifact processing review, ARPreparation/recognition mapping, synthetic access scope and same-content camera-free path.

**Expected areas/files/modules:** AR port/interface sketches and spike fallback/privacy evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No global target lookup; provider metadata stays adapter-bound; distinguish harness checks from final I12 proofs.

**Acceptance criteria:**

- [ ] Review prototype scope/negative tests, same-content artifact-independent fallback and known privacy limitations; do not claim final application authorization.
- [ ] Review provider-neutral source/binding/integrity/media-failure/finite-retention sketch; it is not a production API.
- [ ] Original runtime scanning privacy/readability/denied/unsupported obligations remain traceable as V03–V07/V12 at I12; production preparation is V08 at I08; actual captured Order snapshot/pin persistence and historical stability are V09 at I09-P02/P07, with integrated historical recipient validation at I12-P06.

**Tests required (R1):** Scoped harness/static/port/fallback tests and available bounded runtime observations, with unknowns
explicit. Original full scan/network/device/manual acceptance remains mandatory at the named downstream gates.

**Out of scope:** Final Sharing subsystem or public media endpoints.

**Review focus:** Privacy compatibility, not recognition alone.

---

<a id="i03-p05"></a>

### I03-P05 — Evidence-based technology recommendation and decision

- Owner: LEAD
- Reviewer: LEAD
- Status: IN_REVIEW — SELECT WITH CONDITIONS direction recorded; coordinated/independent repository review pending
- Depends on: [I03-P01](I03-early-ar-technology-spike.md#i03-p01); [I03-P02](I03-early-ar-technology-spike.md#i03-p02); [I03-P03](I03-early-ar-technology-spike.md#i03-p03); [I03-P04](I03-early-ar-technology-spike.md#i03-p04) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Own the final AR boundary/technology decision.

**Scope:** Review comparison and evidence, select or explicitly block an approach, coordinate the future reviewed ADR-005 technology update and adapter handoff.

**Expected areas/files/modules:** Decision record and future authority-change proposal. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** This planning task changes no ADR. Implementation-time selection follows DEV_WORKFLOW authority review and preserves P0 behavior.

**Acceptance criteria:**

- [ ] Review conditional MindAR decision against actual feasibility, cost/license evidence and explicit device/privacy limits.
- [ ] R1 accepted timing risks, original criteria, V01–V12 owners/gates and R1–R7 reopen triggers are recorded without manufacturing passes.
- [ ] Independent teammate, affected technical authorities and LEAD approve the coordinated decision/closeout; inherited I00 gate is not waived.

**Tests required:** Audit completeness of spike evidence and teammate review.

**Out of scope:** Unreviewed SDK selection or scope relaxation.

**Review focus:** P0 feasibility and authority-change discipline.

---

<a id="i03-p06"></a>

### I03-P06 — Selected spike reproduction and handoff

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: IN_REVIEW — reproducible package ready; actual independent execution transferred and unperformed
- Depends on: [I03-P05](I03-early-ar-technology-spike.md#i03-p05) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose (R1):** Give downstream implementers a repeatable evidence-backed baseline and mandatory verification map.

**Scope (R1):** Provide executable preparation/reproduction instructions, evidence inventory, test scenarios and integration
constraints. Original independent live execution is explicitly transferred to I08-P06/I12-P05 with real-person sign-off.

**Expected areas/files/modules:** AR spike handoff and safe demonstration instructions. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No final recipient integration; preserve failed-device limits and license conditions.

**Acceptance criteria:**

- [ ] Review clean setup/preparation procedure, evidence/toolchain inventory, expected scenarios and known failures/NOT TESTED outcomes.
- [ ] Original another-member preparation/source-binding execution is assigned to MEMBER_4 / I08-P06 (V10); product repeat-scan/negative/fallback execution to MEMBER_4 / I12-P05 and LEAD I12-P06 review (V11).
- [ ] Review I07/I08/I12 handoff constraints and reopen process; the reproduction record stays blank until actual execution.

**Tests required (R1):** Package/reference/document guards and reproducible commands. Original real repeat-scan/fallback/
wrong-target and independent-person checks remain OPEN at V10/V11; a prepared procedure is not independent execution.

**Out of scope:** Product-ready scanner or acceptance by recording alone.

**Review focus:** Evidence survives handoff.

## Integration / Merge Order

P01 comparison precedes P02; P03/P04 characterize feasibility/risks. P05 records the conditional choice and P06 packages
the handoff. R1 review, LEAD closeout and inherited I00 acceptance precede formal I03 admission. I07/I08/I12 can then
consume the decision subject to their own dependencies; actual independent implementation verification stays at I08/I12.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Revised feasibility/evidence/conditional-decision/handoff obligations are reviewed; original requirements remain mapped to mandatory downstream verification.
- [ ] P01–P06 revised deliverables and V01–V12/R1–R7 mapping are accepted without claiming physical/manual/independent tests passed.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

For I03 review, show recorded genuine engine recognition/prepared artifacts, scoped negative/fallback tests, bounded browser
observations and privacy/license limits. The original supported-device HTTPS demonstration and actual recipient experience
remain mandatory at I12; no desktop recording/synthetic input is product-device acceptance.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Unusable mobile support, licensing or camera/frame transfer may rule out a candidate. Failed recognition cannot be covered up with QR navigation, mocked scan, recordings or fallback. Report failed selection as a blocker for I07/I08/I12.

R1 is an explicit LEAD timing/ownership revision presented with coordinated technical-authority edits for review. Any
unresolved authority issue pauses the affected decision; no product/business/security invariant or inherited gate is waived.
