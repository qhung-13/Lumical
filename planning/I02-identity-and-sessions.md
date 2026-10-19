# I02 — Identity & Sessions

## Summary

Register/login/logout, opaque durable sessions, Origin/CSRF, disable/re-enable audit.

Current item status: **IN_REVIEW**. The explicitly requested I02 implementation is complete and verified locally on top of the accepted I01 baseline. LEAD and independent teammate acceptance remain required; no DONE status is claimed.

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
- Status: IN_REVIEW
- Depends on: [I01](I01-database-foundation.md) Inherited item hard gates: [I01](I01-database-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Establish ordinary-user identity without leaking account existence.

**Scope:** Normalization/uniqueness, password hashing and 12–128 limits, generic login rejection and bounded abuse controls.

**Expected areas/files/modules:** Backend Identity domain/application/infrastructure. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Do not alter passwords by trimming/truncation; Admin provisioning stays operator-controlled.

**Acceptance criteria:**

- [x] Case/space email normalization is unique.
- [x] Passwords satisfy policy without arbitrary composition rules.
- [x] Registration cannot assign ADMIN.

**Tests required:** Jest policies and real PostgreSQL/API credential, duplicate-email and role-injection negatives.

**Out of scope:** Recovery, OAuth, verification or email change.

**Review focus:** Password handling and BR-ID-003–009.

---

<a id="i02-p02"></a>

### I02-P02 — Opaque sessions, CSRF and same-origin contract

- Owner: LEAD
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I02-P01](I02-identity-and-sessions.md#i02-p01) Inherited item hard gates: [I01](I01-database-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Define the authoritative account-session HTTP boundary.

**Scope:** Cookie lifecycle/digests, 24h idle/7d absolute expiry, session bootstrap/logout, exact Origin/CSRF, no-store, business API reverse-proxy setup and versioned OpenAPI/error baseline.

**Expected areas/files/modules:** Backend Identity/platform HTTP; same-origin routing configuration; reviewed API/type artifacts. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Cookie Secure/HttpOnly/SameSite/Path/Domain follows ADR-003; loopback exception cannot leak into deployed config. Next never becomes a business backend.

**Acceptance criteria:**

- [x] Logout/expiry revoke server access.
- [x] Unsafe mutations require exact Origin and correct CSRF.
- [x] Browser and SSR use the frozen backend HTTP contract; generated artifacts are submitted for review.

**Tests required:** Supertest cookie/origin/CSRF/no-store and controlled-Clock expiry tests; generated contract check.

**Out of scope:** JWT/localStorage secrets or generic frontend business handlers.

**Review focus:** Trust boundary, transport errors and SSR cookie forwarding.

---

<a id="i02-p03"></a>

### I02-P03 — Audited account suspension and restoration

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I02-P02](I02-identity-and-sessions.md#i02-p02) Inherited item hard gates: [I01](I01-database-foundation.md)
- Can run in parallel with: [I02-P04](I02-identity-and-sessions.md#i02-p04) once each task's prerequisites are accepted.

**Purpose:** Give Admin bounded security operations without editorial powers.

**Scope:** Minimal status query/change, operator reason/audit, revoke all sessions and explicit restoration eligibility.

**Expected areas/files/modules:** Backend Identity use cases and Admin operational interface. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Validate active Admin in use case; suspend access independently of physical cleanup; later Sharing checks active owner.

**Acceptance criteria:**

- [x] Disable invalidates every existing session.
- [x] Re-enable requires audited operator intent.
- [x] No unrelated private profile/content is returned.

**Tests required:** Real PostgreSQL/API session invalidation, non-Admin denial and audit atomicity tests.

**Out of scope:** Admin draft browser or self-service account deletion.

**Review focus:** BR-ID-010/BR-PRV-003 and no automatic secret resurrection.

---

<a id="i02-p04"></a>

### I02-P04 — Typed frontend transport and session bootstrap

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I02-P02](I02-identity-and-sessions.md#i02-p02) Inherited item hard gates: [I01](I01-database-foundation.md)
- Can run in parallel with: [I02-P03](I02-identity-and-sessions.md#i02-p03) once each task's prerequisites are accepted.

**Purpose:** Share the approved API/session behavior across frontend features.

**Scope:** Generated types, credentials/CSRF/error transport, TanStack Query actor scope and safe SSR bootstrap.

**Expected areas/files/modules:** Frontend api/lib; identity hooks; app route composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** All business reads cross HTTP; forward only relevant cookies to trusted backend; clear private caches on account changes.

**Acceptance criteria:**

- [x] No backend secret reaches browser props.
- [x] Session/CSRF stay in correct memory/cookie contexts.
- [x] 401/logout/account changes clear actor-private data.

**Tests required:** Vitest transport/bootstrap/cache tests and SSR contract/no-store checks.

**Out of scope:** Frontend ownership enforcement or persisted auth tokens.

**Review focus:** Typed boundary and private cache isolation.

---

<a id="i02-p05"></a>

### I02-P05 — Registration, login and logout experience

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I02-P04](I02-identity-and-sessions.md#i02-p04) Inherited item hard gates: [I01](I01-database-foundation.md)
- Can run in parallel with: [I02-P03](I02-identity-and-sessions.md#i02-p03) once each task's prerequisites are accepted.

**Purpose:** Make core identity usable in both languages/themes.

**Scope:** Accessible forms, generic failure feedback, pending/retry, disabled-account handling and logout navigation.

**Expected areas/files/modules:** Frontend identity feature and route composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use shared controls/Dialog where applicable; safe nonsecret return navigation only.

**Acceptance criteria:**

- [x] Native keyboard submission and accessible label/error associations pass component checks; manual common-gate review remains pending.
- [x] Failed credentials do not disclose existence.
- [x] Logout removes private data and stale protected UI.

**Tests required:** Testing Library form/cache tests and synthetic browser auth journey.

**Out of scope:** P1 recovery screens or fake session scaffolding.

**Review focus:** Usable failures and backend-authoritative outcomes.

---

<a id="i02-p06"></a>

### I02-P06 — Identity security and role-boundary proof

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I02-P01](I02-identity-and-sessions.md#i02-p01); [I02-P02](I02-identity-and-sessions.md#i02-p02); [I02-P03](I02-identity-and-sessions.md#i02-p03); [I02-P04](I02-identity-and-sessions.md#i02-p04); [I02-P05](I02-identity-and-sessions.md#i02-p05) Inherited item hard gates: [I01](I01-database-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Verify session protection before features depend on identity.

**Scope:** Expiry/logout/disable races, role injection, CSRF/origin rejection, cookie flags and redacted errors/logs.

**Expected areas/files/modules:** Backend security/API tests; frontend integration tests. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** T22 scenarios use actual durable sessions, controlled Clock and two actors.

**Acceptance criteria:**

- [x] Old sessions never regain access.
- [x] Admin/user/recipient contexts cannot be mixed.
- [x] Cookie and CSRF protection is proven across routing.

**Tests required:** Supertest plus PostgreSQL negative/race cases, browser logout/cache checks and static gates.

**Out of scope:** Enterprise penetration-test program.

**Review focus:** Boundary evidence and safe denial.

## Integration / Merge Order

P01 precedes P02; P03 and P04 follow P02 and can overlap; P05 follows P04. P06 validates P01–P05. LEAD reviews cookie/origin/routing decisions before UI integration.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [x] Session expiry/logout/disable, unique email, cross-actor rejection and cookie tests.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [x] Required typecheck, lint, tests and build pass; identity API/DB/transport/UI checks pass at the required layers. Manual visual/common-gate acceptance remains pending.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Register/login/logout, prove an old cookie fails, disable/re-enable with reason/audit and show safe account bootstrap and generic login errors.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Same-origin business API routing is not established by the health-only Next route; explicitly review technical routing before cookie integration. Account disable must suspend later recipient access without destroying Order history.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This execution changes the authorized I02 implementation and evidence only. Frozen authority and accepted I01 migrations remain unchanged.

## Execution evidence — 2026-10-13

All P01–P06 are **IN_REVIEW**. Owner/reviewer/dependency assignments above remain intact. The implementation request explicitly authorized complete I02 on the accepted I01 baseline; this evidence does not rewrite I01 or waive the recorded I00 shared Design System acceptance gap.

| Task | Evidence submitted for review |
| --- | --- |
| P01 | Pure normalization/12–128 Unicode-character policies; unchanged passphrases; stable Node scrypt with salted hashes; generic login failure; bounded, configurable per-process abuse protection; public role injection rejected. |
| P02 | Random opaque cookies; keyed session/CSRF digests; controlled 24h idle/7d absolute expiry; throttled activity; durable logout; exact Origin/CSRF; separate gateway and development HTTP rewrites; Nest OpenAPI and derived frontend types. |
| P03 | Minimal audited Admin status read/change; atomic status/session/share-security metadata/audit; explicit restoration; immutable history preserved; idempotent replay before stale ETag rejection. |
| P04 | One typed HTTP transport; safe runtime projections; account-scoped TanStack Query; private-cache cancellation/removal; late-response and external-cookie-switch guards; safe no-store SSR with only the relevant cookie forwarded. |
| P05 | Registration/login/account/logout pages; feature-owned native forms using frozen token mappings while shared I00 primitives/fonts remain unavailable; VI/EN, system/light/dark, accessible labels/errors, pending/retry and truthful unavailable states. No parallel UI kit or recovery links. |
| P06 | Real PostgreSQL lifecycle/role/privacy/audit tests and controlled races; production gateway auth/cookies/private SSR; old cookies fail after logout, disable and re-enable. |

Initial implementation verification PASS: frozen install, peers, root typecheck/lint/test/build, `pnpm verify`, `pnpm test:db`, `pnpm test:docker`, contract generation/drift checks, gateway routing test and `git diff --check`. Initial counts: 22 backend unit tests, 12 frontend tests, 4 backend health e2e tests, all 18 I01 PostgreSQL groups and all 19 I02 identity/security groups. Nest HTTP integration uses actual durable sessions and disposable PostgreSQL; no mocked Prisma or SQLite proves integrity. The security-review fix results below supersede these counts.

Controlled barriers cover equivalent registration, login versus disable and protected requests versus disable/logout. Parallel requests additionally cover same-intent replay, concurrent activity and repeated Admin disable. Raw row-lock serialization/deadlock errors are retried as complete root database operations, preserving I01 nested joins. Real revoked audit INSERT privilege proves rollback of status, session revocations and idempotency outcome.

The first race run exposed raw PostgreSQL serialization error handling and was fixed. The first lint run rejected preference initialization inside an effect; safe SSR preference props fixed it. One verification run hit a Vitest worker-start timeout during concurrent Docker image builds; the full checks passed when run sequentially with every test and assertion retained. Swagger's optional telemetry postinstall is explicitly denied by the dependency build policy.

Docker evidence proves delayed fresh initialization, successful migration gating, actual gateway registration/session/logout, deployed cookie flags, Origin rejection, private SSR no-store, absence of raw cookie/CSRF in HTML, anonymous/account cache separation and database outage ready 503/live 200. Test-owned containers, networks and volumes were removed; image/build caches remain. OnHandBI was untouched. HTTP smoke simulates the trusted HTTPS Origin; deployed browser traffic still requires HTTPS termination. No actual browser/device or hosted CI execution is claimed.

All 17 authority files and all five I01 migration artifacts retain their initial SHA256 hashes; no new migration or P1/P2 entity exists. No OAuth/JWT/localStorage auth, recipient flow or historical-source dependency was added. Registration replay holds only an encrypted original session delivery for at most 24h and refuses expired/revoked replay. Rate limiting is intentionally process-local; the initial shared gateway-source defect is corrected in the security-review evidence below. These policies and configuration are documented in the developer READMEs.

Human LEAD/independent review, shared I00 fonts/primitives/common-gate acceptance and manual visual/keyboard/zoom checks remain recorded follow-up. No I02 task is DONE. No commit, push, merge, branch switch or reset was performed.

## Security review fixes — 2026-10-13

The three required findings are resolved in the uncommitted working tree and submitted for re-review. I02 and P01–P06 remain **IN_REVIEW**. No optional follow-up or unrelated feature was implemented.

- Source isolation: the gateway removes inbound forwarding/client-address metadata and supplies its accepted socket address. Backend proxy trust defaults to empty and accepts only configured exact immediate-peer IPs, never arbitrary chains/CIDRs/wildcards. IPv4 and mapped IPv6 share canonical rate keys; normalized-email limits remain independent. Compose fixes the gateway IP outside its dynamic allocation pool. Smoke selects an unused Docker subnet without changing existing networks. Deployment requires preserving client socket addresses through HTTPS termination; an additional HTTP proxy that aggregates sockets is not the supported topology.
- Text validation: NUL and lone high/low surrogates in email or Admin reasons return 422 field errors before hashing/security writes. Real PostgreSQL assertions prove no new malformed account, status/session/idempotency/audit mutation. Valid Unicode email/reason and decomposed characters remain unchanged. Native hashing distinguishes the exact Unicode password from trimmed or NFC-normalized alternatives.
- Parser errors: recognized `entity.too.large` exceptions, including declared-length and streamed `received` cases, return safe 413 `VALIDATION_FAILED`, `retryable:false`. Malformed JSON remains 422; unrelated and incomplete parser-lookalike exceptions remain 500. Nest OpenAPI and derived frontend types document 413.

Targeted regressions passed first: 32 tests across credential/security/address/parser suites, gateway routing, and 23 real PostgreSQL identity groups. The exact prior two-source reproduction now returns 422 for all 49 malformed requests and 200 for the other source's valid login. Exhausting A with well-formed requests returns 429 for A while B still logs in with 200; forged forwarding headers cannot select another identity. Direct access ignores spoofed addresses by default and from untrusted peers under explicit configuration. Email limiting rejects the same normalized address independently across sources.

Final local gates PASS: frozen install, peers, typecheck, lint, test, build, `pnpm verify`, `pnpm test:db`, `pnpm test:identity`, `pnpm test:docker`, contract generation/check, gateway routing and `git diff --check`. Counts are now 40 backend unit/HTTP tests, 12 frontend tests, four health e2e tests, 18 I01 database groups and 23 I02 groups. An additional native-hash probe admitted 18 of 20 simultaneous requests and rejected two with 429, preserving the two-active/sixteen-waiting bound.

Initial targeted build and contract generation exposed the ES2023 type library's missing declaration for Node 24 `isWellFormed`; a specific ES2024 string-library reference fixed it without changing password semantics or emitted-code target. Initial Docker smoke exposed another service acquiring the fixed gateway IP; separating the dynamic IP pool fixed clean startup. The final actual Compose smoke exhausted 50 frontend-container source attempts, rejected its next attempt, and still accepted a valid host-source login through that same gateway. Production cookies/private SSR, delayed initialization/migration gating, database outage and owned-resource cleanup also passed. No actual HTTPS browser journey, manual visual/common-gate acceptance or hosted CI execution is claimed.

All 17 frozen authority files and five accepted I01 migration artifacts retain their original SHA256 hashes. No new migration, I01 transaction change, P1/P2, JWT/OAuth/recovery, frontend database access or historical-source dependency. All changes remain uncommitted; no push or branch operation occurred.
