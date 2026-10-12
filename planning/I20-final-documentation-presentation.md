# I20 — Final Documentation / Presentation

## Summary

Hand off reproducible new project and university explanation.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M5 — Release & Academic Delivery

## Priority

Required academic delivery supporting the accepted P0/P1 project.

## Primary Owner

MEMBER_4

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

LEAD, MEMBER_2, MEMBER_3. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I19](I19-final-e2e-security-demo-hardening.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I19](I19-final-e2e-security-demo-hardening.md) until their acceptance artifacts are available.
- Blocks: No later mandatory item; this item closes its stated acceptance.
- Can run in parallel with: Technical/product/device documentation drafts may be prepared alongside accepted slices under DEV_WORKFLOW; final [I20](I20-final-documentation-presentation.md) reconciliation and handoff wait for [I19](I19-final-e2e-security-demo-hardening.md) acceptance.

The authoritative dependency row is **I19** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [PRODUCT_SCOPE](../docs/PRODUCT_SCOPE.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [DATABASE](../docs/DATABASE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [DEV_WORKFLOW](../docs/DEV_WORKFLOW.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Hand off reproducible new project and university explanation. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Setup/operations guide.
- architecture/ERD/OpenAPI current.
- safe demo instructions/evidence and presentation.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Deploying real commerce or rewriting rules to excuse defects.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

Describe the actual new repository and approved university demonstration, not an invented report rubric. Current setup/architecture/ERD/OpenAPI and safe limitations must match acceptance evidence; no deployment or authority rewrite to excuse defects.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i20-p01"></a>

### I20-P01 — Technical architecture, database and API handoff

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I19](I19-final-e2e-security-demo-hardening.md) Inherited item hard gates: [I19](I19-final-e2e-security-demo-hardening.md)
- Can run in parallel with: [I20-P02](I20-final-documentation-presentation.md#i20-p02); [I20-P03](I20-final-documentation-presentation.md#i20-p03) once each task's prerequisites are accepted.

**Purpose:** Own the final technical explanation and contract alignment.

**Scope:** Current architecture/ERD/OpenAPI, module boundaries, transaction/security/commerce rationale and dependency/migration guidance.

**Expected areas/files/modules:** Future technical handoff/diagrams and reviewed generated contracts. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** This pack edits no docs. Any future authority correction needs its owner/process approval and cannot change rules to match a defect.

**Acceptance criteria:**

- [ ] Diagrams/contracts describe accepted implementation.
- [ ] Core invariant/evidence rationale is understandable.
- [ ] Authority drift is raised explicitly rather than papered over.

**Tests required:** Document link/example/contract checks and I19 evidence cross-reference.

**Out of scope:** New architecture or fabricated academic requirements.

**Review focus:** Accuracy of technical claims.

---

<a id="i20-p02"></a>

### I20-P02 — Product walkthrough and academic explanation support

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I19](I19-final-e2e-security-demo-hardening.md) Inherited item hard gates: [I19](I19-final-e2e-security-demo-hardening.md)
- Can run in parallel with: [I20-P01](I20-final-documentation-presentation.md#i20-p01); [I20-P03](I20-final-documentation-presentation.md#i20-p03) once each task's prerequisites are accepted.

**Purpose:** Explain how the approved product journey works.

**Scope:** Creator/Studio/preview/account/checkout walkthrough, scope traceability and contribution to the university explanation.

**Expected areas/files/modules:** Product walkthrough and academic presentation support artifacts. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No invented page count, grading rubric, deadlines or institutional deliverables; refer to confirmed course scope.

**Acceptance criteria:**

- [ ] Twelve-Month and personal-date behavior is clear.
- [ ] Project versus immutable Order is explained.
- [ ] P0/P1/P2/OUT and limitations remain honest.

**Tests required:** Walkthrough replay against accepted browser/demo evidence and link checks.

**Out of scope:** New features or fabricated research/user-demand claims.

**Review focus:** Product meaning and scope accuracy.

---

<a id="i20-p03"></a>

### I20-P03 — Media, AR and recipient evidence/limitations handoff

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I19](I19-final-e2e-security-demo-hardening.md) Inherited item hard gates: [I19](I19-final-e2e-security-demo-hardening.md)
- Can run in parallel with: [I20-P01](I20-final-documentation-presentation.md#i20-p01); [I20-P02](I20-final-documentation-presentation.md#i20-p02) once each task's prerequisites are accepted.

**Purpose:** Transfer the real provider/device constraints to the next member.

**Scope:** Accepted target preparation/scan/device matrix, private media/sharing behavior, fallback and safe evidence redaction.

**Expected areas/files/modules:** AR/media/recipient setup notes and current accepted provider decision references. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No SDK selection by documentation; disclose tested device/network/license limits and downloaded-pixel revocation limit.

**Acceptance criteria:**

- [ ] Another member can prepare/recognize the accepted target.
- [ ] Access/fallback/retention limitations are clear.
- [ ] No private credential/content leaks into report/screenshots.

**Tests required:** Repeat device/provider instructions against I19 evidence and sensitive-artifact review.

**Out of scope:** Production AR support promise or participant content publication.

**Review focus:** Repeatability and privacy-safe evidence.

---

<a id="i20-p04"></a>

### I20-P04 — Safe demo instructions and presentation preparation

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I20-P01](I20-final-documentation-presentation.md#i20-p01); [I20-P02](I20-final-documentation-presentation.md#i20-p02); [I20-P03](I20-final-documentation-presentation.md#i20-p03) Inherited item hard gates: [I19](I19-final-e2e-security-demo-hardening.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Coordinate a coherent academic presentation using accepted work.

**Scope:** Synthetic actors/target, ordered official scenario, clear sandbox/simulated wording, labeled outage backup and known limitations.

**Expected areas/files/modules:** Final demo instructions and team presentation/rehearsal artifacts. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No real shipment or live-money claim; backup recording clearly states earlier verified run. P1 deferral requires recorded approval.

**Acceptance criteria:**

- [ ] Each presenter knows their feature and backup path.
- [ ] Official scenario includes required Special Date/genuine reveal/verified payment.
- [ ] Limitations and optional deferrals are visible.

**Tests required:** Team rehearsal using safe recorded/provider/device evidence and required live local steps.

**Out of scope:** Unverified live claims or invented institutional requirements.

**Review focus:** Honest reproducible presentation.

---

<a id="i20-p05"></a>

### I20-P05 — Independent reproduction and final handoff review

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I20-P01](I20-final-documentation-presentation.md#i20-p01); [I20-P02](I20-final-documentation-presentation.md#i20-p02); [I20-P03](I20-final-documentation-presentation.md#i20-p03); [I20-P04](I20-final-documentation-presentation.md#i20-p04) Inherited item hard gates: [I19](I19-final-e2e-security-demo-hardening.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Prove the final documentation works for a new member.

**Scope:** Clean setup and required journey reproduction, current links/tool versions, reviewer demo checklist and knowledge transfer.

**Expected areas/files/modules:** Final handoff checklist and setup/document fixes only. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** LEAD final review; a member other than the instruction author performs reproduction. No release/deploy is authorized by this plan.

**Acceptance criteria:**

- [ ] New member reproduces setup and accepted journey.
- [ ] Authorities/contracts/evidence align or approved clarification is recorded.
- [ ] All four members can explain owned boundaries and limitations.

**Tests required:** Clean-repo setup/runtime/quality reproduction plus document links and I19 gate cross-check.

**Out of scope:** Production launch, automatic publish or unreviewed authority modification.

**Review focus:** Team-ready academic handoff.

## Integration / Merge Order

P01 technical description, P02 product walkthrough and P03 provider/device limits may be drafted independently after [I19](I19-final-e2e-security-demo-hardening.md). P04 composes presentation/demo instructions from their evidence. P05 independent reproduction and LEAD checklist closes handoff.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] New member reproduces required journey from clean repo; authorities match implementation; reviewer signs demo checklist.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

A member follows setup and demo instructions from a clean repository, reproduces the mandatory journey and explains boundaries/limitations using current diagrams/contracts and safe evidence.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Final implementation may expose authority drift; coordinate explicit reviewed authority-owner changes through DEV_WORKFLOW, never silently edit a frozen source. External-service/device limits and required P1 deferrals must be honestly visible in handoff.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
