# I04 — Template Catalog + Admin Templates

## Summary

Active discovery, complete revisions/presets/USD price and Admin availability.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M2 — Calendar Creation

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

MEMBER_2

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

MEMBER_4, MEMBER_3, LEAD. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md) until their acceptance artifacts are available.
- Blocks: [I05](I05-calendar-project-twelve-months.md) (direct roadmap consumers).
- Can run in parallel with: [I06](I06-private-media-pipeline.md) after [I02](I02-identity-and-sessions.md)/contracts; reviewed catalog/API fixtures permit presentation work while backend finishes, not live integration acceptance.

The authoritative dependency row is **I01, I02** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [DATABASE](../docs/DATABASE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [DESIGN_SYSTEM](../docs/DESIGN_SYSTEM.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Active discovery, complete revisions/presets/USD price and Admin availability. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Public/admin typed API and UI.
- synthetic catalog.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Discounts, Template hard delete, marketplace.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

BR-TPL-001–004 and BR-PRICE-001: only active complete published revisions start new Projects. Published revisions and captured baselines remain immutable; positive USD unit price, no Template hard deletion.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i04-p01"></a>

### I04-P01 — Template revisions and public catalog API

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md) Inherited item hard gates: [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Provide typed published starting designs.

**Scope:** Template queries/domain policies, complete immutable revision projections, allowlisted filtering/paging and managed VI/EN copy.

**Expected areas/files/modules:** Backend Templates interface/application/domain/infrastructure; generated frontend contract. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** LEAD approves the API/projection and publication contract before consumers expand.

**Acceptance criteria:**

- [ ] Only active published complete Templates are visible.
- [ ] Positive USD minor-unit price and approved presets are projected.
- [ ] Pagination/filtering matches API_CONTRACT.

**Tests required:** Jest/Supertest plus PostgreSQL availability/revision and serialization tests.

**Out of scope:** Custom marketplace or promotion pricing.

**Review focus:** Published baseline invariants and explicit DTOs.

---

<a id="i04-p02"></a>

### I04-P02 — Audited publication and availability operations

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I04-P01](I04-template-catalog-and-admin-templates.md#i04-p01) Inherited item hard gates: [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Can run in parallel with: [I04-P03](I04-template-catalog-and-admin-templates.md#i04-p03) once each task's prerequisites are accepted.

**Purpose:** Let Admin maintain future catalog availability safely.

**Scope:** Create inactive Template, publish revision, activate/deactivate/archive with reason, version and idempotency/audit.

**Expected areas/files/modules:** Backend Templates commands and Admin interface. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use module-owned application commands; no direct Admin ORM edits.

**Acceptance criteria:**

- [ ] Used revisions stay immutable.
- [ ] Incomplete definitions cannot activate.
- [ ] Duplicate/stale availability actions preserve audit/state truth.

**Tests required:** PostgreSQL/API role, version, duplicate publication and audit rollback tests.

**Out of scope:** Template deletion or forced mutation of existing Projects.

**Review focus:** Atomic publication and least privilege.

---

<a id="i04-p03"></a>

### I04-P03 — Public catalog and detail experience

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I04-P01](I04-template-catalog-and-admin-templates.md#i04-p01) Inherited item hard gates: [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Can run in parallel with: [I04-P02](I04-template-catalog-and-admin-templates.md#i04-p02); [I04-P04](I04-template-catalog-and-admin-templates.md#i04-p04) once each task's prerequisites are accepted.

**Purpose:** Let guests choose an available curated starting design.

**Scope:** Typed API/query access, catalog/detail, presets/USD display, loading/empty/error and clear create entry.

**Expected areas/files/modules:** Frontend Templates feature, public route composition and shared DS. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Contract fixtures may support early UI only after P01 review; live create still rechecks backend availability.

**Acceptance criteria:**

- [ ] Active designs and curated choices are understandable.
- [ ] Empty/error/retry states are distinct.
- [ ] Both languages/themes and keyboard/mobile layouts work.

**Tests required:** Testing Library query/state tests; public browser catalog journey.

**Out of scope:** Blog dependency or actual Project creation before I05.

**Review focus:** Public cache versus authoritative create check.

---

<a id="i04-p04"></a>

### I04-P04 — Admin Template management experience

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I04-P02](I04-template-catalog-and-admin-templates.md#i04-p02) Inherited item hard gates: [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Can run in parallel with: [I04-P03](I04-template-catalog-and-admin-templates.md#i04-p03) once each task's prerequisites are accepted.

**Purpose:** Own a real operational editing workflow.

**Scope:** Accessible revision/availability forms, reason input, conflict feedback and publication review.

**Expected areas/files/modules:** Frontend Admin/Templates composition and generated API integration. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Show ordinary Admin permissions only; errors preserve entered data and observed version.

**Acceptance criteria:**

- [ ] Admin can create/publish/change availability.
- [ ] Invalid price/preset/translation fields are explained.
- [ ] Conflict refresh never overwrites a reviewed revision silently.

**Tests required:** Component form/conflict tests and synthetic Admin browser flow.

**Out of scope:** Broad private content management.

**Review focus:** Operational clarity and audit intent.

---

<a id="i04-p05"></a>

### I04-P05 — Catalog revision and baseline integration proof

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I04-P01](I04-template-catalog-and-admin-templates.md#i04-p01); [I04-P02](I04-template-catalog-and-admin-templates.md#i04-p02); [I04-P03](I04-template-catalog-and-admin-templates.md#i04-p03); [I04-P04](I04-template-catalog-and-admin-templates.md#i04-p04) Inherited item hard gates: [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Verify future availability does not destroy historical work.

**Scope:** Real PostgreSQL publication/availability tests and frontend contract/state checks; captured-baseline fixtures from I01.

**Expected areas/files/modules:** Templates integration tests and catalog acceptance evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** T02/T03 final Project behavior is repeated at I05; schema fixtures here do not claim I05 complete.

**Acceptance criteria:**

- [ ] Inactive selection returns safe failure.
- [ ] Published revision fields never mutate.
- [ ] Catalog changes leave captured baseline fixture values intact.

**Tests required:** T02/T03-focused DB/API tests and T21 visual/keyboard checks.

**Out of scope:** Project lifecycle implementation.

**Review focus:** Immutable revision evidence and cache behavior.

## Integration / Merge Order

P01 DTO/domain review merges first. P02 implements publication/availability; P03 and P04 integrate reviewed public/Admin contracts in parallel. P05 proves publication/baseline protection across the whole slice.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Inactive new Project blocked; published baseline immutable; Admin audit.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Browse active designs in VI/EN, publish/deactivate through Admin, reject inactive creation and demonstrate stable captured baselines using integration evidence.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Cached catalog availability is not a creation permission. Editing/deactivating a used Template must preserve current Projects' captured design and price; Admin scope is operational, not owner-editor access.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
