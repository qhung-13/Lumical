# I18 — P2 Stretch (optional)

## Summary

Separately approved wishes/editorial/richer AR or insights, capacity permitting.

Initial item status: **DEFERRED**. All tasks are DEFERRED / OPTIONAL; no extension has been selected or approved.

## Milestone

M4 — Product Completion

## Priority

P2 / stretch / OPTIONAL — not scheduled; all tasks DEFERRED.

## Primary Owner

LEAD

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

MEMBER_2, MEMBER_3, MEMBER_4. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: Stable accepted P0; [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral; Specific scope-owner approval for the selected P2 extension
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: Stable accepted P0, accepted I17 or explicit approved P1 deferral, and specific P2 admission approval.
- Blocks: No later mandatory item; this item closes its stated acceptance. I18 never blocks I19 or I20; its admission controls only its own optional work.
- Can run in parallel with: No active stretch work now. Once explicitly admitted, an extension may run separately from [I19](I19-final-e2e-security-demo-hardening.md) only if it consumes no unaccepted gate and does not block mandatory release work.

The authoritative dependency row is **Stable P0; I17 or approved P1 deferral; specific scope approval** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [PRODUCT_SCOPE](../docs/PRODUCT_SCOPE.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [DATABASE](../docs/DATABASE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [DEV_WORKFLOW](../docs/DEV_WORKFLOW.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Separately approved wishes/editorial/richer AR or insights, capacity permitting. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Only selected extension docs/contracts/models/tests.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Newsletter/reviews/editorial comments/likes or other OUT features.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.
- Any extension implementation before specific approval and an extension-specific reviewed breakdown.

## Architecture / Business Constraints

No extension selected. Only separately approved P2 capability may be decomposed: wishes, limited editorial, richer AR or permitted insights; rights/privacy/moderation review as relevant. Future changes cannot mutate existing Order versions. OUT newsletter/reviews/editorial comments/likes remain OUT.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i18-p01"></a>

### I18-P01 — Optional capability admission and scope decision

- Owner: LEAD
- Reviewer: LEAD
- Status: DEFERRED / OPTIONAL
- Depends on: Stable P0; [I17](I17-p1-recovery-notifications.md) or approved P1 deferral; Specific P2 scope approval Inherited item hard gates: Stable accepted P0; [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral; Specific scope-owner approval for the selected P2 extension
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Decide whether capacity supports one allowed optional capability.

**Scope:** Confirm stable core, controlled P1 commitment, capability priority/privacy/rights review and named scope-owner approval.

**Expected areas/files/modules:** Future optional ticket/decision artifacts only. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Not authorization to implement every P2 capability; OUT promotion would require a separate reviewed Product Scope revision.

**Acceptance criteria:**

- [ ] Core stability evidence is recorded.
- [ ] A single extension or continued deferral is explicit.
- [ ] No mandatory milestone depends on extension completion.

**Tests required:** Review gate evidence, approved scope and mandatory regression status.

**Out of scope:** Implementing P2 now or silently promoting OUT.

**Review focus:** Optional admission and semester capacity.

---

<a id="i18-p02"></a>

### I18-P02 — Extension-specific contract and small-MR decomposition

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: DEFERRED / OPTIONAL
- Depends on: [I18-P01](I18-p2-stretch-optional.md#i18-p01) Inherited item hard gates: Stable accepted P0; [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral; Specific scope-owner approval for the selected P2 extension
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Make an approved extension executable without guessing its domain today.

**Scope:** With relevant specialists, map the selected capability to reviewed API/model/UI changes, tests and one-owner small Pxx tasks.

**Expected areas/files/modules:** Future selected feature area and execution-plan refinement. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Wishes need owner moderation/future-version constraints; editorial excludes comments/likes; analytics requires approved privacy decisions. Assign actual implementation owners after scope is known.

**Acceptance criteria:**

- [ ] Selected extension has explicit dependency/permission boundaries.
- [ ] Each future slice has owner/tests/review gate.
- [ ] Earlier Order snapshots and P0 entities need no required P2 FK.

**Tests required:** Contract/invariant review and extension-specific test design before code.

**Out of scope:** Generic implement-all-stretch task or invented endpoints now.

**Review focus:** Concrete decomposition without scope invention.

---

<a id="i18-p03"></a>

### I18-P03 — Optional extension regression and release admission

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: DEFERRED / OPTIONAL
- Depends on: [I18-P02](I18-p2-stretch-optional.md#i18-p02) Inherited item hard gates: Stable accepted P0; [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral; Specific scope-owner approval for the selected P2 extension
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Keep stretch work isolated from mandatory acceptance.

**Scope:** Plan separate feature-specific tests, privacy/rights/moderation evidence and mandatory suite reruns with specialist fixes.

**Expected areas/files/modules:** Future optional test/evidence and release-admission artifacts. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** MEMBER_3 supports AR/privacy if relevant; LEAD reviews every MR; I19 proceeds independently when its own gates pass.

**Acceptance criteria:**

- [ ] Optional branch cannot block I19/I20.
- [ ] Historical/private/core invariants remain unchanged.
- [ ] Failure leaves the extension deferred without weakening core acceptance.

**Tests required:** Chosen extension negatives plus entire P0/P1 regression contract.

**Out of scope:** I18 as a final-demo requirement.

**Review focus:** Regression isolation and honest optional status.

## Integration / Merge Order

P01 admission decision first; P02 replaces this minimal conditional plan with reviewed extension-specific small MRs; P03 establishes independent regression admission. All three are DEFERRED/OPTIONAL now; no implementation MR starts from generic placeholder tasks.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Each extension approved and isolated, no historical snapshot mutation; no core regression.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced; optional acceptance exists only after admission.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Only after approval: show the explicitly selected extension against its reviewed contract, unchanged earlier snapshots and a passing mandatory regression suite. No P2 demo is currently promised.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Capacity pressure can silently turn optional enhancement into a mandatory dependency. P2 contracts/models are deliberately unspecified; do not invent them as part of this plan. Stable P0/P1 and specific approval are genuine admission gates.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
