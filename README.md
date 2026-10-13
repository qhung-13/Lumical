# LumiCal

A university software engineering project for personalized twelve-month memory
calendars. This repository contains the **I00 team-ready and I01 database foundations**.
The temporary frontend page and technical health endpoint support setup only.

## Requirements and installation

- Node **24.21.0** (see [.nvmrc](.nvmrc)); select this version before running pnpm.
- pnpm **11.22.0**, pinned in `packageManager`.
- Docker with Compose v2 for PostgreSQL and the complete verification gate.

```sh
npm install --global pnpm@11.22.0
pnpm install --frozen-lockfile
```

All commands below run from the repository root. The root `pnpm-lock.yaml` is the
only dependency lockfile; add dependencies to the relevant workspace package.

## Structure and code ownership

| Path | Purpose |
| --- | --- |
| `frontend/` | Next.js 16.4.0, React 19.3.0, TypeScript 5.9.3; App Router, CSS, ESLint, Vitest + Testing Library. |
| `frontend/src/app/` | Routing, layouts and route handlers; compose features here. |
| `frontend/src/features/` | Future product features. |
| `frontend/src/components/`, `design-system/` | Shared UI and future approved Design System implementation. |
| `frontend/src/api/`, `lib/`, `hooks/`, `i18n/`, `types/` | API access, generic infrastructure, shared hooks, translations and neutral UI types. |
| `backend/` | NestJS 12.1.2, TypeScript 6.0.3, ESLint, Jest 30.5.2 and Supertest. |
| `backend/src/modules/` | Technical health module now; future modules follow Backend Standards. |
| `backend/src/common/`, `config/` | Shared technical infrastructure and application configuration. |
| `docs/` | Frozen product, architecture, design and team authorities. |

## Local development

```sh
pnpm dev:frontend    # http://localhost:3000
pnpm dev:backend     # http://localhost:3001/api/v1/health
pnpm dev             # both servers concurrently; Ctrl+C stops them
```

Liveness and the setup page work without environment files; database readiness
requires configured, migrated PostgreSQL. Copy
`frontend/.env.example` to `frontend/.env.local` and `backend/.env.example` to
`backend/.env`. Next loads its env file; the backend `dev` script uses Node's
native env-file support. Restart after changing environment values. If changing
the backend port, update frontend `BACKEND_URL` to match.

Open `http://localhost:3000/api/v1/health` to check the same-origin path through
Next to Nest. `BACKEND_URL` is server-only; browser calls stay on `/api/v1`.
An unreachable or invalid backend response becomes a controlled, uncached 502.

## Docker

Copy root `.env.example` to `.env` and replace each password placeholder with a
different randomly generated hexadecimal string (for example, run
`node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"`
three times). These are local secrets; never commit them. Hexadecimal passwords
avoid URL-encoding pitfalls in Compose connection URLs.

```sh
docker compose up --build -d
docker compose down
```

Defaults expose frontend on 3000 and backend on 3001. Copy root `.env.example`
to `.env` and set `FRONTEND_PORT=3100`, `BACKEND_PORT=3101` and `POSTGRES_PORT=5434`
to override host ports. PostgreSQL binds only to loopback. The `lumical` Compose
project owns its database volume; `down` retains it. Initialization creates
separate bootstrap, migration and runtime roles; a one-off migration service
must succeed before the backend starts. Changing passwords in `.env` does not
change roles in an existing volume: rotate them explicitly through the bootstrap
role. Never delete a shared/dev volume as a migration strategy.
Container ports stay fixed; Next reaches Nest at `http://backend:3001`.
These are production-style containers; use `pnpm dev` for normal coding.
Run Compose from this repository and manage only its project; never prune or
stop unrelated Docker projects.

For host development, start only PostgreSQL and copy the matching runtime and
migration URLs into `backend/.env` (including the chosen PostgreSQL host port):

```sh
docker compose up -d --wait postgres
pnpm --dir backend db:migrate
pnpm --dir backend build
pnpm --dir backend db:seed
pnpm dev
```

