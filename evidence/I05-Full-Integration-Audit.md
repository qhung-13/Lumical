# I05 Full Integration Audit — 2026-11-09

Historical first-audit snapshot. The subsequent hardening branch, D01/D02 proposals, additional focus/New Year regressions and current verification are recorded in [I05 Hardening Final Verification](I05-Hardening-Final-Verification.md). Counts/verdict below describe the first audit, not a later milestone approval.

**Verdict: REQUEST CHANGES — Lead decisions D01/D02 remain open.** All six merged slices have been reviewed; this is not a milestone DONE declaration. Scope is I05 Calendar Project / Twelve Months, with I02/I04 dependency regression and I07/I09 boundaries. No Studio, media pipeline, checkout, payment or AR implementation is included.

## 1. Repository and authority baseline

- Branch `dev`; HEAD `1a3a094c8d0e7e7c6c4dd383745f5949cafee459` (`Merge pull request #40 ... I05-P06`). No branch switch, commit, push, fetch, PR creation or merge during this audit.
- Initial tracked working tree was clean. Existing untracked patch files, deployment scripts, DBML and deployment evidence were left untouched (manifest in §10).
- No `AGENTS.md` or `CLAUDE.md` found in the repository. Reviewed `docs/DEV_WORKFLOW.md`, root/package scripts and README conventions.
- Authorities read: `planning/I05-calendar-project-twelve-months.md`; `docs/PRODUCT_SCOPE.md` R02; `BUSINESS_RULES.md` R03; `API_CONTRACT.md`, `ARCHITECTURE.md`, `DATABASE.md`, backend/frontend standards, testing strategy and workflow R04; `DESIGN_SYSTEM.md` v2; ADR-001/002/003, relevant ADR-004/005 boundaries; I02/I04/I07 plans, I04 decisions and acceptance closure. These remain unchanged. Lower-level evidence is not business-rule approval.
- Implementation read: all CalendarProjects domain/application/interface/infrastructure/module files and tests; Prisma schema and seven migrations; transaction context; Identity active-account/session/CSRF/configuration/cache boundaries; Template publication/catalog/revision ports; project API/generated types; creation/detail/draft/copy/CSS/routes; shared Dialog/Button; all I05 Vitest/Playwright and DB scripts; P06 evidence. I02/I04 regression suites were executed as dependencies.

