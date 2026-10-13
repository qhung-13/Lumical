# LumiCal backend

See the [root README](../README.md) for pinned tools, installation, environment
files, Docker and the shared quality gate.

From the repository root:

```sh
pnpm dev:backend
pnpm --dir backend test
pnpm --dir backend test:e2e
```

Development loads an optional `backend/.env` using Node's native env-file support.
`PORT` defaults to 3001; the server listens on `0.0.0.0` for container access.
All REST routes use `/api/v1`; `GET /api/v1/health` returns
`{"status":"ok","service":"lumical-backend"}`. It is a technical liveness check.

`src/modules/health` is the only HTTP module. `src/common` holds future shared
technical code; `src/config` holds app configuration. Future business modules use
the interface/application/domain/infrastructure boundaries from
[Backend Standards](../docs/BACKEND_STANDARDS.md) and
[Architecture](../docs/ARCHITECTURE.md).

Auth (I02), AR technology selection (I03) and provider integrations remain
deferred. There are no business endpoints or runtime OpenAPI endpoints yet.

## I01 persistence implementation

PostgreSQL **17.11-bookworm**, Prisma CLI/client/pg adapter **7.10.0**, `pg`
and its types **8.23.1** are pinned. Prisma's Node/TypeScript requirements match
Node 24.21.0 and TypeScript 6.0.3; it has no Nest peer requirement. Framework
versions remain unchanged. Generated CommonJS Prisma code stays ignored under
`src/platform/database/infrastructure/generated` and is regenerated before
build/typecheck/test. No frontend or application port imports Prisma types.
`prisma.config.ts` supplies migration configuration; generation needs no DB URL.

Migration order preserves I01 slices: current work (P03), commerce/history
(P04), access/execution (P05), then runtime grants/row guards. PostgreSQL bootstrap
creates the `lumical` schema owned by `lumical_migration`; neither migration nor
runtime role is superuser, can create databases, or administer roles. Only the
migration role owns schema objects. `DATABASE_URL` requires `lumical_runtime`;
`MIGRATION_DATABASE_URL` requires `lumical_migration` and is used only by the
CLI. The runtime container receives only runtime credentials. Privileges must
be reviewed in each future migration; newly created tables have no automatic
runtime grants. Use `db:migrate` (`migrate deploy`), never schema push or reset.

| Authority | Prisma/schema protection | SQL-only protection | Future application/transaction responsibility |
| --- | --- | --- | --- |
| INV-01/03, BR-PRJ-001 | Non-null owner, composite project/media/owner FKs; stable captured revision | Restricted update columns protect IDs/owner/baseline | Authorize every read/write; normalize account emails before insertion |
| INV-02, BR-PRJ-003 | Unique Project/Month and snapshot/Month | Month 1–12, media slot 0–3, PostgreSQL civil dates | Atomically create/snapshot exactly twelve; zero Special Dates is valid |
| INV-05/11/14, BR-TPL-002/004, BR-ORD-002, BR-PRJ-006/007 | Relational snapshots; pinned media/target FKs; all deletes/updates RESTRICT | Snapshot/revision append-only grants; finalized media/artifact row guards | Active-template creation check; Order readiness; archive ordered Projects; authorized end-of-demo cleanup |
| INV-06/07/10/13, BR-ORD-001/003, BR-PAY-001–005 | Unique settlement Order/attempt/provider capture; same-Order/provider composite FK | USD BIGINT safe range, exact total, quantity 1–10, zero adjustments; sandbox; one unresolved attempt/open checkout slot | Verify adapter evidence, compare amount to Order, serialize completion and release checkout intent; no blind provider retry |
| INV-04/08/12, BR-SHR-001/003/004/005 | One share per Order; lease bound to share and immutable version | Positive generation, digest/revocation shape and 24-hour lease expiry checks | Check current generation/owner/status/settlement on every request; keyed digests, safe DTOs, CSRF |
| INV-09, Architecture §18 Admin/fulfillment audit | State plus append-only events/audit, scoped Order inspection | Runtime cannot update/delete audit; inspection purpose/reason/15-minute expiry | Permission and settlement gates, audit atomically, redact private content |
| API §11, durable execution | Actor/operation/key, provider/event and job-operation uniqueness | Paired encrypted replay with at most 24-hour expiry; lease/claim shape | Canonical request digests, encrypted envelopes, retention, safe evidence and result projection, worker claims/recovery |

