# I19 — Final E2E / Security / Demo Hardening

## Summary

Prove mandatory integrated acceptance and recovery.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M5 — Release & Academic Delivery

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

MEMBER_4

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

LEAD, MEMBER_2, MEMBER_3. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md); [I15](I15-vi-en-theme-hardening.md); [I16](I16-accessibility-responsive-hardening.md); [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral
- Soft/helpful dependencies: [I18](I18-p2-stretch-optional.md) only if an extension is already accepted; never a gate
- Blocked by: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md); [I15](I15-vi-en-theme-hardening.md); [I16](I16-accessibility-responsive-hardening.md); [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral until their acceptance artifacts are available.
- Blocks: [I20](I20-final-documentation-presentation.md) (direct roadmap consumers).
- Can run in parallel with: Independent security, product, device and reproducibility verification can overlap after hard gates; fixes remain with module owners. [I18](I18-p2-stretch-optional.md) may stay deferred and cannot block this item.

The authoritative dependency row is **I12–I17; approved P1 deferral if applicable; **not I18**** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [PRODUCT_SCOPE](../docs/PRODUCT_SCOPE.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)
- [DEV_WORKFLOW](../docs/DEV_WORKFLOW.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [DESIGN_SYSTEM](../docs/DESIGN_SYSTEM.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Prove mandatory integrated acceptance and recovery. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Full INV-01..14 evidence.
- sandbox/device acceptance.
- secret/authorization/concurrency checks.
- deterministic synthetic demo.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Treating mock/recording as live proof, optional-feature completion dependency.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

Final integration/hardening adds no capability. Prove INV-01–14 with proper DB/API/provider/device layers, real sandbox and genuine mobile AR. Official demo includes one Special Date; separate valid zero-event Order test. Synthetic data, explicit sandbox and physically simulated fulfillment.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i19-p01"></a>

### I19-P01 — Final scenario and invariant evidence register

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md); [I15](I15-vi-en-theme-hardening.md); [I16](I16-accessibility-responsive-hardening.md); [I17](I17-p1-recovery-notifications.md) or approved P1 deferral Inherited item hard gates: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md); [I15](I15-vi-en-theme-hardening.md); [I16](I16-accessibility-responsive-hardening.md); [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Coordinate complete acceptance without inventing a new test promise.

**Scope:** Map INV-01–14/T01–26 to layers/owners, deterministic identities/media and genuine external/device gates.

**Expected areas/files/modules:** Final test/evidence register and synthetic scenario fixtures. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Confirm P1 acceptance or explicit scope-owner deferral; no I18 dependency or invented academic rubric.

**Acceptance criteria:**

- [ ] Every invariant has responsible evidence.
- [ ] Official demo and zero-event negative/positive coverage are distinct.
- [ ] External proof is separated from fake CI checks.

**Tests required:** Review scenario/layer traceability and fixture reproducibility.

**Out of scope:** New product features or equal test coverage percentages.

**Review focus:** No missing mandatory gate.

---

<a id="i19-p02"></a>

### I19-P02 — Core commerce and security regression fixes

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I19-P01](I19-final-e2e-security-demo-hardening.md#i19-p01) Inherited item hard gates: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md); [I15](I15-vi-en-theme-hardening.md); [I16](I16-accessibility-responsive-hardening.md); [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral
- Can run in parallel with: [I19-P03](I19-final-e2e-security-demo-hardening.md#i19-p03); [I19-P04](I19-final-e2e-security-demo-hardening.md#i19-p04); [I19-P05](I19-final-e2e-security-demo-hardening.md#i19-p05); [I19-P06](I19-final-e2e-security-demo-hardening.md#i19-p06) once each task's prerequisites are accepted.

**Purpose:** Own fixes in the highest-risk domain and security paths.

**Scope:** Sessions/CSRF/role boundaries, exact-money/snapshot races, provider evidence/restart, share generation and safe errors/logs.

**Expected areas/files/modules:** Identity/Project/Orders/Payments/Sharing DB/API integration and affected core source. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Fix only observed defects; teammate reviews LEAD-owned MRs, LEAD remains final accountability.

**Acceptance criteria:**

- [ ] Core race/permission negatives pass.
- [ ] No false or duplicate settlement exists.
- [ ] Secret/private fields are absent from bundles/logs/DTOs.

**Tests required:** T01–T15/T18/T22/T24/T26 real-DB/API and genuine sandbox rerun when affected.

**Out of scope:** New security architecture, refunds or features.

**Review focus:** INV-01–14 at authoritative layers.

---

<a id="i19-p03"></a>

### I19-P03 — Creation, checkout and account E2E regression fixes

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I19-P01](I19-final-e2e-security-demo-hardening.md#i19-p01) Inherited item hard gates: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md); [I15](I15-vi-en-theme-hardening.md); [I16](I16-accessibility-responsive-hardening.md); [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral
- Can run in parallel with: [I19-P02](I19-final-e2e-security-demo-hardening.md#i19-p02); [I19-P04](I19-final-e2e-security-demo-hardening.md#i19-p04); [I19-P05](I19-final-e2e-security-demo-hardening.md#i19-p05); [I19-P06](I19-final-e2e-security-demo-hardening.md#i19-p06) once each task's prerequisites are accepted.

**Purpose:** Own product experience fixes in the final integrated flow.

**Scope:** Discover/create/twelve-Month/date/preview/Order/returning account journeys, state retention and keyboard/locale/theme regressions.

**Expected areas/files/modules:** Product/Studio/Preview/Orders/Account features and browser/component tests. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use actual backend contracts and synthetic identities; test zero-event Order separately from demo's Special Date.

**Acceptance criteria:**

- [ ] Complete creation/checkout works without manual data edits.
- [ ] Input survives recoverable failures.
- [ ] Historical account display stays fixed after source changes.

**Tests required:** Critical Playwright journey, T05/T06/T19/T21/T25 and affected component/API tests.

**Out of scope:** Product redesign or optional capabilities.

**Review focus:** End-to-end truth and user recovery.

---

<a id="i19-p04"></a>

### I19-P04 — Media, sharing and genuine AR regression fixes

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I19-P01](I19-final-e2e-security-demo-hardening.md#i19-p01) Inherited item hard gates: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md); [I15](I15-vi-en-theme-hardening.md); [I16](I16-accessibility-responsive-hardening.md); [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral
- Can run in parallel with: [I19-P02](I19-final-e2e-security-demo-hardening.md#i19-p02); [I19-P03](I19-final-e2e-security-demo-hardening.md#i19-p03); [I19-P05](I19-final-e2e-security-demo-hardening.md#i19-p05); [I19-P06](I19-final-e2e-security-demo-hardening.md#i19-p06) once each task's prerequisites are accepted.

**Purpose:** Own recipient/provider/device fixes before handoff.

**Scope:** Actual private original/derivative protection, scoped streams, genuine ordered recognition, denial/unsupported/fallback/revoke and artifact history.

**Expected areas/files/modules:** Media/AR/Recipient/Sharing adapters/features and device/API suites. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Retest accepted I03 limits; camera start/exit and fallback remain accessible; no substitution on missing media.

**Acceptance criteria:**

- [ ] Genuine prepared paid-version reveal works.
- [ ] Wrong/old/revoked access reveals nothing private.
- [ ] Camera-free path preserves same content and history.

**Tests required:** T14–T17/T20/T23/T24/T26 plus actual storage/device acceptance.

**Out of scope:** New SDK/effects or fallback-only AR claim.

**Review focus:** Provider/device evidence and version isolation.

---

<a id="i19-p05"></a>

### I19-P05 — Admin, accessibility and responsive regression fixes

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I19-P01](I19-final-e2e-security-demo-hardening.md#i19-p01) Inherited item hard gates: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md); [I15](I15-vi-en-theme-hardening.md); [I16](I16-accessibility-responsive-hardening.md); [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral
- Can run in parallel with: [I19-P02](I19-final-e2e-security-demo-hardening.md#i19-p02); [I19-P03](I19-final-e2e-security-demo-hardening.md#i19-p03); [I19-P04](I19-final-e2e-security-demo-hardening.md#i19-p04) once each task's prerequisites are accepted.

**Purpose:** Own operational and product-quality implementation corrections.

**Scope:** Fulfillment/audit/inspection, VI/EN/themes, axe/manual focus, 320px/200% and compact data composition.

**Expected areas/files/modules:** Admin/Fulfillment/i18n/design-system affected areas and integration evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Do not hide failing checks or regenerate snapshots blindly; owners review shared primitive corrections.

**Acceptance criteria:**

- [ ] Admin cannot bypass settlement or private scope.
- [ ] Keyboard/screen-reader/reflow checks pass required real states.
- [ ] All sandbox/simulated labels remain clear.

**Tests required:** T13/T18/T21/T25 DB/API/browser plus manual/axe/visual checks.

**Out of scope:** Certification claims or advanced admin reports.

**Review focus:** Operational integrity and common acceptance gate.

---

<a id="i19-p06"></a>

### I19-P06 — Docker and clean-setup reproducibility proof

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I19-P01](I19-final-e2e-security-demo-hardening.md#i19-p01) Inherited item hard gates: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md); [I15](I15-vi-en-theme-hardening.md); [I16](I16-accessibility-responsive-hardening.md); [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral
- Can run in parallel with: [I19-P02](I19-final-e2e-security-demo-hardening.md#i19-p02); [I19-P03](I19-final-e2e-security-demo-hardening.md#i19-p03); [I19-P04](I19-final-e2e-security-demo-hardening.md#i19-p04) once each task's prerequisites are accepted.

**Purpose:** Prove another member can reproduce the finished academic system.

**Scope:** Pinned frozen installation, migrations from empty/upgrade fixture, synthetic demo seed, local/Compose startup and endpoint/core smoke.

**Expected areas/files/modules:** Setup/runtime verification artifacts and isolated LumiCal test environment. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Scope commands to dedicated project/resources; no pruning, shared resets or production deploy. Fix only demonstrated reproducibility defects.

**Acceptance criteria:**

- [ ] Fresh checkout instructions reproduce required gates.
- [ ] DB/media/provider/device prerequisites are explicit.
- [ ] Smoke resources clean up without touching unrelated projects.

**Tests required:** pnpm verify plus isolated migration/Docker/core runtime smoke; no fake paid/AR seed acceptance.

**Out of scope:** Production hosting or destructive shared cleanup.

**Review focus:** Reproducible configuration and scoped cleanup.

---

<a id="i19-p07"></a>

### I19-P07 — Final acceptance, demo rehearsal and regression closure

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I19-P02](I19-final-e2e-security-demo-hardening.md#i19-p02); [I19-P03](I19-final-e2e-security-demo-hardening.md#i19-p03); [I19-P04](I19-final-e2e-security-demo-hardening.md#i19-p04); [I19-P05](I19-final-e2e-security-demo-hardening.md#i19-p05); [I19-P06](I19-final-e2e-security-demo-hardening.md#i19-p06) Inherited item hard gates: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md); [I15](I15-vi-en-theme-hardening.md); [I16](I16-accessibility-responsive-hardening.md); [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Close mandatory evidence and an honest presentation path.

**Scope:** All-owner rehearsal, full static/invariant/critical suite, safe genuine provider/device evidence and labeled outage recording backup.

**Expected areas/files/modules:** Final acceptance checklist and synthetic demo evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** LEAD final review plus required authority-owner approval for any documented exception/deferral; dates/capacity not invented.

**Acceptance criteria:**

- [ ] All mandatory gates pass or have permitted explicit approved deferral.
- [ ] Official Special Date and separate zero-event proof exist.
- [ ] Recording is labeled backup and does not replace live acceptance.

**Tests required:** Testing Strategy Definition of Tested, full regression plus genuine sandbox/device repeat run.

**Out of scope:** Marking incomplete capabilities ready for presentation convenience.

**Review focus:** Honest integrated readiness.

## Integration / Merge Order

P01 establishes traceable final scenarios; P02/P03/P04/P05/P06 verify and fix independently in their owned areas after agreed scenarios. P07 integrates evidence and final regression rerun. No release acceptance while a mandatory failure or unresolved P1 deferral remains.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Testing Strategy Definition of Tested; one Special Date in demo, valid zero-date Order test, genuine AR/verified sandbox and honest simulated fulfillment.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Reproduce Product Scope §23's entire synthetic journey, including two live Month edits/all twelve, one Special Date, verified sandbox, Admin simulated progression, explicit share, genuine target reveal/fallback and brief VI/EN/theme/accessibility checks.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Mock-green CI can conceal failing genuine provider/device acceptance. Demonstration recordings may assist an outage explanation but cannot stand in for acceptance. Final cleanup/reproducibility must not affect unrelated Docker projects or historical participant data.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
