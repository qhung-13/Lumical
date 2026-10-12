# I15 — VI/EN / Theme Hardening

## Summary

Complete vocabulary and visual integration across required flows.

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

- Hard dependencies: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md)
- Soft/helpful dependencies: [I00](I00-repository-project-foundation.md) (already transitive shell/token foundation)
- Blocked by: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md) until their acceptance artifacts are available.
- Blocks: [I16](I16-accessibility-responsive-hardening.md), [I19](I19-final-e2e-security-demo-hardening.md) (direct roadmap consumers).
- Can run in parallel with: Language/theme checks accompany earlier approved slices per ROADMAP §5; full [I15](I15-vi-en-theme-hardening.md) acceptance waits for all real integrated P0 flows.

The authoritative dependency row is **I12, I13, I14; foundation from I00** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [PRODUCT_SCOPE](../docs/PRODUCT_SCOPE.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [DESIGN_SYSTEM](../docs/DESIGN_SYSTEM.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Complete vocabulary and visual integration across required flows. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Full system/admin/payment/AR dictionaries.
- semantic theme checks.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- UGC auto-translation, redesign of approved tokens.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

C23/C24 and BR-I18N-001/002: VI/EN product-managed vocabulary across public/Studio/account/Admin/payment/AR, approved semantic themes with OS default/explicit preference. Language never changes money/state/access; UGC is unchanged.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i15-p01"></a>

### I15-P01 — Vocabulary and semantic theme coverage audit

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md) Inherited item hard gates: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Identify concrete gaps across actual P0 flows.

**Scope:** Dictionary/error/status inventory, approved semantic-role usage, font/glyph and preference behavior checks.

**Expected areas/files/modules:** Frontend i18n/design-system and integrated feature audit. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No token redesign or hardcoded language branching; review VI first and equivalent EN meaning.

**Acceptance criteria:**

- [ ] All P0 managed copy has an accountable mapping.
- [ ] Theme overrides do not bypass approved roles.
- [ ] Gaps have explicit feature owners and acceptance cases.

**Tests required:** Dictionary/key coverage and rendered theme/glyph/state checks.

**Out of scope:** Translation of UGC or new visual design.

**Review focus:** Authority fidelity and missing-state inventory.

---

<a id="i15-p02"></a>

### I15-P02 — Public, Studio and account language/theme completion

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I15-P01](I15-vi-en-theme-hardening.md#i15-p01) Inherited item hard gates: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md)
- Can run in parallel with: [I15-P03](I15-vi-en-theme-hardening.md#i15-p03); [I15-P04](I15-vi-en-theme-hardening.md#i15-p04) once each task's prerequisites are accepted.

**Purpose:** Correct presentation in the product/returning experience.

**Scope:** Catalog, creation, Studio, preview and account forms/errors/empty/loading/disabled states in both modes/languages.

**Expected areas/files/modules:** Templates/CalendarProjects/Account frontend features. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Preserve authored captions/events and fixed USD values; consume one token registry.

**Acceptance criteria:**

- [ ] Long labels/glyphs render without clipping.
- [ ] Meaning/state does not vary by locale.
- [ ] Every product form uses approved semantic roles.

**Tests required:** Component locale/theme/state tests and visual reflow/zoom review.

**Out of scope:** New product content capability or translated personal memories.

**Review focus:** Product consistency and original authorship.

---

<a id="i15-p03"></a>

### I15-P03 — AR, media and recipient copy/theme completion

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I15-P01](I15-vi-en-theme-hardening.md#i15-p01) Inherited item hard gates: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md)
- Can run in parallel with: [I15-P02](I15-vi-en-theme-hardening.md#i15-p02); [I15-P04](I15-vi-en-theme-hardening.md#i15-p04) once each task's prerequisites are accepted.

**Purpose:** Make signature/privacy states understandable across preferences.

**Scope:** Upload, camera instructions/denial/error/retry, reveal/fallback and revoke/invalid-access copy and overlays.

**Expected areas/files/modules:** Media/AR/Recipient frontend features. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Readable transcripts remain authored; camera/media controls and focus use actual dark/light contrast.

**Acceptance criteria:**

- [ ] All camera/access/error states have clear VI/EN copy.
- [ ] Overlay controls stay legible in both themes.
- [ ] Fallback semantics and permissions are unchanged.

**Tests required:** Component camera/access-state tests, visual contrast and device preference checks.

**Out of scope:** New AR effects or automatic transcription/translation service.

**Review focus:** Privacy-safe wording and overlay contrast.

---

<a id="i15-p04"></a>

### I15-P04 — Admin, checkout and payment presentation completion

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I15-P01](I15-vi-en-theme-hardening.md#i15-p01) Inherited item hard gates: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md)
- Can run in parallel with: [I15-P02](I15-vi-en-theme-hardening.md#i15-p02); [I15-P03](I15-vi-en-theme-hardening.md#i15-p03) once each task's prerequisites are accepted.

**Purpose:** Complete operational and commerce vocabulary safely.

**Scope:** Admin tables/forms, reason/inspection states, checkout/payment/cancellation/retry and simulated/no-real-money disclosures.

**Expected areas/files/modules:** Admin/Orders/Payments frontend compositions. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Do not translate canonical API values or raw provider errors verbatim; monetary value remains USD.

**Acceptance criteria:**

- [ ] Financial status meanings are identical in VI/EN.
- [ ] Sandbox/no-shipment disclosure appears throughout.
- [ ] Operational status/control contrast and density follow approved roles.

**Tests required:** T25 component/payment-state tests and both-theme Admin visual/zoom checks.

**Out of scope:** FX, production claims or new reports.

**Review focus:** Honest commerce and operator clarity.

---

<a id="i15-p05"></a>

### I15-P05 — Integrated preference and semantic regression acceptance

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I15-P02](I15-vi-en-theme-hardening.md#i15-p02); [I15-P03](I15-vi-en-theme-hardening.md#i15-p03); [I15-P04](I15-vi-en-theme-hardening.md#i15-p04) Inherited item hard gates: [I12](I12-ar-signature-experience.md); [I13](I13-admin-orders-demo-fulfillment.md); [I14](I14-account-views.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Close bilingual/theme consistency across the real journey.

**Scope:** Cross-route preference retention, OS first default, all states and unchanged prices/civil dates/access/UGC.

**Expected areas/files/modules:** Frontend integrated browser/visual acceptance evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Review snapshot differences against approved registry; no blanket baseline regeneration.

**Acceptance criteria:**

- [ ] Preferences remain consistent across all required areas.
- [ ] Amounts/status/date/permissions are stable on switching.
- [ ] Reviewed glyph/contrast/expansion checks pass.

**Tests required:** T21/T25 Playwright/component visual matrix and static gates.

**Out of scope:** Certification or new design authority.

**Review focus:** Global consistency beyond key coverage.

## Integration / Merge Order

P01 vocabulary/theme audit precedes fixes. P02 product/account and P03 AR/recipient fixes can overlap with P04 Admin/commerce corrections. P05 verifies cross-route persistence and all integrated states before [I16](I16-accessibility-responsive-hardening.md).

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Both languages/themes across core journey, no price/state changes on language switch.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Walk the core journey in VI/EN and light/dark, retain selected preferences across navigation, and show unchanged USD amounts, authored content and permission outcomes.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Long Vietnamese/English labels and real glyph/font files may clip at zoom. Dark media/overlay/status fills need actual rendered contrast, not global inverted styles. Provider raw errors require safe translated outcomes.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
