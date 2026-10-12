# I01 — Database Foundation

## Summary

Initialize PostgreSQL/Prisma and reviewed initial P0 model/constraint migrations.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M1 — Core Platform

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

LEAD

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

MEMBER_2, MEMBER_3, MEMBER_4. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I00](I00-repository-project-foundation.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I00](I00-repository-project-foundation.md) until their acceptance artifacts are available.
- Blocks: [I02](I02-identity-and-sessions.md), [I04](I04-template-catalog-and-admin-templates.md), [I06](I06-private-media-pipeline.md), [I09](I09-order-snapshot-and-checkout.md) (direct roadmap consumers).
- Can run in parallel with: [I03](I03-early-ar-technology-spike.md) after [I00](I00-repository-project-foundation.md); additional DS work only within accepted [I00](I00-repository-project-foundation.md) scope.

The authoritative dependency row is **I00** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [DATABASE](../docs/DATABASE.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)
- [ADR-002-postgresql-and-prisma](../docs/adr/ADR-002-postgresql-and-prisma.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Initialize PostgreSQL/Prisma and reviewed initial P0 model/constraint migrations. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Empty-DB history.
- disposable test DB.
- synthetic seeds and transaction abstraction.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- SQLite, schema push, production dump/baseline.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

PostgreSQL in dev/test/demo; Prisma only in backend infrastructure. Use reviewed migrations, exact USD minor units, restricted historical references and explicit transaction responsibility for cross-row rules. P1/P2 entities remain dormant.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i01-p01"></a>

### I01-P01 — P0 model, constraints and tooling review

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I00](I00-repository-project-foundation.md) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Translate the frozen relational model into an implementable persistence contract.

**Scope:** Map entities, ownership, snapshot roots, uniqueness, indexes and transaction responsibilities; select compatible PostgreSQL/Prisma versions.

**Expected areas/files/modules:** Backend persistence design and dependency review artifacts. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Resolve the timing clarification before installation; do not redesign business semantics.

**Acceptance criteria:**

- [ ] Each critical protection maps to BR/INV authority.
- [ ] ORM-supported and migration-only constraints are distinguished.
- [ ] Versions and least-privilege strategy receive teammate review.

**Tests required:** Review migration/locking capabilities and define blank/upgrade/invariant scenarios.

**Out of scope:** New entities or schema-push deployment.

**Review focus:** INV-01–14 and cross-row limits of CHECK constraints.

---

<a id="i01-p02"></a>