`GET /api/v1/health/live` reports process liveness; `/health/ready` reports 200
only when the configured runtime role can access the required schema, otherwise
503. The existing `/api/v1/health` remains the I00 frontend's liveness proof.
See [backend implementation notes](backend/README.md) for persistence boundaries.

## Identity development (I02)

Copy the backend/frontend environment examples into their ignored local files.
Generate `IDENTITY_SECRET_KEY` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Use the backend example's `NODE_ENV=development`, `IDENTITY_COOKIE_MODE=loopback`
and exact `IDENTITY_ALLOWED_ORIGINS=http://localhost:3000`; frontend development
uses `ACCOUNT_COOKIE_NAME=lumical_session_dev` for server bootstrap. Keep the
same host spelling in the browser and allowlist. Then run `pnpm dev` and visit
`/register`, `/login` or `/account`. Password recovery is not implemented.

Development rewrites route `/api/*` directly to Nest. Compose builds a separate
HTTP gateway which routes `/api/*` to Nest and other paths to Next; it preserves
Origin, CSRF and Set-Cookie without implementing business authentication. Its
frontend port is loopback-only. Compose uses production Secure cookies and
requires HTTPS termination preserving client socket addresses at the gateway for
a deployed browser journey. A further HTTP proxy that replaces every source with
its own socket address is not the supported source-isolation topology. Compose
trusts only its fixed `LUMICAL_GATEWAY_IP`; direct development trusts no proxy.
Set `IDENTITY_ALLOWED_ORIGINS` to that exact HTTPS origin; HTTP loopback
cookie mode is rejected in production. The exposed loopback backend port is for
local diagnostics and should stay private in deployed topology.

`pnpm contract:generate` builds Nest OpenAPI and derives frontend types.
`pnpm contract:check` detects drift. `pnpm test:identity` runs durable-session,
security and controlled-race checks in disposable PostgreSQL. `pnpm verify`
includes both I01/I02 database suites, contract checks and gateway routing tests.
Admin roles are assigned only by an authorized operator using a separately
controlled database connection; there is no role-assignment HTTP endpoint.

## Verification

```sh
pnpm peers check
pnpm typecheck
pnpm lint
pnpm test                     # frontend + backend unit tests and Nest e2e
pnpm --dir backend test:e2e    # e2e alone
pnpm build
pnpm test:db                   # disposable real PostgreSQL, migrations and integrity
pnpm test:docker               # builds Compose images, tests readiness/outage, cleans its own project
pnpm verify                   # typecheck -> lint -> test -> build -> test:db; CI contract
```

Package scripts remain available via `pnpm --dir frontend ...` and
`pnpm --dir backend ...`; frontend watch tests use `pnpm --dir frontend test:watch`.
GitHub Actions installs the pinned tools and frozen lockfile, checks peers and
runs `pnpm verify`; its Docker job runs `pnpm test:docker`. Both database scripts
generate ephemeral credentials and unique resource names, then check ownership
before cleanup. They never use a developer's database URL or volume. Never
disable checks to get a green build.

## Team workflow and authorities

Start with [docs/README.md](docs/README.md). Everyone then reads
[Product Scope](docs/PRODUCT_SCOPE.md) -> [Business Rules](docs/BUSINESS_RULES.md) ->
[Architecture](docs/ARCHITECTURE.md) -> [Development Workflow](docs/DEV_WORKFLOW.md).
Frontend contributors continue with [Design System](docs/DESIGN_SYSTEM.md) ->
[Frontend Standards](docs/FRONTEND_STANDARDS.md) -> [API Contract](docs/API_CONTRACT.md).
Backend contributors read [Database](docs/DATABASE.md) ->
[Backend Standards](docs/BACKEND_STANDARDS.md) -> API Contract.
Use [Testing Strategy](docs/TESTING_STRATEGY.md), [Roadmap](docs/ROADMAP.md) and
the relevant ADRs alongside your ticket.

Work on short-lived ticket branches from `main`, use conventional commits,
run verification and obtain teammate PR review before merging. Authorities
remain frozen; propose coordinated authority changes through review.
Never commit real `.env` files, secrets, participant content or build output.

Intentional deferrals: **auth = I02**,
**AR technology spike = I03**. Product UI, full Design System, provider
integrations and deployment are outside this foundation task.
