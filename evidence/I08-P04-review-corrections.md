# I08-P04 review corrections — execution record

This record covers the current uncommitted review corrections, not acceptance of the complete I08-P04 deliverable. No commit, push, LEAD approval, production deployment, or genuine device recognition is claimed.

## Changes

Artifact URLs now contain the actual Project UUID and use the existing contract route `/api/v1/projects/{id}/ar/targets/{targetId}/artifact`. Preview URLs pin `projectVersion`. The artifact controller supports private no-store full and single-range responses (200/206), unsatisfiable ranges (416), and HEAD. Exact-path assertions and backend negative cases cover owner isolation, missing/unknown/stale targets, preparation/reveal unavailability, integrity and private byte access.

Availability checks now combine preparation status, saved Project/source revision, reveal readiness and artifact verification. Scoped reveal resolution and content transport recheck owner/project/version around provider I/O. The added reveal endpoints are explicitly a pending contract extension proposal in `docs/API_CONTRACT.md`, not an approved baseline change.

Owner-preview copy and runtime accessibility labels use VI/EN localization. An independent review found that private-content scope refusals could retain descriptor text; this was corrected and regression cases for 401/403/404/409/412 were added. The pre-existing Vercel nested build shim was left unchanged because it belongs to a separately committed deployment correction, not this work.

## Executed verification

Verification ran in a clean Linux source mirror with Node 24.21.0, pnpm 11.22.0 and installed workspace dependencies. Windows node_modules were not replaced. The root lockfile was updated for the frontend's pinned MindAR dependency. Generated backend OpenAPI and frontend API types were copied back to the project.

`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm contract:generate`, `pnpm contract:check` and `git diff --check` passed. `pnpm test` passed: backend Jest 32 suites / 495 tests, frontend Vitest 29 files / 347 tests, and backend HTTP e2e 7 tests. Backend script-level privacy tests also passed as part of that command. Proxy tests passed all 4 cases.

## Follow-up regression fixes (2026-11-28)

The developer's Docker run exposed DB12 `Worker finished before reading source`. The retry fixture used PostgreSQL wall time while preparation claims used host time. Preparation now consistently injects the application Clock for scheduling, leases and retry/publication fencing. DB12 advances that Clock to persisted due_at and asserts no claim one millisecond before the retry deadline, instead of rewriting due_at with database now(). Four unit regressions cover scheduling and lease/retry behavior. The actual Docker-backed DB12 rerun remains required; no database pass is claimed here.

Independent runtime review found the pinned MindAR InputLoader consumes video.width/height, which were unset. The scanner now assigns validated intrinsic dimensions before warmup/processing and handles detached processing/worker failure events with camera/runtime cleanup. Nineteen tests execute the scanner source with a deterministic injected Controller; they verify dimensions, stop/pagehide, late permission resolution, asynchronous failures and cleanup, not genuine matching.

After these changes, Node 24.21.0 clean-mirror typecheck, lint, build, contract check and diff check passed. Full pnpm test passed: backend 33 Jest suites / 499 tests, frontend 30 Vitest files / 366 tests, and 7 backend HTTP e2e tests. User runs Node 24.22.0; that exact patch version was not used in this mirror.

## Blocked or pending verification

The real PostgreSQL/API readiness suite was attempted but could not start its disposable database: Docker executable is absent (`ENOENT`). Its newly added API negatives and range assertions are therefore implemented but not execution-verified here. Run `pnpm --dir backend test:project-readiness` on the supported Docker environment, then the full database suite.

The targeted Playwright authoring suite was attempted but could not launch Chromium because the browser binary is not installed. This is an environment failure, not a passing browser result. Full browser regressions, actual rendered-layout inspection and runtime camera behavior remain pending.

No genuine owner-device MindAR recognition, camera permission/cleanup device evidence, V07 acceptance, approved reveal-contract extension, or LEAD MR review has been recorded. Deterministic recognizer adapter tests do not count as successful real camera recognition. Full `pnpm verify` has NOT been established for this revision.

## Next validation on the developer machine

Use the repository Node version, install the updated workspace dependencies, and apply the new AR reveal-binding migration only to the appropriate development/test database through the established migration workflow. Run the full `pnpm verify`. Review and approve the reveal contract proposal, then record genuine device/V07 evidence and LEAD review before marking I08-P04 Done.