### I01-P02 — Disposable PostgreSQL and migration runner

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I01-P01](I01-database-foundation.md#i01-p01) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I03-P01](I03-early-ar-technology-spike.md#i03-p01); [I03-P02](I03-early-ar-technology-spike.md#i03-p02) once each task's prerequisites are accepted.

**Purpose:** Make database verification isolated and reproducible.

**Scope:** Development/test configuration, migration workflow and separate schema/runtime roles.

**Expected areas/files/modules:** Backend config/platform; future database-only local/test tooling. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** This is future I01 work, not a change to current Docker. Never target another project or participant database.

**Acceptance criteria:**

- [ ] Fresh test DB initializes through migrations.
- [ ] Runtime principal cannot change schema.
- [ ] Cleanup is confined to disposable LumiCal resources.

**Tests required:** Empty database setup, role privilege negatives and isolated cleanup checks.

**Out of scope:** Production data, SQLite or destructive shared cleanup.

**Review focus:** Isolation and least privilege.

---

<a id="i01-p03"></a>

### I01-P03 — Identity, catalog and current-calendar schema

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I01-P01](I01-database-foundation.md#i01-p01); [I01-P02](I01-database-foundation.md#i01-p02) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I03-P02](I03-early-ar-technology-spike.md#i03-p02) once each task's prerequisites are accepted.

**Purpose:** Persist owned mutable work with stable baselines.

**Scope:** User/session roots, immutable Template revisions, Project/twelve Months/events, Media/AR artifact relationships.

**Expected areas/files/modules:** Backend identity/templates/calendar-projects/media/AR infrastructure; reviewed migrations. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Keep source ownership and baseline immutable; P1 recovery tables absent.

**Acceptance criteria:**

- [ ] Owner and normalized email protections exist.
- [ ] Month uniqueness/range and valid references are enforced.
- [ ] Current media/artifact references preserve ownership and immutable bytes.

**Tests required:** Real PostgreSQL FK/unique/range and rollback tests; application count checks planned.

**Out of scope:** P1/P2 models or a generic document-store snapshot.

**Review focus:** INV-01/02/03/11 and history-safe references.

---

<a id="i01-p04"></a>

### I01-P04 — Commerce and immutable-history schema

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I01-P03](I01-database-foundation.md#i01-p03) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I03-P03](I03-early-ar-technology-spike.md#i03-p03) once each task's prerequisites are accepted.

**Purpose:** Protect ordered content and one paid settlement durably.

**Scope:** Orders, relational calendar/Month/date/media/AR snapshots, checkout intents, attempts/operations/settlements and fulfillment history.

**Expected areas/files/modules:** Backend Orders/Payments/Fulfillment infrastructure; reviewed migrations. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Quantity 1–10, USD integer cents, zero adjustments; later Project edits cannot rewrite snapshots.

**Acceptance criteria:**

- [ ] Snapshots have explicit relational references.
- [ ] Settlement uniqueness binds Order/attempt/capture.
- [ ] Historical references prohibit normal cascade deletion.

**Tests required:** Real PostgreSQL money/relationship/uniqueness/rollback tests.

**Out of scope:** Provider calls, refunds or payment behavior implementation.

**Review focus:** INV-05/06/10/13/14 and active-attempt coordination.

---

<a id="i01-p05"></a>

### I01-P05 — Access and execution-support persistence

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I01-P04](I01-database-foundation.md#i01-p04) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I03-P03](I03-early-ar-technology-spike.md#i03-p03) once each task's prerequisites are accepted.

**Purpose:** Persist revocable access and reliable provider execution without extra services.

**Scope:** RecipientShare/leases, AdminContentAccess/audit, idempotency outcomes, verified inbox and durable jobs; transaction-context adapter.

**Expected areas/files/modules:** Backend shared platform and Sharing/Admin infrastructure; migrations. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** LEAD reviews ports before adapters; use keyed digests and bounded encrypted replay, not raw bearer fields.

**Acceptance criteria:**

- [ ] One current share generation is protected.
- [ ] Job/inbox/intent identities are durable.
- [ ] Transaction collaborators share one context.

**Tests required:** Real PostgreSQL generation/intent uniqueness, rollback and safe serialization fixtures.

**Out of scope:** Redis, broker or business-provider implementation.

**Review focus:** Secret handling, retention and adapter boundary.

---

<a id="i01-p06"></a>

### I01-P06 — Synthetic seed and fixture conventions

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I01-P03](I01-database-foundation.md#i01-p03); [I01-P04](I01-database-foundation.md#i01-p04); [I01-P05](I01-database-foundation.md#i01-p05) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Give each future feature deterministic owned test data.

**Scope:** Idempotent synthetic catalog/users and isolated fixture factories for pending/Ready media/targets through test adapters.

**Expected areas/files/modules:** Backend seed/fixture infrastructure and test documentation. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Admin provisioning is controlled; no committed usable passwords or participant content; fake provider data stays test-only.

**Acceptance criteria:**

- [ ] Repeated seed has a stable result.
- [ ] Two-owner fixtures support privacy negatives.
- [ ] Synthetic evidence cannot be mistaken for genuine provider acceptance.

**Tests required:** Repeat-seed checks and fixture ownership/readiness assertions.

**Out of scope:** Runtime paid flags or participant data.

**Review focus:** Determinism and no leaked secrets.

---

<a id="i01-p07"></a>

### I01-P07 — Migration and transaction quality gate

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I01-P02](I01-database-foundation.md#i01-p02); [I01-P03](I01-database-foundation.md#i01-p03); [I01-P04](I01-database-foundation.md#i01-p04); [I01-P05](I01-database-foundation.md#i01-p05); [I01-P06](I01-database-foundation.md#i01-p06); [I01-P08](I01-database-foundation.md#i01-p08) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Prove persistence behaviors on the actual target database.

**Scope:** Blank/upgrade migration tests, FK/money/unique failures, transaction rollback and initial concurrency checks in CI.

**Expected areas/files/modules:** Backend database integration tests; future I01 CI verification. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use synchronization barriers for real races; never use mocked Prisma as integrity evidence.

**Acceptance criteria:**

- [ ] Blank and upgrade histories pass.
- [ ] Key constraints and rollback are exercised.
- [ ] Migration and runtime roles remain separate.

**Tests required:** Disposable PostgreSQL integration and concurrency suite, plus static gates.

**Out of scope:** Application feature acceptance or live demo DB tests.

**Review focus:** Database truth beyond typecheck.

---

<a id="i01-p08"></a>

### I01-P08 — Operational configuration and health-contract alignment

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I01-P02](I01-database-foundation.md#i01-p02); [I01-P05](I01-database-foundation.md#i01-p05) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I01-P06](I01-database-foundation.md#i01-p06) once each task's prerequisites are accepted.

**Purpose:** Align technical readiness with the frozen backend API before feature integration.

**Scope:** Validated database/platform config and /api/v1/health/live plus /api/v1/health/ready contract, with safe persistence readiness.

**Expected areas/files/modules:** Backend config/platform and technical health interface. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** LEAD reviews treatment of existing /api/v1/health compatibility; health exposes no secrets and performs no provider side effects.

**Acceptance criteria:**

- [ ] Liveness reports process status without private details.
- [ ] Readiness returns 503 for missing/unavailable essential persistence/config.
- [ ] Configuration fails safely and health fields match API_CONTRACT.

**Tests required:** Supertest liveness/readiness, unavailable test-DB/config and no-secret response tests.

**Out of scope:** Monitoring stack or business/provider probes.

**Review focus:** Technical contract alignment without a second business API.

## Integration / Merge Order

P01 is the review gate. P02 follows it; P03 then P04 then P05 build valid reviewed migration increments. P06 and P08 follow the schema/platform contracts; P07 validates the entire empty/upgrade path after P08. No consumer starts on an unreviewed persistence contract.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Blank/upgrade migration tests, exact-money/FK/unique protections and least-privilege roles.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Apply all migrations to an empty disposable PostgreSQL database, rerun synthetic seed safely, exercise constraint failures and show dedicated runtime/migration roles.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Database-specific conditional indexes/locking may exceed Prisma model syntax; verify pinned support before coding. Initial P0 schema must not accidentally include reset/notification/wish/social tables. Tool-pinning timing is flagged in I00.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
