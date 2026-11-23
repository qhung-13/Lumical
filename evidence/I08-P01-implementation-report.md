# I08-P01 — Implementation and verification report

Date: 2026-11-23 (Asia/Saigon). Status: **internal policy/query implementation verified; contract and genuine-evidence dependencies remain open**. No acceptance, independent review or merge-readiness claim.

The original implementation pass is recorded below. The appended final implementation self-review records the subsequent fresh validation and the Lead-authorized local commit boundary; it does not confer independent teammate review or contract approval.

## Starting Git state and preservation

Branch: `feature/I08-P01-readiness-policies-contract`. Actual starting HEAD: `bd7626fe3916c6e17cfa7483060065eda2f757b0` (`Merge pull request #61 from qhung-13/fix/I07-concurrency-recovery`). `git merge-base HEAD dev` and local `dev` both resolved to that SHA. No branch creation/switch or network Git operation was necessary.

The working tree already contained roadmap/planning modifications, `docs/proposals/`, historical planning files and `lumical.dbml`. SHA-256 comparison of all **45** pre-existing modified/untracked files before/after the initial implementation found **zero changes**. `Lumical_Old/`, approved API/Business/Architecture/Database authorities, Prisma schema/migrations, backend OpenAPI and frontend generated types have no task diff. During that initial pass, HEAD/dev remained unchanged; the existing stash was `stash@{0}` at `3e941268be11ea81073fdf7fdd4ae6615ad1cd51`. That pass performed no commit, push, PR, merge, fetch, pull, reset, rebase or stash operation. No AGENTS.md was found in the workspace or inspected ancestors.

## Authority and pre-edit architecture assessment

Reviewed repository Business Rules, API Contract, Architecture, Database, Roadmap, Backend Standards, Testing Strategy, Dev Workflow, ADR-001/002/005, I03/I07/I08/I09 plans, the I03 acceptance-boundary revision, I07 source/test/merge evidence, current replanning/CR material and I09-R2 handoff. The concise rule/authority mapping and pre-edit assessment are in [contract review](I08-P01-contract-review.md). The Lead-confirmed independent Finalization direction is acknowledged; unresolved technical contracts are not promoted to approved authority.

CalendarProjects already provides the appropriate domain/application/repository boundary. Its existing Identity transaction uses PostgreSQL SERIALIZABLE and I07 root revision coordination. A single internal owner-scoped query can collect saved root, Month associations, current AR and owned media from that transaction. No frontend response assembly or new module platform is required. Existing artifact rows and AR_PREPARE intent lack a reviewed genuine-preparation verifier; existing code has no trustworthy owner preview-review acknowledgement. Both facts must fail closed.

I03 R1 is ready for coordinated review, not production/device approval. I07 merged code and fresh regression results below do not close its independent/manual milestone acceptance.

## Actual files changed

| File under repository root | Purpose |
| --- | --- |
| `backend/src/modules/calendar-projects/domain/readiness.ts` | Separate pure Preview, AR and Finalization policies; evaluated revision; provisional deterministic issue codes; trusted-evidence input types. |
| `backend/src/modules/calendar-projects/domain/readiness.spec.ts` | R01–R18 policy matrix, including image/video/audio alternatives and synthetic positive evidence. |
| `backend/src/modules/calendar-projects/application/readiness-repository.ts` | Narrow read-only snapshot port that takes the existing transaction context. |
| `backend/src/modules/calendar-projects/application/project-owner.ts` | Internal `readiness(id,browser)` query using existing active-account authorization, safe owner check and bounded whole-transaction retry. |
| `backend/src/modules/calendar-projects/application/readiness-query.spec.ts` | Q01–Q05 owner scope, shared context, missing/foreign denial, complete retry and retry bounds. |
| `backend/src/modules/calendar-projects/application/project-owner.spec.ts` | Supplies the added repository dependency in existing service fixtures. |
| `backend/src/modules/calendar-projects/infrastructure/prisma-readiness.ts` | Explicit owner-scoped persistence projection; media verification/availability/removal facts; null genuine preparation/review proof. |
| `backend/src/modules/calendar-projects/calendar-projects.module.ts` | Wires the read port to its Prisma adapter in the established Nest module. |
| `backend/src/modules/media/domain/media.ts` | Exposes the existing media MIME allowlist through a shared pure helper, used by both media intake policy and readiness; no allowlist/limit behavior change. |
| `backend/scripts/test-project-readiness.mjs` | Twelve integration checks against a disposable real PostgreSQL database and actual Nest composition, with Supertest and a committed-edit barrier. |
| `backend/package.json` | Adds `test:project-readiness` and includes its script in `test:db`; no dependency/lockfile changes. |
| `evidence/I08-P01-contract-review.md` | Authority mapping, route inventory, DTO/issue/review/preparation proposals, compatibility and D1–D4 decisions. |
| `evidence/I08-P01-readiness-fixtures.json` | Exact proposed incomplete/pending/unverified/future-verified response fixtures, clearly marked proposal. |
| `evidence/I08-P01-rule-matrix.md` | Scenario/result/issue/rule/test traceability. |
| `evidence/I08-P01-implementation-report.md` | This report, exact validation outcomes, dependency assessment and suggested PR. |