Money is `bigint`, including Prisma reads. Future API projections must verify
safe integer bounds before converting to JSON numbers; never serialize a Prisma
row directly or use floats. CHECK constraints enforce row structure, not
cross-row provider evidence, authorization or child counts. Current changes do
not freeze Projects after ordering. Snapshot displays must read captured rows.
Old recipient lease rows intentionally survive rotation: an FK to the mutable
generation would prevent rotation; the future access use case checks equality.

`Transactions` exposes only an opaque context. Infrastructure
`PrismaTransactions.clientFor(context)` resolves the same transaction client
for all participating adapters and rejects foreign/finished contexts. Transactions
use Serializable isolation with bounded waits; callers must explicitly handle
conflicts rather than blindly retry changed user intent. Nested `run` calls join
the active context in their async chain; only the outer call commits or rolls
back. There are no nested savepoints: propagate an error to the outer boundary
to abort all writes. Independent async chains receive independent transactions;
inherited finished contexts fail without opening another transaction.
No generic repositories
or feature behavior have been added.

## Seeds, fixtures and verification

After build and migration, `pnpm --dir backend db:seed` runs deterministic seed
through the restricted runtime role. It creates two disabled `example.invalid`
owners with unusable password markers and one inactive bilingual synthetic
Template revision. Duplicate execution changes no timestamps/data; an identity
collision fails instead of rewriting accounts/history. No Ready media, target,
payment or share facts are seeded. Factories under `test/database` label all
fake provider facts `TEST ONLY`; these are persistence tests, not acceptance of
any provider or device.

`pnpm test:db` builds the backend then uses a uniquely labelled, tmpfs-backed
PostgreSQL container, random credentials and an ephemeral loopback port. It
proves empty and repeated setup, upgrade from the initial migration with data,
runtime DDL denial, negative FKs/uniques/checks, immutable history and restricted
deletion, seed convergence, Prisma rollback/context, and a synchronized real
checkout race. Ordinary Jest and e2e tests stay fast; e2e tests use the technical
availability port while integration tests use actual PostgreSQL. An unavailable
database, missing URL or invalid role returns readiness 503 with `{ready:false}`;
liveness returns `{alive:true}` without probing providers. Readiness checks all
30 required table names and proves schema/table SELECT access with
`SELECT 1 FROM lumical.users LIMIT 0`, which reads no private rows.

`pnpm test:docker` builds frontend/backend/migration images in a unique Compose
project, holds fresh initialization behind a release barrier to prove TCP health
and migration/backend startup ordering, and proves frontend proxy compatibility.
The PostgreSQL healthcheck authenticates the runtime role over final TCP and
checks schema access plus migration ownership; host setup uses Compose `--wait`.
The smoke test then
stops its PostgreSQL to prove 503 readiness/200 liveness, then removes only that
project's resources. Database initialization scripts require LF line endings.
Neither script touches existing project databases or global Docker resources.

## I02 Identity implementation

`modules/identity` separates pure credential/session policies, application
use cases and ports, HTTP mapping/DTOs, and Prisma/cryptographic adapters.
The exported `ActiveAccounts` port supplies an active account identity plus
the caller's joined transaction; it grants no ownership or recipient authority.
Its caller owns retry of the complete consuming workflow and keeps provider
calls outside the transaction. Identity endpoints retry complete root database
operations at most three times for serialization/deadlock conflicts, including
raw PostgreSQL lock failures; no external effect occurs inside those retries.

Password hashing uses stable Node 24 `node:crypto` scrypt with N=131072, r=8,
p=1, a fresh 16-byte salt and a 64-byte result. It follows the
[OWASP scrypt baseline](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).
Two active hashes and sixteen waiting requests bound resource use; overload is
429. Unknown/disabled synthetic hashes perform the same scrypt work. Passwords
are never trimmed or truncated; 12–128 Unicode code points and arbitrary
passphrases are accepted. Only normalized email is transformed.

