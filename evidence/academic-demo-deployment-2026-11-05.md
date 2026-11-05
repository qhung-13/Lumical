# I00–I04 academic demo deployment

Status: Neon migrated and verified. Hosting pending explicit approval for branch push and provider secret upload. No public healthy deployment is claimed.

## Revision and scope

- Branch: `codex/i04-academic-release`, based on reviewed I04 `1a9aa9017ca204a527631b913f8b8263cf65114a` (main merge of I04 acceptance closure).
- Existing feature worktree and prior deployment worktree preserved. Prior deployment transport changes were copied and reviewed, then health-probe and transport tests added.
- I05-P02 is committed in feature history and origin/dev, but is outside this demo authorization. Its `20261104000100_project_names_text` migration is absent from the selected historical revision, without editing migration history.
- No main merge, forced push, reset, database recreation, `db push`, or migration reset.

## Database: PASS

- Existing Neon Free production branch in Singapore; identifier `ep-…e0fh`, database `neondb`.
- PostgreSQL 18.6. Initial read-only inspection found no application roles/schema/tables/history or partially applied bootstrap.
- Initial bootstrap transaction rolled back on PostgreSQL `42501: must be able to SET ROLE lumical_migration`. Explicit administrative membership `lumical_migration TO neondb_owner WITH SET TRUE` resolved schema ownership without elevating the application roles.
- `lumical_migration`: direct verified TLS connection; schema owner. `lumical_runtime`: pooled verified TLS connection; schema USAGE, reviewed migration-defined table/column permissions. Both roles: NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS.
- Owner retained only for administration. Render payload excludes owner/migration credentials. Secrets stored only in Git-ignored files.
- Bootstrap deliberately refuses unknown existing role/schema/object state rather than replaying SQL blindly; no role password is reset on retry.
- Future tables/sequences/functions remain fail closed: PUBLIC default privileges revoked, and runtime privileges must be introduced explicitly by each reviewed migration. No blanket default DML grant.
- `node scripts/prisma.mjs migrate status`: initially six pending; after `pnpm db:migrate`: schema up to date.
- Applied IDs and exact SHA-256 comparison are recorded in `neon-verification-2026-11-05.json`: all six I01/I04 migrations PASS.
- 30 application tables plus `_prisma_migrations`, 115 indexes, 359 validated constraints, two protective triggers. All tables owned by migration role.
- Runtime negative tests for schema creation, table creation in lumical/public, ALTER, TRUNCATE, migration-history SELECT, immutable-revision UPDATE and function creation all returned 42501; every probe rolled back.
- Existing `pnpm db:seed` ran successfully as runtime: disabled example.invalid users and inactive synthetic template only. A separate synthetic operator and complete public template were created through the actual application API for integration verification. No participant data.

## Executed local checks

| Check | Result |
|---|---|
| `pnpm install --offline --frozen-lockfile` | PASS after sandbox permission for pnpm store |
| `pnpm build` | PASS backend and Next.js SSR production compilation |
| `pnpm typecheck` | PASS both apps |
| `pnpm --dir backend test --runInBand` | PASS 131 tests / 11 suites |
| `pnpm --dir backend test:e2e` | PASS 7 tests |
| `pnpm test:proxy` | PASS same-origin cookie/CSRF/Set-Cookie routing |
| `pnpm --dir frontend test --maxWorkers=2` | PASS all 104 tests / 15 suites; default unconstrained run hit one timing-only failure |
| Focused backend transport frontend test | PASS two new tests |
| `node scripts/verify-demo-api.mjs` | PASS 22 checks against local production NestJS + remote Neon |
| `pnpm lint`, `pnpm contract:check`, final production rebuild | PASS |

HTTP integration evidence is in `local-neon-api-verification.json`: readiness/liveness 200, direct account route without gateway key 404, registration 201, login/account/admin/catalog/detail 200, anonymous 401, non-admin and Origin/CSRF rejections 403, logout 204 and revoked session 401. Secure HttpOnly SameSite=Lax Path=/ host-only cookie and private no-store verified from real responses. This is local HTTP evidence, not live HTTPS/browser acceptance.

Initial loopback tests failed with sandbox EACCES; rerunning with loopback permission passed. Adding an API catch-all caused Next lint to flag the foundation health anchor; it now uses existing Next Link with prefetch disabled. Contract artifact regeneration showed no semantic Git diff: strict comparison had encountered Windows CRLF; `.gitattributes` now fixes OpenAPI JSON to LF.

## Hosting configuration and approved demo exception

Render: existing production Dockerfile, repository-root context, pinned Node 24.21.0 and pnpm 11.22.0, final non-root runner, no migration on startup. Runtime binds 0.0.0.0 and provider PORT; health `/api/v1/health/ready`. `render.yaml` specifies free Singapore service and manual deployments.

Vercel: project root `frontend`, framework Next.js, Node 24.x provider runtime, pinned frozen pnpm install and `pnpm build`. `frontend/vercel.json` provides reproducible commands. Exact provider patch-level Node version may differ from local pinned image and must be checked from deployment logs.

The user's explicit $0 academic demo exception permits public Render/Neon network endpoints with synthetic data. These endpoints are **not private**. Server-to-server HTTPS gateway key gates every backend route except minimal GET/HEAD health probes. Vercel's server-only transport overwrites caller gateway headers and prevents credential forwarding to other origins or redirects. Browser requests remain same-origin `/api/v1`; the Next catch-all performs transport only, preserving Nest authorization, Origin, CSRF, cookie and ETag controls. All responses are private/no-store. No wildcard trusted proxy or cross-origin-browser workaround.

## Approval gates and live acceptance

- BLOCKED: push new deployment branch to origin (user explicitly reserved remote Git authorization).
- BLOCKED: import provider-specific environment payloads. Automatic approval review rejected Render upload because it required explicit approval of these secret fields and destination.
- Vercel CLI login was rejected by automatic approval review; user selected existing browser sessions only. No CLI login attempted afterward.
- Render payload: runtime DATABASE_URL, IDENTITY_SECRET_KEY, LUMICAL_GATEWAY_KEY, NODE_ENV, IDENTITY_COOKIE_MODE, IDENTITY_ALLOWED_ORIGINS. No migration or owner URL.
- Vercel payload: BACKEND_URL and LUMICAL_GATEWAY_KEY. No database credential, session hash key, or NEXT_PUBLIC secret.
- NOT TESTED live: backend cold start/logs/health, frontend HTTPS/browser flows, cookie persistence and SSR, proxy path, deployed catalog/admin, live UI loading/empty/error acceptance. Local/unit evidence does not substitute for these.

## Limits, rollback and future increments

Render Free sleeps and has shared monthly free-hour quotas, no always-on worker guarantee, persistent disk, SSH or one-off job capability. No keepalive workaround or worker claim. Vercel Hobby and Neon Free quotas apply. Check provider usage before upgrades; billing requires user approval.

Neon dashboard reported six-hour history retention at inspection. No tested backup/restore or point-in-time recovery guarantee is claimed. Database rollback must preserve applied migrations and synthetic/audit history; use compatible code rollback or reviewed forward-fix. Never reset shared demo data to redeploy.

For I05–I20: review scope and schema/code compatibility, integrate deployment transport through a reviewed PR, extend the existing migration history, test on disposable PostgreSQL, run direct-role `pnpm --dir backend db:migrate` once separately, deploy the same Render/Vercel resources and verify health/identity/regression evidence. Keep migration credentials out of runtime. Future media/payment/background work requires its own provider and architecture acceptance; the I04 demo does not implement it.
