# LumiCal

A university software engineering project for personalized twelve-month memory
calendars. This repository currently contains the **I00 team-ready foundation**.
The temporary frontend page and technical health endpoint support setup only.

## Requirements and installation

- Node **24.21.0** (see [.nvmrc](.nvmrc)); select this version before running pnpm.
- pnpm **11.22.0**, pinned in `packageManager`.
- Docker with Compose v2 for the optional container workflow.

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

Defaults work without environment files. For overrides, copy
`frontend/.env.example` to `frontend/.env.local` and `backend/.env.example` to
`backend/.env`. Next loads its env file; the backend `dev` script uses Node's
native env-file support. Restart after changing environment values. If changing
the backend port, update frontend `BACKEND_URL` to match.

Open `http://localhost:3000/api/v1/health` to check the same-origin path through
Next to Nest. `BACKEND_URL` is server-only; browser calls stay on `/api/v1`.
An unreachable or invalid backend response becomes a controlled, uncached 502.

## Docker

```sh
docker compose up --build -d
docker compose down
```

Defaults expose frontend on 3000 and backend on 3001. Copy root `.env.example`
to `.env` and set `FRONTEND_PORT=3100`, `BACKEND_PORT=3101` to override host ports.
Container ports stay fixed; Next reaches Nest at `http://backend:3001`.
These are production-style containers; use `pnpm dev` for normal coding.
Run Compose from this repository and manage only its project; never prune or
stop unrelated Docker projects.

## Verification

```sh
pnpm peers check
pnpm typecheck
pnpm lint
pnpm test                     # frontend + backend unit tests and Nest e2e
pnpm --dir backend test:e2e    # e2e alone
pnpm build
pnpm verify                   # typecheck -> lint -> test -> build; CI contract
```

Package scripts remain available via `pnpm --dir frontend ...` and
`pnpm --dir backend ...`; frontend watch tests use `pnpm --dir frontend test:watch`.
GitHub Actions installs the pinned tools and frozen lockfile, checks peers and
runs `pnpm verify`. Never disable checks to get a green build.

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

Intentional deferrals: **DB/Prisma = I01**, **auth = I02**,
**AR technology spike = I03**. Product UI, full Design System, provider
integrations and deployment are outside this foundation task.
