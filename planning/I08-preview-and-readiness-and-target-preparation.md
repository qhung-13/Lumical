# I08 — Preview + Readiness + Target Preparation

## Summary

Honest preview and separate readiness, chosen adapter's owner target preparation/preview.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M2 — Calendar Creation

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

MEMBER_3

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

LEAD, MEMBER_2, MEMBER_4. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I07](I07-studio-personalization.md); [I03](I03-early-ar-technology-spike.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I07](I07-studio-personalization.md); [I03](I03-early-ar-technology-spike.md) until their acceptance artifacts are available.
- Blocks: [I09](I09-order-snapshot-and-checkout.md), [I12](I12-ar-signature-experience.md) (direct roadmap consumers).
- Can run in parallel with: Preview rendering and target preparation can overlap after reviewed readiness contracts; [I09](I09-order-snapshot-and-checkout.md) waits for genuine target/owner-preview acceptance.

The authoritative dependency row is **I07, I03** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [DATABASE](../docs/DATABASE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)
- [ADR-005-ar-provider-boundary](../docs/adr/ADR-005-ar-provider-boundary.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Honest preview and separate readiness, chosen adapter's owner target preparation/preview. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Full/year+month preview/list alternative.
- immutable Ready target artifact.
- owner correct-content preview/fallback.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Recipient publication, fake target-ready flag, print-fidelity claim.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

Preview-ready, AR-ready and Order-ready are distinct. Incomplete preview is valid. Order readiness requires active Working owned work, twelve Months, at least one Ready image, one genuine Ready target/reveal and review of current version; no event-count or twelve-photo gate. Sharing readiness is Order-scoped later.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i08-p01"></a>

### I08-P01 — Derived readiness policies and query contract

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I07](I07-studio-personalization.md); [I03](I03-early-ar-technology-spike.md) Inherited item hard gates: [I07](I07-studio-personalization.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Keep each readiness decision authoritative and separate.

**Scope:** Preview/AR/Order rules, issue vocabulary, versioned preview/readiness/checkout-preview projections.

**Expected areas/files/modules:** CalendarProjects readiness domain/application and API contract implementation. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Year advancement does not invalidate an existing Project; sharing readiness is not inferred from current Project.

**Acceptance criteria:**

- [ ] Incomplete work remains previewable.
- [ ] Zero Special Dates do not block Order-ready.
- [ ] Current revision, Ready image and real AR mapping are required.

**Tests required:** Jest rule matrix and Supertest version/issue tests; T19/T20.

**Out of scope:** Recipient sharing or false combined Ready state.

**Review focus:** BR-RDY-001–004 separation.

---

<a id="i08-p02"></a>

### I08-P02 — Version-bound immutable target preparation

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I08-P01](I08-preview-and-readiness-and-target-preparation.md#i08-p01) Inherited item hard gates: [I07](I07-studio-personalization.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: [I08-P03](I08-preview-and-readiness-and-target-preparation.md#i08-p03) once each task's prerequisites are accepted.

**Purpose:** Implement the selected real preparation adapter.

**Scope:** After-commit job intent, bounded preparation/retry, source-version binding and immutable Ready artifact persistence.

**Expected areas/files/modules:** AR ports/selected infrastructure adapter and durable job use cases. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No provider call in DB transaction; stale results remain identifiable and cannot overwrite current or pinned artifact bytes.

**Acceptance criteria:**

- [ ] Preparation uses accepted I03 approach.
- [ ] Ready artifact pins source revision.
- [ ] Failure/retry never fabricates readiness.

**Tests required:** Adapter fake failures plus real preparation/device proof and PostgreSQL stale-result/race tests.

**Out of scope:** Public target storage or advanced effects.

**Review focus:** Immutable artifact and version correctness.

---

<a id="i08-p03"></a>

### I08-P03 — Whole-year and Month preview with readable alternative

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I08-P01](I08-preview-and-readiness-and-target-preparation.md#i08-p01) Inherited item hard gates: [I07](I07-studio-personalization.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: [I08-P02](I08-preview-and-readiness-and-target-preparation.md#i08-p02) once each task's prerequisites are accepted.

**Purpose:** Make incomplete and complete calendars honestly reviewable.

**Scope:** Overall/Month rendering of curated style, images/messages/dates and readiness issues; nonvisual ordered list alternative.

**Expected areas/files/modules:** Frontend CalendarProjects preview feature and shared DS. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Preview displays saved version rather than silently combining unsaved inputs; paper material may stay light inside dark shell.

**Acceptance criteria:**

- [ ] All twelve Months and dates are reviewable.
- [ ] Missing content is explained without claiming orderability.
- [ ] Readable alternative supports keyboard/assistive use.

**Tests required:** Component preview/state/civil-date tests; visual/mobile/zoom evidence.

**Out of scope:** Export/production printing fidelity or generic editor.

**Review focus:** Content accuracy and accessible preview.

---

<a id="i08-p04"></a>

### I08-P04 — Authorized owner target and reveal preview

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I08-P02](I08-preview-and-readiness-and-target-preparation.md#i08-p02) Inherited item hard gates: [I07](I07-studio-personalization.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: [I08-P03](I08-preview-and-readiness-and-target-preparation.md#i08-p03) once each task's prerequisites are accepted.

**Purpose:** Prove the intended mapping before any Order exists.

**Scope:** Owner scoped artifact/reveal/fallback HTTP paths and accepted recognizer preview composition.

**Expected areas/files/modules:** Backend AR owner interface and frontend AR owner-preview feature. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Authorization precedes target lookup; owner preview creates no recipient grant.

**Acceptance criteria:**

- [ ] Prepared target reveals the intended owned asset/text.
- [ ] Wrong-owner/unknown/stale target reveals nothing unrelated.
- [ ] Camera-denied path returns the same authorized content.

**Tests required:** T16/T17/T20 owner API negatives and genuine mobile recognition.

**Out of scope:** Anonymous publication or global target lookup.

**Review focus:** Access-first resolution and media isolation.

---

<a id="i08-p05"></a>

### I08-P05 — Current-preview review and checkout handoff

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I08-P03](I08-preview-and-readiness-and-target-preparation.md#i08-p03); [I08-P04](I08-preview-and-readiness-and-target-preparation.md#i08-p04) Inherited item hard gates: [I07](I07-studio-personalization.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Tie owner review to a specific eligible saved version.

**Scope:** Current preview acknowledgement/navigation and invalidation after content changes; typed readiness CTA.

**Expected areas/files/modules:** Preview feature and future checkout integration boundary. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Store only safe UI review state; I09 backend must enforce reviewedProjectVersion. Readiness is not an Order.

**Acceptance criteria:**

- [ ] Review records the currently displayed revision.
- [ ] Any edit invalidates stale review.
- [ ] Only authoritative eligible state offers checkout continuation.

**Tests required:** Component stale-version/refresh and API reviewed-version integration fixtures.

**Out of scope:** Placing Orders before I09.

**Review focus:** Correct reviewed revision and honest handoff.

---

<a id="i08-p06"></a>

### I08-P06 — Preparation and readiness acceptance proof

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I08-P01](I08-preview-and-readiness-and-target-preparation.md#i08-p01); [I08-P02](I08-preview-and-readiness-and-target-preparation.md#i08-p02); [I08-P03](I08-preview-and-readiness-and-target-preparation.md#i08-p03); [I08-P04](I08-preview-and-readiness-and-target-preparation.md#i08-p04); [I08-P05](I08-preview-and-readiness-and-target-preparation.md#i08-p05) Inherited item hard gates: [I07](I07-studio-personalization.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Prove this gate with real target evidence before snapshot work.

**Scope:** Incomplete preview, true Ready artifact, owner correct-content/fallback, zero-event eligibility and stale preparation negatives.

**Expected areas/files/modules:** AR/readiness DB/API/browser/device acceptance evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Synthetic data only; device evidence complements fake adapter tests and cannot be replaced by a screenshot.

**Acceptance criteria:**

- [ ] Genuine accepted target/reveal is demonstrated.
- [ ] Zero-event ready Project passes reviewed eligibility.
- [ ] Wrong/stale/unready mappings fail safely.

**Tests required:** T16/T17/T19/T20/T21 and actual adapter/device run plus static gates.

**Out of scope:** Payment/sharing acceptance or video-only requirement.

**Review focus:** Real feasibility and version-bound readiness.

## Integration / Merge Order

P01 readiness review precedes P02 adapter and P03 rendering; P04 owner target preview follows P02; P05 current-preview review follows P03/P04. P06 verifies genuine preparation and eligibility before [I09](I09-order-snapshot-and-checkout.md) starts.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Incomplete draft previewable; genuine prepared target ready; image+message accepted; zero-date Project can be Order-ready after review.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Preview an incomplete calendar, prepare and recognize a real image/message target, show same-content owner fallback and prove a valid zero-event Project becomes Order-ready after current-version review.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

A preparation result for an old revision cannot make the current config Ready. Artifacts must remain immutable for future Order pins; target replacement cannot mutate prior bytes. Preview must not imply undefined print fidelity.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