## Technical behavior and consistency

Preview validates saved identity/year/root version and exactly Months 1–12, allowing incomplete content and Archived owner-readable work. It does not reapply the new-Project year window. AR separately requires supported configuration/readable text, usable owned media, current source revision, trusted source/artifact proof, matching target/Month/reveal content version, equivalent authorized fallback and current owner mapping confirmation. Finalization separately requires Preview completeness, Working, at least one usable owned Ready image **attached to any Month**, AR readiness and trusted review of the exact current revision/target. Zero dates, empty Months and a single calendar image remain valid. Order, Payment and Sharing are absent from the policy inputs.

Media size/duration limits and supported MIME types reuse the existing Media domain authority. Project/AR validation reuses the existing name/AR write validators. A READY media item still needs verified metadata, storage binding, correct owner/category/version and no owner removal/deletion intent. No private storage key is returned by a policy.

`ProjectOwnerService.readiness` uses `withActiveAccount(..., false, ...)`; it checks the owner-scoped root before fetching children. Prisma adapter statements all use the same existing transaction context/client, including owned media and deletion intents. The SERIALIZABLE snapshot begins with authentication and remains consistent through root/child reads. Every result's `projectVersion` comes from that root. There is no provider/network call or content/job mutation. Identity may refresh session activity as it already does for other private reads.

The DB08 test pauses after the root read, commits an actual I07 root-locked Month edit/root increment in another transaction, then resumes children. It observes revision 3 with its original image; a later query observes revision 4 without that image and with stale AR preparation. Identity's same-account locks are bypassed only for the competing **test repository transaction**, making the interleave observable without production hooks. Q04/Q05 verify that serialization conflicts restart authentication and the whole snapshot, at most three attempts.

The query describes its evaluated revision, not an indefinite guarantee about currentness after return. Finalization/Order commands must independently lock/recheck expected/reviewed revision and current media/artifact facts when capturing immutable content. A late completion pointing to an older artifact returns STALE. Current READY artifact status/reference/timestamp/opaque metadata always yields UNVERIFIED because the adapter supplies no trusted proof. The current query therefore cannot return AR or Finalization Ready, even when a row is labelled READY.

## Backend typecheck

**PASS:** from `backend/`, `node node_modules/typescript/bin/tsc --noEmit`. Final production source compiled successfully after the shared Media helper change.

**BLOCKED wrapper attempt:** `pnpm --dir backend typecheck` failed before TypeScript because pnpm attempted to open its restricted global SQLite store database (`ERR_SQLITE_ERROR`). Used installed local CLI equivalents; no package installation or lockfile change was needed.

## Backend lint

**PASS:** from `backend/`, `node node_modules/eslint/bin/eslint.js src test scripts prisma.config.ts`. After the final integration fixture edit, `node node_modules/eslint/bin/eslint.js scripts/test-project-readiness.mjs` also passed.

New files were formatted using the installed Prettier CLI. Existing source files were changed narrowly, without unrelated formatting.

## Backend unit tests

**PASS:** from `backend/`, `node --test scripts/media-privacy-gates.test.mjs` — **4/4**.

**PASS:** from `backend/`, `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand` — **29 suites, 477/477 tests**. The final run includes the shared Media allowlist extraction. The earlier focused `... --runInBand src/modules/calendar-projects` run passed **6 suites, 181/181 tests**.

An initial sandboxed full run had 462 passes and 15 existing HTTP-test failures due to loopback `connect EACCES`; the same full command passed with loopback access. These were environment failures, not waived tests. Positive preparation/review fixtures are synthetic domain evidence only, never a provider/device acceptance claim.

## API and PostgreSQL integration checks

**PASS:** from `backend/`, `node --experimental-vm-modules node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand` — **7/7 Supertest tests**.

**PASS:** from `backend/`, `node scripts/test-project-readiness.mjs` — **DB01–DB11 + API01, all 12 checks**, using migrated disposable PostgreSQL `17.11-bookworm`, existing runtime permissions and actual Nest services:

