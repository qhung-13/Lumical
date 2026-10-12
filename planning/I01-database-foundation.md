# I01 — Database Foundation

## Summary

Initialize PostgreSQL/Prisma and reviewed initial P0 model/constraint migrations.

Current item status: **IN_REVIEW**. I01 implementation and local quality evidence are available on `feature/I01-database-foundation`; LEAD and independent teammate approval remain outstanding. Dependencies and authority references remain unchanged. No task is marked DONE.

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
- Status: IN_REVIEW
- Depends on: [I00](I00-repository-project-foundation.md) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Translate the frozen relational model into an implementable persistence contract.

**Scope:** Map entities, ownership, snapshot roots, uniqueness, indexes and transaction responsibilities; select compatible PostgreSQL/Prisma versions.

**Expected areas/files/modules:** Backend persistence design and dependency review artifacts. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** The explicit I01 implementation request authorizes tooling selection/installation in this execution. PostgreSQL 17.11, Prisma 7.10.0 and pg 8.23.1 are pinned; framework versions are unchanged. Business semantics are unchanged; teammate tooling/privilege review remains pending.

**Acceptance criteria:**

- [x] Each critical protection maps to BR/INV authority.
- [x] ORM-supported and migration-only constraints are distinguished.
- [ ] Versions and least-privilege strategy receive teammate review.

**Tests required:** Review migration/locking capabilities and define blank/upgrade/invariant scenarios.

**Out of scope:** New entities or schema-push deployment.

**Review focus:** INV-01–14 and cross-row limits of CHECK constraints.

---

<a id="i01-p02"></a>