The required random 32-byte `IDENTITY_SECRET_KEY` domain separates HMAC-SHA256
session digests, CSRF derivation/binding, request digests and replay encryption.
Sessions use 32 random bytes. Only keyed digests enter Session rows; CSRF tokens
are deterministically reconstructed from the relevant cookie and stay in browser
memory. Registration keys are scoped to the account identified by normalized
email. Exact request replay restores the original live session from AES-256-GCM
encrypted, account/intent/request-bound replay for at most 24 hours. Changed
requests, expired replay or revoked sessions conflict and cannot resurrect access.
No raw session or password is stored in IdempotencyRecord outcomes.

Each protected access locks/rechecks both account and session. Activity is
updated at most once per minute; idle expiry is capped at the original seven-day
absolute expiry. Logout revokes the current row; login rotates the current
cookie/session after fresh credential/status validation. Disable changes status,
revokes all sessions, suspends active share metadata and writes append-only audit
in one transaction. Re-enable never revives account sessions. Share restoration
requires explicit operator intent and an unrevoked credential plus settlement;
revoked shares remain revoked. No recipient flow is implemented. Audit reason
uses the existing `purpose` column; status reads are also audited.

Abuse protection is per backend process without external infrastructure:
`IDENTITY_AUTH_ATTEMPTS` defaults to 10 per normalized-email bucket, with a 5x
IP aggregate; `IDENTITY_AUTH_WINDOW_SECONDS` defaults to 600 and
`IDENTITY_AUTH_BUCKETS` to 10000. All attempts count equally for existing/unknown
accounts. Bucket keys are HMAC digests, expired buckets are removed and capacity
exhaustion fails closed. Restart clears this technical limiter; durable sessions
and revocation remain database-owned. Request payload bounds
(email 254, reason 1000 characters, intent keys 16–128 safe characters) are
technical limits, not additional business permissions.

`/api/v1/openapi.json` exposes versioned HTTP metadata with UI disabled.
`openapi.json` and frontend generated types are derived from Nest DTOs; credentials
are write-only and unknown mutation properties are rejected. HTTP errors/logs
contain safe codes and server-generated request IDs. Startup refuses missing or
unsafe identity configuration. Deployed cookies use the approved `__Host-` name
and Secure/HttpOnly/SameSite=Lax/Path=/ without Domain; the sole non-Secure
exception is explicit development mode with exact HTTP loopback origins.
That mode also binds the backend listener to loopback. Production binds the
container network and requires HTTPS termination at the deployment edge.

Gateway source isolation uses `IDENTITY_TRUSTED_PROXY_IPS`: an empty default for
direct development, or a comma-separated list of exact immediate gateway IPs.
CIDRs, wildcards and blanket `trust proxy` values are rejected. Express trusts
only hop zero from that list; direct requests from other peers ignore forwarding
headers. Compose assigns `LUMICAL_GATEWAY_IP` on `LUMICAL_NETWORK_SUBNET` and
configures that exact address in Nest. `LUMICAL_DYNAMIC_IP_RANGE` reserves the
upper half for dynamic services so they cannot take the gateway's lower-half IP.
Change all three variables together if the private subnet overlaps another
network. The diagnostic backend port stays
loopback-only and its host bridge address is not trusted.

The gateway removes supplied `X-Forwarded-*`, `Forwarded`, `X-Real-IP` and other
common client-address headers, then writes `X-Forwarded-For` from its accepted
socket. It never accepts a browser-supplied address chain. The limiter normalizes
IPv4-mapped IPv6 and IPv4 to one identity; normalized-email buckets remain
independent. The gateway must receive each client's socket address: HTTPS
termination must preserve those source addresses. A conventional additional HTTP
reverse proxy which collapses sockets to its own IP is not this supported topology.

Email and audit reasons reject NUL/unpaired Unicode surrogates before hashing or
persistence, with 422 field errors. Valid Unicode and password semantics remain
unchanged. Known-length and streamed oversized JSON retain the parser's size
limit and return safe, non-retryable 413 `VALIDATION_FAILED`; malformed JSON is
still 422 and unrelated exceptions remain 500. Auth OpenAPI documents 413.