- Empty twelve-Month/zero-date Preview, evaluated revision and deterministic issues.
- Actual active-session ownership/missing/anonymous/disabled denial.
- Existing AR config HTTP projection/no-store and cross-owner safe 404; readiness route remains absent while its DTO decisions are pending.
- Actual I07 image/AR writes advance the root; one image satisfies the image gate; PREPARING never becomes Ready.
- READY row/reference/timestamp/mock metadata remains UNVERIFIED; missing/unavailable artifacts are explicit negatives.
- Repeated reads leave Project/Months/associations/dates/AR/artifacts/media/jobs unchanged.
- Existing Order and actual Payment-attempt INITIATED→FAILED changes do not affect readiness.
- Real committed root/child edit barrier prevents mixed revisions.
- AR edit and late old artifact remain STALE.
- Existing database guard refuses referenced-media purge; owner-removed media cannot satisfy reveal readiness.
- Archived remains previewable and cannot finalize.

**PASS:** from `backend/`, `node scripts/test-project-personalization.mjs` — **10 existing I07 checks**, including actual concurrent Month/PATCH version competition, Special Date intent race, media attachment/deletion, AR revision/idempotency/history, rollback, Archived rejection and OpenAPI. Each suite owned and removed only its labelled disposable container; no dev/demo database was reset or migrated.

Initial integration runs exposed test-fixture mistakes: attempting UPDATE on immutable artifact storage, using a nonexistent Payment `PENDING` enum, and trying to queue purge for referenced media. Corrected the fixtures to INSERT immutable READY artifacts, use actual INITIATED state, and explicitly assert the existing purge guard before testing owner removal. The full final suite passed; no schema/grant weakening or production workaround was made.

**BLOCKED pending contract review:** HTTP readiness response DTO/issue/private-cache/precondition acceptance, true AR Ready via production persistence, and trusted review acknowledgement. The test of absent `/readiness` is a publication guard, not a claim of a completed readiness API. Current `/ar/config` no-store behavior is tested; proposed `private, no-store` readiness headers cannot be runtime-certified until the route is reviewed/enabled.

## Backend build

**PASS:** from `backend/`, `node node_modules/@nestjs/cli/bin/nest.js build`. Existing generated Prisma client was used; no schema or new generated API artifact was introduced. Final typecheck/build executed after the production Media helper change.

## OpenAPI and contract checks

**PASS:** from repository root, `node backend/scripts/export-openapi.mjs --check` — runtime OpenAPI matches the reviewed artifact.

**PASS:** from repository root, with a process-local temp directory:

```powershell
New-Item -ItemType Directory -Path 'D:\Project\Lumical\.cache\i08-p01-temp' -Force | Out-Null
$env:TEMP = 'D:\Project\Lumical\.cache\i08-p01-temp'
$env:TMP = $env:TEMP
node frontend/scripts/check-contract.mjs
```

Frontend types derive from current backend OpenAPI. The initial default-temp run failed because the sandbox temp path includes `#`, which the generator treated as a URL fragment; the workspace temp-path rerun passed. No generator code or approved artifact was changed.

Proposed JSON fixtures parse successfully. The future DTO examples are not compiled into OpenAPI or frontend types.

## Git and preservation checks

**PASS:** `git diff --check` and the targeted backend diff check, with only Git's existing LF/CRLF notices. Original 45-file SHA-256 comparison: zero differences. `git diff --name-only -- docs/API_CONTRACT.md docs/BUSINESS_RULES.md docs/ARCHITECTURE.md docs/DATABASE.md backend/prisma backend/openapi.json frontend/src/api/generated.ts Lumical_Old` returned no paths. Branch, HEAD, local dev and stash were rechecked unchanged.

## Not run and remaining evidence

- **NOT RUN:** whole workspace `pnpm verify`, complete `test:db` chain, frontend/UI suites. This backend change ran the relevant domain/application/API/PostgreSQL checks and existing I07 regression directly; package wrappers hit the pnpm environment issue above.
- **NOT RUN / dependency:** genuine P02 target compiler/source-render/region/integrity acceptance, supported-device recognition, external-provider privacy/license checks and independent human reproduction. No new SDK or target preparation is implemented.
- **NOT RUN / dependency:** P03 rendered Preview and P05 explicit review/handoff UI/persistence. No invented acknowledged flag or reviewed-version query parameter exists.
- **OPEN:** independent teammate/Lead review, I03/I07 inherited admission closure and the D1–D4 technical decisions. No task/milestone status was changed to Done.

## Dependency assessment

