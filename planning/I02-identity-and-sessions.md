# I02 — Identity & Sessions

## Summary

Register/login/logout, opaque durable sessions, Origin/CSRF, disable/re-enable audit.

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

- Hard dependencies: [I01](I01-database-foundation.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I01](I01-database-foundation.md) until their acceptance artifacts are available.
- Blocks: [I04](I04-template-catalog-and-admin-templates.md), [I05](I05-calendar-project-twelve-months.md), [I06](I06-private-media-pipeline.md), [I09](I09-order-snapshot-and-checkout.md) (direct roadmap consumers).
- Can run in parallel with: [I03](I03-early-ar-technology-spike.md); after [I02](I02-identity-and-sessions.md) acceptance, [I04](I04-template-catalog-and-admin-templates.md) and [I06](I06-private-media-pipeline.md) become parallel tracks.

The authoritative dependency row is **I01** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [DATABASE](../docs/DATABASE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)
- [ADR-003-authentication-session-model](../docs/adr/ADR-003-authentication-session-model.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Register/login/logout, opaque durable sessions, Origin/CSRF, disable/re-enable audit. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Identity API/UX and ownership principal checks.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Recovery/email verification/OAuth/account self-delete.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

BR-ID-001–010 except P1 recovery; opaque revocable cookies, exact Origin and synchronizer CSRF, active-account checks on every call, independent recipient principal later. Passwords 12–128 characters; no public Admin assignment.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i02-p01"></a>

### I02-P01 — Credential and registration policies

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I01](I01-database-foundation.md) Inherited item hard gates: [I01](I01-database-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Establish ordinary-user identity without leaking account existence.

**Scope:** Normalization/uniqueness, password hashing and 12–128 limits, generic login rejection and bounded abuse controls.

**Expected areas/files/modules:** Backend Identity domain/application/infrastructure. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Do not alter passwords by trimming/truncation; Admin provisioning stays operator-controlled.

**Acceptance criteria:**

- [ ] Case/space email normalization is unique.
- [ ] Passwords satisfy policy without arbitrary composition rules.
- [ ] Registration cannot assign ADMIN.

**Tests required:** Jest policies and real PostgreSQL/API credential, duplicate-email and role-injection negatives.

**Out of scope:** Recovery, OAuth, verification or email change.

**Review focus:** Password handling and BR-ID-003–009.

---

<a id="i02-p02"></a>

### I02-P02 — Opaque sessions, CSRF and same-origin contract

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I02-P01](I02-identity-and-sessions.md#i02-p01) Inherited item hard gates: [I01](I01-database-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Define the authoritative account-session HTTP boundary.

**Scope:** Cookie lifecycle/digests, 24h idle/7d absolute expiry, session bootstrap/logout, exact Origin/CSRF, no-store, business API reverse-proxy setup and versioned OpenAPI/error baseline.

**Expected areas/files/modules:** Backend Identity/platform HTTP; same-origin routing configuration; reviewed API/type artifacts. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Cookie Secure/HttpOnly/SameSite/Path/Domain follows ADR-003; loopback exception cannot leak into deployed config. Next never becomes a business backend.

**Acceptance criteria:**

- [ ] Logout/expiry revoke server access.
- [ ] Unsafe mutations require exact Origin and correct CSRF.
- [ ] Browser and SSR use reviewed backend HTTP contracts.

**Tests required:** Supertest cookie/origin/CSRF/no-store and controlled-Clock expiry tests; generated contract check.

**Out of scope:** JWT/localStorage secrets or generic frontend business handlers.

**Review focus:** Trust boundary, transport errors and SSR cookie forwarding.

---

<a id="i02-p03"></a>

### I02-P03 — Audited account suspension and restoration

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I02-P02](I02-identity-and-sessions.md#i02-p02) Inherited item hard gates: [I01](I01-database-foundation.md)
- Can run in parallel with: [I02-P04](I02-identity-and-sessions.md#i02-p04) once each task's prerequisites are accepted.

**Purpose:** Give Admin bounded security operations without editorial powers.

**Scope:** Minimal status query/change, operator reason/audit, revoke all sessions and explicit restoration eligibility.

**Expected areas/files/modules:** Backend Identity use cases and Admin operational interface. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Validate active Admin in use case; suspend access independently of physical cleanup; later Sharing checks active owner.

**Acceptance criteria:**

- [ ] Disable invalidates every existing session.
- [ ] Re-enable requires audited operator intent.
- [ ] No unrelated private profile/content is returned.

**Tests required:** Real PostgreSQL/API session invalidation, non-Admin denial and audit atomicity tests.

**Out of scope:** Admin draft browser or self-service account deletion.

**Review focus:** BR-ID-010/BR-PRV-003 and no automatic secret resurrection.

---

<a id="i02-p04"></a>

### I02-P04 — Typed frontend transport and session bootstrap

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I02-P02](I02-identity-and-sessions.md#i02-p02) Inherited item hard gates: [I01](I01-database-foundation.md)
- Can run in parallel with: [I02-P03](I02-identity-and-sessions.md#i02-p03) once each task's prerequisites are accepted.

**Purpose:** Share the approved API/session behavior across frontend features.

**Scope:** Generated types, credentials/CSRF/error transport, TanStack Query actor scope and safe SSR bootstrap.

**Expected areas/files/modules:** Frontend api/lib; identity hooks; app route composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** All business reads cross HTTP; forward only relevant cookies to trusted backend; clear private caches on account changes.

**Acceptance criteria:**

- [ ] No backend secret reaches browser props.
- [ ] Session/CSRF stay in correct memory/cookie contexts.
- [ ] 401/logout/account changes clear actor-private data.

**Tests required:** Vitest transport/bootstrap/cache tests and SSR contract/no-store checks.

**Out of scope:** Frontend ownership enforcement or persisted auth tokens.

**Review focus:** Typed boundary and private cache isolation.

---

<a id="i02-p05"></a>

### I02-P05 — Registration, login and logout experience

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I02-P04](I02-identity-and-sessions.md#i02-p04) Inherited item hard gates: [I01](I01-database-foundation.md)
- Can run in parallel with: [I02-P03](I02-identity-and-sessions.md#i02-p03) once each task's prerequisites are accepted.

**Purpose:** Make core identity usable in both languages/themes.

**Scope:** Accessible forms, generic failure feedback, pending/retry, disabled-account handling and logout navigation.

**Expected areas/files/modules:** Frontend identity feature and route composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use shared controls/Dialog where applicable; safe nonsecret return navigation only.

**Acceptance criteria:**

- [ ] Keyboard and error associations work.
- [ ] Failed credentials do not disclose existence.
- [ ] Logout removes private data and stale protected UI.

**Tests required:** Testing Library form/cache tests and synthetic browser auth journey.

**Out of scope:** P1 recovery screens or fake session scaffolding.

**Review focus:** Usable failures and backend-authoritative outcomes.

---

<a id="i02-p06"></a>

### I02-P06 — Identity security and role-boundary proof

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I02-P01](I02-identity-and-sessions.md#i02-p01); [I02-P02](I02-identity-and-sessions.md#i02-p02); [I02-P03](I02-identity-and-sessions.md#i02-p03); [I02-P04](I02-identity-and-sessions.md#i02-p04); [I02-P05](I02-identity-and-sessions.md#i02-p05) Inherited item hard gates: [I01](I01-database-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Verify session protection before features depend on identity.

**Scope:** Expiry/logout/disable races, role injection, CSRF/origin rejection, cookie flags and redacted errors/logs.

**Expected areas/files/modules:** Backend security/API tests; frontend integration tests. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** T22 scenarios use actual durable sessions, controlled Clock and two actors.

**Acceptance criteria:**

- [ ] Old sessions never regain access.
- [ ] Admin/user/recipient contexts cannot be mixed.
- [ ] Cookie and CSRF protection is proven across routing.

**Tests required:** Supertest plus PostgreSQL negative/race cases, browser logout/cache checks and static gates.

**Out of scope:** Enterprise penetration-test program.

**Review focus:** Boundary evidence and safe denial.

## Integration / Merge Order

P01 precedes P02; P03 and P04 follow P02 and can overlap; P05 follows P04. P06 validates P01–P05. LEAD reviews cookie/origin/routing decisions before UI integration.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Session expiry/logout/disable, unique email, cross-actor rejection and cookie tests.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Register/login/logout, prove an old cookie fails, disable/re-enable with reason/audit and show safe account bootstrap and generic login errors.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Same-origin business API routing is not established by the health-only Next route; explicitly review technical routing before cookie integration. Account disable must suspend later recipient access without destroying Order history.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