| Slice | Implementation commit(s) / merge | Actual integration |
| --- | --- | --- |
| P01 | `23cb115` / `e3df45d` (#33) | Present: pure identity/owner/lifecycle/version policies and tests. |
| P02 | `0cd2a0f` / `f1f7c03` (#34) | Present: atomic captured baseline, twelve Months, intent binding, concurrency/rollback tests. |
| P03 | `02e1834`, `ed6888e` / `c7af6aa` (#35) | Present: REST, lifecycle, safe original-result replay, stale/concurrent mutations. |
| P04 | `19628da`, `0e48a21`, `84dd058` / `c56a1fd` (#36) | Present: typed create/reopen, actor cache, preserved unresolved intent, inactive-template retry. |
| P05 | `a01a5ed` / `24e1109` (#37) | Present: twelve tabs, summaries, confirmation/lifecycle UI. |
| P06 | `5194460` / `1a3a094` (#40) | Present: two added REST groups and implementation report. Claimed `docs/verification/I05-P06.md` is absent. |

The plan's original TODO boxes have not been rewritten as approvals. Git integration and acceptance are different evidence.

## 2. Findings and remediation

Line numbers below refer to the resulting working tree; for removed code, the root cause is described explicitly.

| ID / severity | File:line | Evidence and impact | Fix / status |
| --- | --- | --- | --- |
| F01 MAJOR | `frontend/src/features/calendar-projects/project-detail.tsx:30`; shared `dialog.tsx` | No pending guard existed: confirmation closed immediately and all lifecycle triggers remained available. New deferred-request test failed before fix (`i05-audit-before-fix.log`). User could send overlapping archive/restore/delete against one displayed version. Backend still prevented lost updates. | Synchronous ref guard plus pending state spans mutation and refresh; all lifecycle triggers/confirmations disabled, and mutation readiness checked. Regression PASS. **RESOLVED**. |
| F02 MAJOR | `frontend/src/features/calendar-projects/workspace-draft.ts:34`; `project-workspace.tsx:24` | Identity listener belonged to the route effect and unsubscribed on unmount, while the global draft outlived the route. Reproduce: enter private title, unmount workspace, logout through the same manager, read draft → old title. Test failed before fix (`i05-audit-draft-before-fix.log`). Same-actor re-login could resurrect a draft/intent that should have been cleared; no cross-owner API access was demonstrated. | Draft store observes the identity manager across route unmount; clears on confirmed logout or changed authenticated actor, keeps drafts during transient loading/unavailable states. Existing account-switch/preset/retry tests and offscreen-logout regression PASS. **RESOLVED**. |
| F03 MAJOR | `backend/src/config/configure-app.ts:24` | Configured credentialed CORS omitted PATCH. Real OPTIONS test returned methods without PATCH (`i05-audit-cors-before-fix.log`), blocking browser PATCH from an explicitly allowed separate-port origin. | Added PATCH to existing method allowlist, preserving exact-origin/CSRF checks. REST regression PASS. **RESOLVED**. |
| F04 MINOR | `frontend/src/api/projects.ts:29,117` | Runtime validators accepted version 0/negative, year 0/10000 and invalid date strings. Seven new transport tests failed before fix (`i05-audit-runtime-validation-before.log`), allowing malformed persisted responses and unusable If-Match values into cache/UI. | Require positive safe root versions, Gregorian storage year range and parseable timestamps. Twelve project transport tests PASS. **RESOLVED**. |
| F05 MINOR | `backend/scripts/export-openapi.mjs:14` | Windows CRLF checkout failed strict byte comparison. Direct regenerated-document probe: `exact:false, afterCRLF:true`; no semantic contract drift. | Normalize CRLF only, as frontend contract checker already does. Backend and generated frontend checks PASS. **RESOLVED**. |
| F06 MINOR | `backend/scripts/test-project-rest.mjs:362` | In the second race, an archive winner preserves the first race winner's title (`Race A/B`), but the old assertion expected the pre-first-race `Race calendar`. This is an incorrect legal-interleaving oracle; no production lost update established. | Compare to the first race's persisted `stored.title`; retain exact state/title/version assertions and `[200,412]`. No assertion removed. **RESOLVED**. |
| F07 MINOR | `evidence/I05-P06-Implementation-Report.md:9` | Actual commit changes script + evidence report; claimed verification document and I07 handoff were absent. Prior future-year case created two years simultaneously rather than advancing a Clock. | Corrected report manifest/references, retained historical supplied 11/11 provenance, added this consolidated matrix/I07 handoff and controlled API Clock scenario. **RESOLVED**. |
| F08 MAJOR / D02 | `backend/src/modules/calendar-projects/infrastructure/prisma-project-creation.ts:48` | P02 (`git show 0cd2a0f:...`) persisted resource ID without safeResult. Current reader requires full stored outcome. Disposable DB characterization replaces safe_result with NULL → replay 500, original Project remains, no duplicate. | **OPEN — DECISION REQUIRED.** No approved data backfill/rollout policy. Cannot recover original edited/deleted outcome from current Project. Keep fail-closed behavior; do not erase intent/recreate Project. |
| F09 MAJOR / D01 | `docs/API_CONTRACT.md:92`; `backend/src/modules/calendar-projects/interface/dto.ts` | Approved Project shape includes ordered Months, personal events, current AR and readiness. Actual DTO exposes identity/state/baseline/version/timestamps; Months are separate and I07/I08 fields absent. OpenAPI/generated types agree with implementation, not with that broad authority row. No staged-boundary approval located. | **OPEN — DECISION REQUIRED.** Lead/API owner must explicitly approve the I05 staged projection or authorize a reviewed contract/scope change. No speculative API expansion or approved baseline edit made. |

No confirmed BLOCKER (unauthorized access, data loss or invariant corruption) was found in the reviewed I05 paths. This is bounded by the executed scenarios, not a claim of exhaustive security proof.

## 3. Prior risk register

| Requested risk | Audit result |
| --- | --- |
| Duplicate lifecycle submissions | F01 confirmed and fixed. |
| 412 checks refreshed version/state | Existing UI already refetched correctly; old mocked browser fixture never advanced its authoritative state. Added component test and changed fixture to ARCHIVED/v2, asserting explicit restore with refreshed If-Match. Live independent writer also yields actual 412 then restore at v4 → v5. **RESOLVED**. |
| Controlled Clock year advance | Already existed at policy/unit level and P02 creation-year retry boundary. P06's added future-year test alone was insufficient. Added actual REST/DB Clock 2026→2027, renew expired session, read/edit old Project, replay old intent, reject a new old-year intent. **RESOLVED**. |
| Live frontend→backend→PostgreSQL | New five-case live Chromium suite passes; separate from mocked browser suites. **RESOLVED within I05**. |
| Legacy idempotency | F08/D02, open. |
| Project DTO vs approved contract | F09/D01, open. |
| I07 child/version handoff | Documented in §8; no future child endpoints implemented. **RESOLVED as handoff**. |
| P06 manifest and acceptance claims | F07 corrected; original 11/11 remains historical suite evidence only. **RESOLVED**. |

## 4. Requirement traceability / acceptance matrix

PASS means evidenced behavior in I05 scope. PARTIAL identifies an approval/rollout/usability gate still open; UNVERIFIED is not a failed functional test.

| Requirement | Evidence | Result |
| --- | --- | --- |
| P01 identity/owner/lifecycle/delete policies | Project domain/contracts unit suites, REST owner negatives and cancelled Order fixture | PASS |
| P02 active publication, atomic baseline + exact 12, rollback/retry | `test-project-creation.mjs`: seven PostgreSQL groups, real lock waits, injected Month/commit failures, Unicode upgrade | PASS for current intents; PARTIAL overall due D02 |
| P03 all eight endpoint families, safe 404, CSRF, ETag 428/412, transaction DELETE | REST suite, PATCH CORS regression, live ownership/lifecycle | PASS runtime; PARTIAL overall due D01/D02 |
| P04 catalog/detail/login/create/list/reopen, unchanged retry body/key, account boundary | Workspace/API Vitest, mocked browser flow and real response-loss replay after deactivation; offscreen logout regression | PASS in implemented scope |
| P05 twelve Months, read-only archive, dialogs, keyboard, server eligibility | Component tests, lifecycle browser suite, live four VI/EN × theme checks at 320px with axe | PASS automated; PARTIAL common visual/manual gate |
| P06 isolation, baseline survival, stale/races/year/history, child contract and API/UI outcomes | DB suites, controlled API Clock, live journey, §8 | PARTIAL: D01/D02 and manual acceptance remain |
| BR-PRJ-001; INV-01/03; T01 | Non-null/composite owner constraints, SQL owner scope, active account port, cross-owner negatives for read/months/PATCH/archive/restore/delete | PASS |
| BR-PRJ-002 | Grapheme/NFC/name rules, current..+2 only at creation, backend calendar zone, controlled year advance and replay | PASS backend; browser checks executed at audit date (see §7 year-boundary limitation) |
| BR-PRJ-003; INV-02; T04 Project portion | Exactly ordered 1..12, month unique/range constraints, atomic insert, failure rollback, independent Projects | PASS; Order snapshot acceptance remains I09 |
| BR-PRJ-004 | WORKING initial/private; only WORKING/ARCHIVED enums, no Paid/Ordered Project state | PASS |
| BR-PRJ-005 | Archived PATCH 409, read works, restore/repeats/version protections; no share mutations on transitions | PASS within I05; actual Sharing remains its milestone |
| BR-PRJ-006; INV-14; T24 | Transaction history check + restricted FKs; CANCELLED Order refuses deletion; working edit preserves Order row; owned Media stays after never-ordered deletion | PASS I05/schema fixture; end-to-end order placement/retention belongs I09/I06 |
| BR-PRJ-007 | Identity/style edits with current root version, no year/owner patch, captured preset membership, ordered Working still editable | PASS |
| INV-11; BR-TPL-001–003; T02/T03 | Active complete revision query/SHARE lock; immutable revision permissions; captured copy/price survives publish/deactivate; current Project still editable | PASS |
| Idempotent original creation outcome | Current safe-result records replay after edit/archive/delete; same key/body no duplicate and changed body conflicts; real concurrent creation/retry | PASS current records; FAIL legacy NULL outcome compatibility (D02) |
| Architecture/ADR boundary | Interface/application/domain/infrastructure; same serializable context, root lock/version; no frontend ORM, no provider network calls in DB locks | PASS for I05 reviewed code; D01 contract authority unresolved |
| Common Design System gate | VI/EN, themes, 320px, keyboard/tab/dialog and axe automated coverage | PARTIAL: manual assistive technology/200% browser toolbar zoom not executed |

## 5. Actual execution and reproducibility

Environment: Windows PowerShell; Node `v24.21.0`; installed pnpm `11.22.0`; PostgreSQL image `postgres:17.11-bookworm`; Docker Desktop Linux engine. Existing application environment files were not used as a test target. DB harness creates run-labelled tmpfs containers with random roles/passwords/ports and verifies ownership before removing only its own container. No shared/production DB access.

Initial Corepack registry lookup failed DNS, but the installed `pnpm` executable worked. Initial sandbox Jest failed `EACCES` on loopback; affected tests were rerun with local execution permissions. The installed Nest dependency contains a VS Code Console Ninja build hook: an initial DB run exited 0 after only seven REST groups, and an initial OpenAPI process stayed alive emitting extension websocket errors. Those outcomes are **not** counted as full PASS. The audit-only `evidence/i05-audit-runtime.mjs` prevents loading that extension hook in ordinary Node processes; it substitutes no application/DB/framework behavior and changes no installed package on disk. Jest may still show its instrumentation banner but has complete assertion/suite totals.

For clean Node integration commands:

```powershell
$env:NODE_OPTIONS='--import=file:///D:/Project/Lumical/evidence/i05-audit-runtime.mjs'
```

For contract checking inside this Windows sandbox, its temporary root contains `#`, which openapi-typescript treats as a URL fragment. Use a workspace temp root (this is an environment issue, not semantic type drift):

```powershell
$env:TEMP=Join-Path $PWD '.cache/i05-audit'
$env:TMP=$env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
pnpm contract:check
```

| Command actually executed | Result / scope |
| --- | --- |
| `pnpm typecheck` | PASS backend + frontend. |
| `pnpm lint` | PASS baseline; final rerun recorded in execution addendum below. |
| `pnpm build` | PASS baseline both apps. After fixes: backend build and frontend production build PASS separately. |
| `pnpm --dir backend test -- --runInBand` | PASS 13 suites / 225 tests. |
| `pnpm --dir backend test:e2e -- --runInBand` | PASS 1 suite / 7 Supertest tests. This suite uses test ports, not a real DB. |
| `pnpm --dir frontend test` | Baseline PASS 116; after lifecycle/draft fixes PASS 119; final runtime-validation additions in execution addendum. |
| `pnpm --dir frontend exec vitest run src/api/projects.test.ts` | Before fix: 7 failed / 5 passed; after: 12/12 PASS. |
| `pnpm --dir frontend exec vitest run src/features/calendar-projects/project-detail.test.tsx` | Before lifecycle fix: 1 failed / 2 passed; after 3/3 PASS. |
| Workspace offscreen-logout regression (`-t 'after the workspace has unmounted'`) | Fails before fix; complete Project component suites after fix 12/12 PASS. |
| `pnpm --dir backend test:db` | Clean full final DB result in execution addendum. Includes I01/I02/I04, atomic creation and REST. |
| `node backend/scripts/test-project-rest.mjs` with `LUMICAL_I05_LIVE_UI=1` | PASS 5/5 **live** Chromium cases plus all REST groups, controlled API Clock and legacy characterization. |
| `pnpm contract:check` with temp workaround | PASS current Nest OpenAPI + freshly generated frontend type comparison. No generated contract content changed. |
| `node --test infra/proxy.test.mjs` | PASS 1/1 same-origin API cookie/Origin/CSRF/Set-Cookie routing. |
| `pnpm test:ui` | Full three-engine mocked browser result in execution addendum. |
| `git diff --check` | PASS at review checkpoints; final check in handoff. |

Logs are local ignored files `evidence/i05-audit-*.log`, available on this checkout but not added to Git. In particular `i05-audit-live-verified.log` contains the successful live run. Early live attempts failed due to a runner calling a nonexistent Admin detail endpoint, and a selector matching both the intended alert and Next's route announcer; these runner errors were corrected without weakening business assertions. First attempt also timed out two dark-theme logins; final four theme/locale cases pass. Early failures remain in local logs rather than being relabelled as success.

## 6. Integration assessment

**Backend/PostgreSQL:** owner scope is SQL-bound and rechecked by application policies; Identity revalidates active sessions/CSRF in the same serializable transaction. `PrismaTransactions` shares context across collaborators and rejects finished/foreign contexts. Creation locks the active complete Template, captures immutable revision/layout/price and nested Months, and persists the durable intent atomically. Serialization/deadlock retries restart the full authorized workflow with a bounded three attempts. Creation captures its Clock once so a transaction retry across midnight does not shift an accepted creation-year window.

All Project mutations lock the owner root, compare If-Match and increment one root version inside the transaction. Lifecycle repeats with current version write nothing; stale repeats still return 412. DELETE rechecks all Order history under the lock, deletes project-scoped children in dependency order and retains account media/idempotency and restricted financial history. No production ownership transfer/year-change or Paid/Ordered Project state was introduced.

**Frontend:** generated operations plus runtime validation; actor-specific private keys and epoch checks; private no-store responses. Draft/intent survives design changes and uncertain errors, exact key/body retries, no automatic preset replacement. Backend availability/history remain authoritative. P05 guard now prevents concurrent local lifecycle actions; 412 refresh does not auto-replay user intent. Delete removes detail/month cache, invalidates owner list and returns to account.

**Live proof:** real frontend proxy, backend and isolated PostgreSQL, real account cookies, Origin/CSRF and ETags. The response-loss route calls `route.fetch()` against the real backend and aborts only delivery of the first committed response. It never fabricates a success body. Admin deactivation is real; retry replays original creation despite active-catalog 404, while a new intent returns TEMPLATE_UNAVAILABLE. Owner B receives 404. An independent root mutation advances v3→v4; stale UI gets 412 and loads Archived, explicit restore uses v4 and commits v5, then DELETE succeeds. Four real UI cases verify cancelled-history rejection, hidden deletion eligibility, twelve keyboard tabs, axe and 320px in VI/EN and light/dark.

The Order rows are explicitly schema-history fixtures, not evidence of an implemented I09 ordering/cancellation journey. Ready media/AR/editor/checkout/payment/sharing device/provider workflows remain outside I05.

## 7. Remaining risks and decisions

**D01 — API owner + Lead:** confirm an explicit staged I05 `Project` response boundary (identity/state/baseline/version/timestamps plus detail deletionEligible and separate twelve-Month summary endpoint) versus the broad approved §16 resource. Record approval in the authority's change process. Do not add empty readiness/AR fields that claim later capabilities exist.

**D02 — Lead + DB/deployment owner:** establish whether any environment ever accepted P02-only PROJECT_CREATE intents without safe_result. This audit did not inspect deployment/shared DBs. If none exist, document the rollout evidence and declare the compatibility case inapplicable. If records exist, approve a forward-only remediation/operational policy; original outcomes for edited/deleted roots cannot be faithfully reconstructed. Do not delete keys or rewrite applied migrations. The passing characterization of a safe 500 is not functional replay acceptance.

**Usability acceptance:** manual screen-reader announcements, real toolbar/browser zoom at 200%, real mobile/touch and human visual inspection are UNVERIFIED here. Automated axe/keyboard/320px/theme checks do not certify WCAG compliance. Full visual regression command/result is recorded in the addendum when executed. A deployed HTTPS end-to-end browser journey is not claimed; live I05 uses the approved loopback cookie mode. I02 deployed cookie flags have API coverage.

**Calendar-zone edge:** backend creation eligibility uses configured CALENDAR_TIME_ZONE and is Clock-tested. Browser creation assistance uses its local `Date.getFullYear()`; a browser in another zone at New Year can show a different year window from the backend. No product zone contract was added during this audit. Acceptance across that exact browser/server year-boundary combination is UNVERIFIED and should accompany any later year-window contract work.

**Dependencies:** merged I02/I04 code and regression evidence are present; this audit does not invent Lead acceptance for their earlier IN_REVIEW/manual/authority notes. Human independent review and final milestone acceptance remain Lead/team actions.

## 8. I07 child/version contract (implementation handoff, not new authority)

Derived from Architecture §§15–17, Backend Standards §§12–14, API Contract §12/§17 and I07-P01:

1. Each Month/date/media/AR write authenticates an active owner through Identity, with Origin/CSRF for cookie mutations. IDs, owner and media state from browser are never authorization.
2. Use **one** `Transactions.run` context shared with every repository collaborator. Acquire the owner-scoped Project root lock before reading current child data; preserve account→session→Project lock ordering. No provider HTTP/SDK call while locks are held.
3. Require the current **Project** ETag in If-Match, not an independent child revision. Check owner first, then missing/stale precondition (428/412), Working state and child-specific rules. Foreign root/child → safe 404; stale currentVersion only after authorization.
4. Apply the child change and increment root version exactly once, update root updatedAt in the same commit. Failure must roll back both child and root; no-op desired-state policy must be explicit. Child responses include projectVersion/current Project ETag. Month reads return twelve ordered rows and their root version from one consistent transaction.
5. Validate preset against captured immutable revision; child dates use the Project year even after current year advances. Twelve Months remain 1..12; optional caption ≤300, 0–4 owned Ready images, optional Gregorian dates and designated reveal follow their own approved I07/I06 rules.
6. Idempotent child creation resolves an authorized original outcome before enforcing a now-stale original version; changed payload/key conflicts. Bounded serialization/deadlock retries re-run authorization and the full transaction, keep the original intent, and never silently retry a 412 with a fresh version.
7. I09 snapshot capture must coordinate on this same Project root/version, read all twelve children consistently and pin immutable media/artifacts atomically. Any Order history blocks DELETE, regardless of lifecycle/payment; creating an Order never freezes a Working Project. UI child saves invalidate detail/month/readiness/list keys for that actor and require user review on conflict.
8. Regression gates for I07: child/root race; two child writes on one root version; archive vs child write; rollback after child insert; snapshot vs child edit; cross-owner Ready media; old Project year; archived child write; stale If-Match; no mixed-version read/snapshot. These future feature tests have not been marked PASS by I05.

## 9. Acceptance conclusion

The audited I05 runtime foundations and newly fixed regressions have positive unit/API/PostgreSQL/live evidence. Final milestone acceptance remains **PARTIAL / REQUEST CHANGES** because D01/D02 have no approval/rollout resolution and the manual common gate is incomplete. No report, passing characterization, or successful script count silently changes those gates. Lead can review this concrete uncommitted diff and evidence, then close the decisions or request the separately approved change.

## 10. Git handoff

Existing untracked content retained: `I05-P01-review{,-v2,-final}.patch`, `I05-P02-review{,-v2,-v3}.patch`, `i03-closeout.diff`, `lumical.dbml`; `backend/scripts/{audit-release-history,deploy-staged-audit,neon-deploy-bootstrap,neon-deploy-inspect,neon-deploy-verify,prepare-demo-env}.mjs`, `backend/scripts/neon-i01-roles.review.sql`, and `evidence/neon-deployment-preflight-2026-11-05.md`. They are not audit changes and must not be swept into a blanket add.

Audit changed files: backend HTTP CORS config; OpenAPI checker; Project REST verification script; frontend Project transport + tests; Project detail + tests; Project workspace + tests/draft store; shared Dialog; lifecycle browser test; Playwright config; new `frontend/e2e/project-integration.spec.ts`; corrected P06 report; this report; audit-only runtime loader. No migration/schema/dependency/generated API change. Exact final `git status --short`, `git diff --stat` and file manifest are saved in the local ignored `i05-audit-git-handoff.log`.

Exact audit manifest (14 tracked modifications + three new files; excludes the 16 pre-existing untracked files):

```text
backend/scripts/export-openapi.mjs
backend/scripts/test-project-rest.mjs
backend/src/config/configure-app.ts
evidence/I05-P06-Implementation-Report.md
frontend/e2e/project-lifecycle.spec.ts
frontend/playwright.config.ts
frontend/src/api/projects.test.ts
frontend/src/api/projects.ts
frontend/src/design-system/composites/dialog.tsx
frontend/src/features/calendar-projects/project-detail.test.tsx
frontend/src/features/calendar-projects/project-detail.tsx
frontend/src/features/calendar-projects/project-workspace.test.tsx
frontend/src/features/calendar-projects/project-workspace.tsx
frontend/src/features/calendar-projects/workspace-draft.ts
evidence/I05-Full-Integration-Audit.md (new)
evidence/i05-audit-runtime.mjs (new, local instrumentation isolation only)
frontend/e2e/project-integration.spec.ts (new)
```

Suggested commit (not created): `fix(projects): harden I05 lifecycle, draft privacy and integration evidence`

Suggested PR description (not submitted):

> Calendar lifecycle confirmations could overlap and a draft survived logout after leaving the workspace. Add lifecycle guards and a draft-store identity observer, allow the existing PATCH API through configured CORS, validate persisted response revisions/years/timestamps, and make OpenAPI drift checking newline-safe on Windows. Add regression tests and disposable PostgreSQL → Nest → Next → Chromium proof covering same-intent response-loss recovery, owner isolation, inactive baselines, stale lifecycle writes, deletion and cancelled Order history. Correct P06 evidence and document I07 root-version coordination. No business baseline, migration or future feature is introduced. Lead decisions on staged Project DTO and legacy P02 replay remain open; see the full audit for actual command results and manual verification gaps.

## 11. Final execution addendum

- Final `pnpm --dir backend test:db`: **PASS**, exit 0. There are 76 assertion groups (20 I01, 23 I02, 13 I04, seven Project creation, 13 Project REST), plus five owned-container cleanups and three suite-completion markers. The legacy characterization group intentionally observes a 500; it does not satisfy original-outcome compatibility.
- Live optional run: **PASS**, exit 0, five browser cases and all REST/Clock/legacy groups; all owned containers removed. Log `i05-audit-live-verified.log`.
- Typecheck/lint, backend and frontend production builds, baseline backend 225 unit tests (domain unchanged), seven HTTP tests after CORS change, contract generation comparison, and proxy test: **PASS**.
- After all final transport changes, concurrent default Vitest timed out seven tests (119 passed). A one-worker attempt still overlapping the browser run timed out one Dialog test (125 passed). The isolated one-worker full run kept original 5000ms timeout and every assertion and **PASSed 126/126 across 17 files**, exit 0 (`i05-audit-frontend-unit-verified.log`). No test timeout/configuration was increased to obtain this result.
- First full three-worker browser run: **92 passed / 4 failed**, all four in Firefox (Admin list/create and English light/dark foundation 200% text cases), with timeout/context-creation/compositor failures. Every I05 creation/lifecycle case passed across all three engines. The clean isolated one-worker full rerun is recorded below; earlier failures are retained as execution evidence, not hidden.
- Isolated full rerun: `pnpm --dir frontend exec playwright test --project=chromium --project=firefox --project=webkit --workers=1` **PASS 96/96**, exit 0, 5.7 minutes, 32 per engine; original assertions/timeouts retained (`i05-audit-playwright-serial.log`).
- Final REST rerun after explicitly fixing the test calendar zone and exercising legacy replay against an already edited root: **PASS 13/13**, exit 0, owned PostgreSQL container removed (`i05-audit-rest-verified.log`).
- `pnpm peers check`: **PASS**, no peer dependency issues. `pnpm test:docker` and hosted CI were not run; no container/deployment definitions or dependencies changed. The live journey uses local Next development proxy and disposable PostgreSQL, not a claim that the production Compose/HTTPS deployment was exercised. Monolithic `pnpm verify` was not rerun as one command; its component gates were executed individually, with browser/Vitest workers serialized after the recorded resource failures.
- `pnpm --dir frontend exec playwright test --project=chromium-visual --workers=1`: **PASS 4/4**, exit 0, existing Windows baselines unchanged (`i05-audit-visual.log`). These foundation/composite snapshots complement the live Project theme/locale checks; they are not new Project screenshot baselines or manual zoom/screen-reader acceptance.
- Final `git diff --check`: **PASS**. Tracked diff: **14 files changed, 232 insertions(+), 40 deletions(-)**. Three new audit files are not included in that tracked diff stat. `git status --short`: 14 modified tracked files and 19 untracked entries, of which 16 predate this audit. Total audit scope: 17 files. Branch/HEAD unchanged; no staging/commit/push/PR/merge performed.