| Slice | Independently implemented/verifiable now | Required later |
| --- | --- | --- |
| I08-P01 | Separate pure rules, provisional issue vocabulary, evaluated revision, internal authenticated query, conservative Prisma projection, focused tests/proposals | D1/D2 contract decision before HTTP publication; independent review |
| I08-P02 | Missing/stale/pending/unavailable/unverified evidence fails closed | Genuine immutable target preparation; actual saved render/region/hash/provenance/integrity and stale-job publication; reviewed proof adapter |
| I08-P03 | Preview criterion allows incomplete valid saved content | Whole-year/Month rendered Preview and readable alternative from that revision |
| I08-P04 | Scoped mapping/fallback evidence is required in policy | Actual authorized owner target/reveal/fallback verification and mapping confirmation |
| I08-P05 | Missing/current/stale trusted review inputs evaluated by domain | Reviewed explicit acknowledgement protocol/persistence and review/handoff UI; D4 |
| I09-R2 / deferred I09 | Shared Working/content/AR/current-review predicate available internally | Lock/re-evaluate current expected/reviewed revision, genuine evidence/media, immutable capture/pins/idempotency; separate Finalization versus Commerce contracts |
| I11 Sharing | No mutable Project Sharing decision | Approved immutable subject and deliberate grant/access lifecycle; no Order/Payment inference here |

## Suggested PR (prepared text only)

**Title:** `feat(I08-P01): add version-bound readiness policies and query contract`

Incomplete saved calendars currently have no derived backend readiness evaluator. Add separate Preview, AR and Finalization policies and an internal owner-scoped query over the existing serializable Project snapshot. Empty Months and zero Special Dates remain previewable; Finalization requires one owned usable Ready calendar image, Working state, genuine current AR evidence and review of the exact current revision.

The persistence adapter deliberately withholds preparation/review proof: READY database rows and AR_PREPARE intents cannot establish AR Ready. Keep HTTP/approved schemas unchanged while proposing the exact readiness DTO, issue vocabulary and preparation/review handoffs in the evidence files. Expose existing Media MIME validation to avoid a second allowlist.

Acceptance covered: rule matrix R01–R18/Q01–Q05; consistent evaluated revision; cross-owner denial; no content mutation; pending/missing/unavailable/unverified/stale preparation; reveal alternatives; review/version negatives; optional dates; Order/Payment independence. Validation: typecheck/lint/build; 477 backend tests + 4 script tests; 7 Supertest tests; 12 real PostgreSQL readiness checks including a committed-edit barrier; 10 existing I07 regression checks; OpenAPI/frontend contract and Git/preservation checks.

Review decisions/risks: D1 Finalization field/legacy alias, D2 new issue codes, D3 verified preparation normalization and D4 acknowledgement protocol remain proposals. Runtime readiness publication and true AR/Finalization Ready are blocked until reviewed evidence adapters exist. I03/I07 formal acceptance and genuine provider/device/manual proof are not established by these tests. Requires Lead + independent teammate review; not accepted or merge-ready by this report.

## Final implementation self-review and local commit boundary

Performed on the same feature branch and starting SHA on 2026-11-23, at the Lead's explicit request to commit only the 15 files in the file table above. The index was empty before review. R2 planning changes were confirmed intentional and unrelated; they remain outside the commit. No source or test changes were necessary during this final review; only this evidence report was updated.

### Code review verdict

**No verified BLOCKER or MAJOR findings; no unresolved verified defects found within I08-P01 scope.** Reviewed all 15 files against BR-RDY-001–004, relevant Project/Month/Media/AR rules, Architecture transaction/module boundaries, API ownership/version requirements and the task's acceptance criteria. No finding requires a code-location/fix entry.

Confirmed: incomplete twelve-Month/zero-date Preview; separate version-bound AR and Working/image/AR/current-review Finalization checks; one serializable root/child/media snapshot; active-owner-only reads and safe denial; no Order/Payment dependency; no readiness HTTP publication or approved issue/schema change; no P02 preparation, P05 acknowledgement persistence or I09 snapshot/commerce functionality. The intentionally null preparation/review evidence is a declared dependency boundary, not a P01 defect. Positive policy fixtures remain synthetic trusted inputs, not genuine provider proof.

This is an **implementation self-review**, not independent teammate review, Lead contract approval, milestone acceptance or DONE status.

### Typecheck

**PASS**, exit 0: from `backend/`, `node node_modules/typescript/bin/tsc --noEmit`.

### Lint

**PASS**, exit 0: from `backend/`, `node node_modules/eslint/bin/eslint.js src test scripts prisma.config.ts`.