### I01-P02 — Disposable PostgreSQL and migration runner

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I01-P01](I01-database-foundation.md#i01-p01) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I03-P01](I03-early-ar-technology-spike.md#i03-p01); [I03-P02](I03-early-ar-technology-spike.md#i03-p02) once each task's prerequisites are accepted.

**Purpose:** Make database verification isolated and reproducible.

**Scope:** Development/test configuration, migration workflow and separate schema/runtime roles.

**Expected areas/files/modules:** Backend config/platform; future database-only local/test tooling. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Compose now owns isolated PostgreSQL resources and separate migration/runtime roles. Disposable tests use unique names, random credentials, loopback ports and ownership-checked cleanup. Never target another project or participant database.

**Acceptance criteria:**

- [x] Fresh test DB initializes through migrations.
- [x] Runtime principal cannot change schema.
- [x] Cleanup is confined to disposable LumiCal resources.

**Tests required:** Empty database setup, role privilege negatives and isolated cleanup checks.

**Out of scope:** Production data, SQLite or destructive shared cleanup.

**Review focus:** Isolation and least privilege.

---

<a id="i01-p03"></a>

### I01-P03 — Identity, catalog and current-calendar schema

- Owner: LEAD
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I01-P01](I01-database-foundation.md#i01-p01); [I01-P02](I01-database-foundation.md#i01-p02) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I03-P02](I03-early-ar-technology-spike.md#i03-p02) once each task's prerequisites are accepted.

**Purpose:** Persist owned mutable work with stable baselines.

**Scope:** User/session roots, immutable Template revisions, Project/twelve Months/events, Media/AR artifact relationships.

**Expected areas/files/modules:** Backend identity/templates/calendar-projects/media/AR infrastructure; reviewed migrations. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Keep source ownership and baseline immutable; P1 recovery tables absent.

**Acceptance criteria:**

- [x] Owner and normalized email protections exist.
- [x] Month uniqueness/range and valid references are enforced.
- [x] Current media/artifact references preserve ownership and immutable bytes.

**Tests required:** Real PostgreSQL FK/unique/range and rollback tests; application count checks planned.

**Out of scope:** P1/P2 models or a generic document-store snapshot.

**Review focus:** INV-01/02/03/11 and history-safe references.

---

<a id="i01-p04"></a>

### I01-P04 — Commerce and immutable-history schema

- Owner: LEAD
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I01-P03](I01-database-foundation.md#i01-p03) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I03-P03](I03-early-ar-technology-spike.md#i03-p03) once each task's prerequisites are accepted.

**Purpose:** Protect ordered content and one paid settlement durably.

**Scope:** Orders, relational calendar/Month/date/media/AR snapshots, checkout intents, attempts/operations/settlements and fulfillment history.

**Expected areas/files/modules:** Backend Orders/Payments/Fulfillment infrastructure; reviewed migrations. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Quantity 1–10, USD integer cents, zero adjustments; later Project edits cannot rewrite snapshots.

**Acceptance criteria:**

- [x] Snapshots have explicit relational references.
- [x] Settlement uniqueness binds Order/attempt/capture.
- [x] Historical references prohibit normal cascade deletion.

**Tests required:** Real PostgreSQL money/relationship/uniqueness/rollback tests.

**Out of scope:** Provider calls, refunds or payment behavior implementation.

**Review focus:** INV-05/06/10/13/14 and active-attempt coordination.

---

<a id="i01-p05"></a>

### I01-P05 — Access and execution-support persistence

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I01-P04](I01-database-foundation.md#i01-p04) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I03-P03](I03-early-ar-technology-spike.md#i03-p03) once each task's prerequisites are accepted.

**Purpose:** Persist revocable access and reliable provider execution without extra services.

**Scope:** RecipientShare/leases, AdminContentAccess/audit, idempotency outcomes, verified inbox and durable jobs; transaction-context adapter.

**Expected areas/files/modules:** Backend shared platform and Sharing/Admin infrastructure; migrations. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** LEAD reviews ports before adapters; use keyed digests and bounded encrypted replay, not raw bearer fields.

**Acceptance criteria:**

- [x] One current share generation is protected.
- [x] Job/inbox/intent identities are durable.
- [x] Transaction collaborators share one context.

**Tests required:** Real PostgreSQL generation/intent uniqueness, rollback and safe serialization fixtures.

**Out of scope:** Redis, broker or business-provider implementation.

**Review focus:** Secret handling, retention and adapter boundary.

---

<a id="i01-p06"></a>

### I01-P06 — Synthetic seed and fixture conventions

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I01-P03](I01-database-foundation.md#i01-p03); [I01-P04](I01-database-foundation.md#i01-p04); [I01-P05](I01-database-foundation.md#i01-p05) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Give each future feature deterministic owned test data.

**Scope:** Idempotent synthetic catalog/users and isolated fixture factories for pending/Ready media/targets through test adapters.

**Expected areas/files/modules:** Backend seed/fixture infrastructure and test documentation. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Admin provisioning is controlled; no committed usable passwords or participant content; fake provider data stays test-only.

**Acceptance criteria:**

- [x] Repeated seed has a stable result.
- [x] Two-owner fixtures support privacy negatives.
- [x] Synthetic evidence cannot be mistaken for genuine provider acceptance.

**Tests required:** Repeat-seed checks and fixture ownership/readiness assertions.

**Out of scope:** Runtime paid flags or participant data.

**Review focus:** Determinism and no leaked secrets.

---

<a id="i01-p07"></a>

### I01-P07 — Migration and transaction quality gate

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I01-P02](I01-database-foundation.md#i01-p02); [I01-P03](I01-database-foundation.md#i01-p03); [I01-P04](I01-database-foundation.md#i01-p04); [I01-P05](I01-database-foundation.md#i01-p05); [I01-P06](I01-database-foundation.md#i01-p06); [I01-P08](I01-database-foundation.md#i01-p08) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Prove persistence behaviors on the actual target database.

**Scope:** Blank/upgrade migration tests, FK/money/unique failures, transaction rollback and initial concurrency checks in CI.

**Expected areas/files/modules:** Backend database integration tests; future I01 CI verification. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use synchronization barriers for real races; never use mocked Prisma as integrity evidence.

**Acceptance criteria:**

- [x] Blank and upgrade histories pass.
- [x] Key constraints and rollback are exercised.
- [x] Migration and runtime roles remain separate.

**Tests required:** Disposable PostgreSQL integration and concurrency suite, plus static gates.

**Out of scope:** Application feature acceptance or live demo DB tests.

**Review focus:** Database truth beyond typecheck.

---

<a id="i01-p08"></a>

### I01-P08 — Operational configuration and health-contract alignment

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I01-P02](I01-database-foundation.md#i01-p02); [I01-P05](I01-database-foundation.md#i01-p05) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I01-P06](I01-database-foundation.md#i01-p06) once each task's prerequisites are accepted.

**Purpose:** Align technical readiness with the frozen backend API before feature integration.

**Scope:** Validated database/platform config and /api/v1/health/live plus /api/v1/health/ready contract, with safe persistence readiness.

**Expected areas/files/modules:** Backend config/platform and technical health interface. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** LEAD reviews treatment of existing /api/v1/health compatibility; health exposes no secrets and performs no provider side effects.

**Acceptance criteria:**

- [x] Liveness reports process status without private details.
- [x] Readiness returns 503 for missing/unavailable essential persistence/config.
- [x] Configuration fails safely and health fields match API_CONTRACT.

**Tests required:** Supertest liveness/readiness, unavailable test-DB/config and no-secret response tests.

**Out of scope:** Monitoring stack or business/provider probes.

**Review focus:** Technical contract alignment without a second business API.

## Integration / Merge Order

P01 is the review gate. P02 follows it; P03 then P04 then P05 build valid reviewed migration increments. P06 and P08 follow the schema/platform contracts; P07 validates the entire empty/upgrade path after P08. No consumer starts on an unreviewed persistence contract.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [x] Blank/upgrade migration tests, exact-money/FK/unique protections and least-privilege roles.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [x] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Apply all migrations to an empty disposable PostgreSQL database, rerun synthetic seed safely, exercise constraint failures and show dedicated runtime/migration roles.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Conditional uniqueness, checks, restricted grants and finalized-content row guards are explicit SQL alongside the Prisma schema. Cross-row child counts, authorization, provider evidence, readiness and lifecycle transitions remain later application responsibilities. P1/P2 entities are absent. I00's outstanding DS/i18n common gate remains outstanding; this implementation does not claim I00 acceptance.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This execution changes only the authorized I01 foundation and its verification/documentation; frozen authority files remain byte-identical.

## Execution Evidence — 2026-10-12

Implementation followed P01 → P02 → P03 → P04 → P05 → P06 → P08 → P07 on one feature branch. The four reviewed SQL increments preserve current-work, commerce-history, access/execution and privilege boundaries, with atomic PostgreSQL migration transactions. Implementation mappings and future application obligations are in [backend/README.md](../backend/README.md), not a second authority.

| Task | Status | Concrete evidence |
| --- | --- | --- |
| I01-P01 | IN_REVIEW | Pinned compatible tools; BR/INV mapping separates Prisma, SQL and application protections. Teammate review pending. |
| I01-P02 | IN_REVIEW | Disposable PostgreSQL 17.11; blank/repeated setup; runtime schema mutation denied; owned cleanup passes. |
| I01-P03 | IN_REVIEW | Current P0 schema, owner composite FKs, normalized email, Month range/unique, civil-date and finalized-content negative tests. |
| I01-P04 | IN_REVIEW | Relational immutable snapshots, exact BIGINT USD, quantity/zero adjustments/total checks, settlement uniqueness and historical-reference deletion tests. |
| I01-P05 | IN_REVIEW | Scoped share generation/leases, inspection/audit, idempotency, verified inbox/job identities and shared transaction context; real rollback and synchronized checkout race pass. |
| I01-P06 | IN_REVIEW | Repeated Prisma runtime seed yields identical disabled synthetic owners/catalog; Pending/Ready media/artifact factories are TEST ONLY. |
| I01-P07 | IN_REVIEW | Three isolated databases prove blank/repeat/upgrade paths; Prisma diff reports no difference. Local full quality gate passes. |
| I01-P08 | IN_REVIEW | Live 200; ready 200/503 with exact safe bodies for missing/invalid/unreachable DB; actual Compose PostgreSQL outage proves ready 503/live 200. I00 proxy compatibility passes. |

Executed PASS: `pnpm install --frozen-lockfile`, `pnpm peers check`, root typecheck/lint/test/build through `pnpm verify`, 8 backend unit tests, 1 frontend unit test, 4 backend e2e tests, real PostgreSQL integration, blank/repeated/upgrade migration, least-privilege negatives, seed repeatability, live/ready/no-secret checks and production Docker smoke. Jest open-handle diagnosis also passed without reported handles. CI is configured to run the database gate and full Compose smoke; hosted CI has not been executed because nothing was pushed.

All 17 authority files match the pre-execution SHA256 baseline. Prisma and database types stay backend infrastructure-owned; no frontend DB dependency, P1/P2 entity, authentication/business workflow or provider integration was introduced. Test containers and the smoke project's database volume/network were removed; unrelated Docker resources were left intact. HEAD remains `2c3637d`; no commit, push or merge was performed.

Acceptance checkmarks record demonstrated technical evidence, not human approval. LEAD and independent teammate review are still required before DONE or dependent contract acceptance. The inherited I00 common-gate clarification remains visible in the overview.

## Review Fix Evidence — 2026-10-13

The three required review findings are implemented and ready for re-review. I01 and all Pxx remain **IN_REVIEW**; no human approval or DONE status is claimed.

| Finding | Implementation | Executed regression evidence |
| --- | --- | --- |
| Nested independent transactions | Async-local context joins nested `run` calls to the existing Prisma transaction. Only the outer boundary commits/rolls back; no nested savepoints. Finished inherited contexts fail without root-client fallback. | Real PostgreSQL: outer and nested writes both disappear on rollback; successful nested writes commit together; synchronized concurrent chains have distinct contexts and independent outcomes; foreign/finished contexts and delayed descendants are rejected. |
| Premature PostgreSQL health | Compose authenticates `lumical_runtime` over final TCP at 127.0.0.1 and checks schema USAGE/migration ownership. Host setup waits with `docker compose up -d --wait postgres`. | Fresh Compose startup holds the real role initializer behind a signal barrier. The Unix socket is ready while TCP health stays non-healthy, roles are absent, and migration/backend containers remain unstarted. Release permits initialization → health → migrations → backend; migration exit 0, ready 200, frontend proxy 200. |
| Missing runtime SELECT readiness | `SELECT 1 FROM lumical.users LIMIT 0` checks actual schema/table read access without fetching private rows, alongside the existing required-table metadata check. | Real PostgreSQL: normal grants return ready 200; revoked users SELECT or schema USAGE returns ready 503 with exact `{ready:false}` and live 200; grants are restored in `finally` and readiness returns 200 again. Actual database outage also returns ready 503/live 200. |

Final executed PASS: frozen install, peers, root typecheck, lint, unit/e2e tests, both production builds, `pnpm verify`, the complete PostgreSQL integration suite (also run directly with `pnpm test:db`), all new regression cases, `pnpm test:docker` and `git diff --check`. The initial new smoke barrier failed because Compose consumed an unescaped test variable; its escaping was corrected and the complete smoke run then passed. The existing Jest worker-shutdown warning remains non-fatal; no test was disabled or changed to conceal it.

The fix pass changes only transaction/readiness infrastructure, related PostgreSQL/Compose regression tests, startup configuration and the existing developer/evidence documentation. Schema, migrations, dependencies, frozen authority, frontend and I02+ scope remain unchanged. All 17 authority files still match the original SHA256 baseline. Disposable containers, network/volumes and temporary override files are cleaned within their owned run/project scope. Hosted CI and human re-review remain pending; no commit/push/merge was performed.
