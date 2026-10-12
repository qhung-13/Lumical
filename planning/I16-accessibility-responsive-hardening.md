# I16 — Accessibility / Responsive Hardening

## Summary

Complete Design System common gate across real integrated views.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M4 — Product Completion

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

MEMBER_4

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

MEMBER_2, MEMBER_3, LEAD. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I15](I15-vi-en-theme-hardening.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I15](I15-vi-en-theme-hardening.md) until their acceptance artifacts are available.
- Blocks: [I17](I17-p1-recovery-notifications.md), [I19](I19-final-e2e-security-demo-hardening.md) (direct roadmap consumers).
- Can run in parallel with: Keyboard/reflow checks and fixes accompany earlier slices; consolidated acceptance starts after [I15](I15-vi-en-theme-hardening.md) and combines independently owned product/recipient/Admin corrections.

The authoritative dependency row is **I15** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [DESIGN_SYSTEM](../docs/DESIGN_SYSTEM.md)
- [PRODUCT_SCOPE](../docs/PRODUCT_SCOPE.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)
- [DEV_WORKFLOW](../docs/DEV_WORKFLOW.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Complete Design System common gate across real integrated views. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- axe results.
- manual keyboard/screen-reader/zoom/mobile evidence.
- visual baselines.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Claiming certification from automated test alone.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

Design System WCAG 2.2 AA target; manual keyboard/screen reader complements axe, 320px reflow/200% browser and text zoom, reduced motion, captions/transcripts and both languages/themes. Exceptions need explicit scoped justification/review; automated pass is not certification.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i16-p01"></a>

### I16-P01 — Common-gate audit on integrated screens

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I15](I15-vi-en-theme-hardening.md) Inherited item hard gates: [I15](I15-vi-en-theme-hardening.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Locate actual usability defects across required flows.

**Scope:** axe/visual cases for public/Studio/checkout/account/recipient/Admin; manual focus/reading-order, zoom/reflow and reduced motion.

**Expected areas/files/modules:** Browser accessibility/visual tests and defect evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use authority breakpoints and exact font/media fixtures; findings need owner and reproducible state.

**Acceptance criteria:**

- [ ] Representative real states are covered.
- [ ] Automated and manual findings are distinguished.
- [ ] Every actionable issue has affected owner/acceptance evidence.

**Tests required:** T21 axe plus manual keyboard/screen reader and width/zoom matrix.

**Out of scope:** Certification claim or invented enterprise audit.

**Review focus:** Reproducible actual defects.

---

<a id="i16-p02"></a>

### I16-P02 — Product, preview and checkout accessibility fixes

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I16-P01](I16-accessibility-responsive-hardening.md#i16-p01) Inherited item hard gates: [I15](I15-vi-en-theme-hardening.md)
- Can run in parallel with: [I16-P03](I16-accessibility-responsive-hardening.md#i16-p03); [I16-P04](I16-accessibility-responsive-hardening.md#i16-p04) once each task's prerequisites are accepted.

**Purpose:** Own fixes in creation and commerce presentation.

**Scope:** Form labels/error summary, Month navigation, preview list alternative, dialog focus, checkout feedback and compact composition.

**Expected areas/files/modules:** Templates/Studio/Preview/Orders frontend and needed shared DS fixes. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** A shared control correction gets affected-owner review; no per-feature parallel Dialog.

**Acceptance criteria:**

- [ ] Keyboard path preserves logical focus.
- [ ] Preview and form meaning are accessible.
- [ ] 320px/200% and VI/EN errors do not clip.

**Tests required:** Component focus/error tests plus manual/browser T21 regressions.

**Out of scope:** Visual redesign or new product features.

**Review focus:** Shared interactions and nonvisual content.

---

<a id="i16-p03"></a>

### I16-P03 — Media, camera and recipient accessibility fixes

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I16-P01](I16-accessibility-responsive-hardening.md#i16-p01) Inherited item hard gates: [I15](I15-vi-en-theme-hardening.md)
- Can run in parallel with: [I16-P02](I16-accessibility-responsive-hardening.md#i16-p02); [I16-P04](I16-accessibility-responsive-hardening.md#i16-p04) once each task's prerequisites are accepted.

**Purpose:** Own signature-experience usability corrections.

**Scope:** Chooser/progress labels, explicit camera control, readable state, captions/transcripts/fallback and overlay targets.

**Expected areas/files/modules:** Media/AR/Recipient features and shared overlay composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Stop camera on leave; respect reduced motion and mobile keyboard/safe areas; no hover-only recovery.

**Acceptance criteria:**

- [ ] Denied/unsupported flows remain usable.
- [ ] Controls and status have accessible names/text.
- [ ] Readable media/fallback survives zoom/compact themes.

**Tests required:** Component/device manual keyboard/media/camera and axe checks.

**Out of scope:** New media categories or animation effects.

**Review focus:** Accessible authorized equivalence.

---

<a id="i16-p04"></a>

### I16-P04 — Admin and account responsive operational fixes

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I16-P01](I16-accessibility-responsive-hardening.md#i16-p01) Inherited item hard gates: [I15](I15-vi-en-theme-hardening.md)
- Can run in parallel with: [I16-P02](I16-accessibility-responsive-hardening.md#i16-p02); [I16-P03](I16-accessibility-responsive-hardening.md#i16-p03) once each task's prerequisites are accepted.

**Purpose:** Own operational implementation fixes beyond QA.

**Scope:** Labeled table/list transformation, filter/action focus, reason/inspection forms and account status feedback.

**Expected areas/files/modules:** Admin/Account features and shared data/layout primitives. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No squeezed desktop table or hidden critical state; reserve space under sticky controls.

**Acceptance criteria:**

- [ ] Compact data preserves label/action relationships.
- [ ] Stale/expired/error feedback is reachable.
- [ ] Keyboard focus is not covered by sticky/portal layers.

**Tests required:** Component table/list/focus tests, axe and manual screen-reader/zoom checks.

**Out of scope:** New reports, navigation scope or lower text baseline.

**Review focus:** Operational readability and focus.

---

<a id="i16-p05"></a>

### I16-P05 — Consolidated visual/accessibility acceptance

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I16-P02](I16-accessibility-responsive-hardening.md#i16-p02); [I16-P03](I16-accessibility-responsive-hardening.md#i16-p03); [I16-P04](I16-accessibility-responsive-hardening.md#i16-p04) Inherited item hard gates: [I15](I15-vi-en-theme-hardening.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Verify fixes and retain evidence for final delivery.

**Scope:** Both language/theme common gate, motion/reflow/zoom, component interactions and justified exception review.

**Expected areas/files/modules:** Accessibility/browser visual evidence and acceptance checklist. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** LEAD coordinates authority-owner review for any exception; passing axe alone cannot close manual checks.

**Acceptance criteria:**

- [ ] All required common-gate evidence is reviewed.
- [ ] Any exception is explicitly justified/scoped/approved.
- [ ] No privacy/payment behavior regressed.

**Tests required:** T21 integrated visual/axe/manual suite plus focused affected API/E2E and static gates.

**Out of scope:** Unreviewed baseline changes or certification.

**Review focus:** Full gate and regression discipline.

## Integration / Merge Order

P01 baseline evidence locates issues; P02/P03/P04 fix their owned areas independently against it. P05 reruns the whole common gate with LEAD review of exceptions and acceptance.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] 320px, 200%, focus/dialog/drawer/reduced motion/media alternative and both themes; exceptions reviewed.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Keyboard-only core path with focus entry/return, screen-reader labels/announcements, 320px and 200% zoom views, reduced motion, camera-free and readable preview/media alternatives.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Sticky save/exit elements can obscure focused content; modal portals can render menus behind overlays. Preview/camera/media meaning must have readable alternatives. Reflow exceptions must be contained and explained, not whole-page overflow.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