### Backend build

**PASS**, exit 0: from `backend/`, `node node_modules/@nestjs/cli/bin/nest.js build`.

### Readiness unit tests

**PASS**, exit 0: from `backend/`, `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand src/modules/calendar-projects/domain/readiness.spec.ts src/modules/calendar-projects/application/readiness-query.spec.ts` — **2 suites, 48/48 tests**. These are a subset of the full 477-test run below.

The initial sandboxed attempt exited with loopback `connect EACCES` from installed instrumentation. The identical focused command passed with loopback access; no test or product behavior was changed to bypass a failed assertion.

### Backend Jest and relevant Supertest tests

**PASS**, exit 0: from `backend/`, `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand` — **29 suites, 477/477 tests**, including HTTP parser/Project error contract Supertest coverage.

**PASS**, exit 0: from `backend/`, `node --experimental-vm-modules node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand` — **7/7 Supertest tests**.

**PASS**, exit 0: from repository root, `node --test backend/scripts/media-privacy-gates.test.mjs` — **4/4 tests**.

### Readiness PostgreSQL/API tests

**PASS**, exit 0: from `backend/`, `node scripts/test-project-readiness.mjs` — **all 12 checks (DB01–DB11 and API01)**, including committed-edit snapshot consistency and stale late-artifact rejection. The suite removed only its own labelled disposable PostgreSQL container.

### I07 regression tests

**PASS**, exit 0: from `backend/`, `node scripts/test-project-personalization.mjs` — **all 10 regression checks**, including concurrency/idempotency/rollback/ownership. The suite removed only its own labelled disposable PostgreSQL container.

### Contract checks

**PASS**, both exit 0: from repository root, `node backend/scripts/export-openapi.mjs --check`, followed by `node frontend/scripts/check-contract.mjs` with process-local TEMP/TMP set to `D:\Project\Lumical\.cache\i08-p01-temp`, as in the earlier command block. These check existing runtime/OpenAPI/client compatibility; they do not approve the proposed readiness DTO or D1–D4.

The initial sandboxed exporter reported its assertion PASS, but instrumentation repeatedly failed to connect and prevented normal process exit; that attempt was interrupted and is not recorded as a passing process. The same complete contract-check sequence subsequently exited 0 with loopback access.

### Staging and publication boundary

Use explicit `git add -- <paths>` for exactly the 15 files in the file table, verify the exact staged set, inspect the full staged diff and run `git diff --cached --check` before the authorized local commit:

`feat(I08-P01): add revision-bound readiness policies`

The commit SHA is recorded by Git and in the final user-facing report. **COMMITTED is distinct from VERIFIED/DONE**: the executed checks verify the internal implementation; D1–D4, genuine preparation/review integrations and independent/Lead acceptance remain open. No push, PR, merge or modification of `dev` is authorized or performed by this final review.

Before staging, all **48 unrelated pre-existing files** (including the three review archives/patches) were compared by SHA-256 against this review's starting state: **zero changes**. HEAD and `dev` were still the starting SHA, and the index remained empty. The code/tests/other evidence needed no change; this report records the new review run.

### Remaining unrelated working-tree entries

These pre-existing entries are excluded from staging and must remain uncommitted and unchanged (directory entries use Git's compact status representation):

```text
 M docs/README.md
 M docs/ROADMAP.md
 M planning/I08-preview-and-readiness-and-target-preparation.md
 M planning/I09-order-snapshot-and-checkout.md
 M planning/I10-paypal-sandbox-payment.md
 M planning/I11-recipient-sharing-and-fallback.md
 M planning/I12-ar-signature-experience.md
 M planning/I13-admin-orders-demo-fulfillment.md
 M planning/I14-account-views.md
 M planning/I15-vi-en-theme-hardening.md
 M planning/I16-accessibility-responsive-hardening.md
 M planning/I17-p1-recovery-notifications.md
 M planning/I18-p2-stretch-optional.md
 M planning/I19-final-e2e-security-demo-hardening.md
 M planning/I20-final-documentation-presentation.md
 M planning/README.md
?? I08-P01-new-files.tar.gz
?? I08-P01-review.patch
?? I08-P01-tracked-only.patch
?? docs/proposals/
?? lumical.dbml
?? planning/I09-R2-independent-finalization.md
?? planning/REPLANNING_I08_I20.md
?? planning/REQUIREMENTS_TRACEABILITY_R2.md
?? planning/TASK_CROSSWALK_R2.md
?? planning/VALIDATION_R2.md
?? planning/WBS_UPDATE_SPEC_R2.md
?? planning/history/
```
