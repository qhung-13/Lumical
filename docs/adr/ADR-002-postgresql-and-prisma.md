# ADR-002 — PostgreSQL, Prisma and migration history

## Status

**Accepted**; technical baseline specified for the new project.

## Context

LumiCal depends on consistent snapshot capture, exact money, normalized unique email, twelve Months, one share generation and unique payment settlement. Dev/test/demo must exercise the target database's transaction and constraint behavior. The new repository starts without an existing database to preserve or baseline.

## Decision

PostgreSQL with Prisma inside backend infrastructure, supported compatible versions pinned at I00. Begin with a reviewed initial migration from an empty PostgreSQL database; all changes/indexes/database-specific protections are migration history. No deploy schema-push strategy. Repository/application interfaces do not expose Prisma models. Real PostgreSQL integration tests cover constraints/locking/rollback; no SQLite environment substitutes.

Core business data and Order snapshots are relational; bounded provider/layout metadata may use schema-versioned JSON. Exact USD integer minor units. Unique settlement and scoped snapshot/media references protect historical truth. Cross-row rules remain explicit backend transaction responsibilities.

## Options considered

- SQLite dev/test with PostgreSQL demo: different concurrency/constraint behavior would mask high-risk failures; rejected.
- ORM schema synchronization without migrations: cannot review reproducible upgrade/data-loss history; rejected.
- PostgreSQL with hand-managed persistence only: possible but not chosen user baseline; Prisma offers typed infrastructure while reviewed migration features cover its limits.
- Entire snapshot JSON: easy copying but weak reference/retention traceability; relational children chosen.

## Consequences

Developers need PostgreSQL/disposable integration environment and migration review discipline. Some PostgreSQL constraints may require reviewed migration-level expression beyond ORM convenience. Applied migration files remain immutable. Environment initialization and deployment follow reviewed migration history.

## Risks

Concurrent migration conflicts, unsupported ORM-specific index/lock expression, destructive change. Pin/tool verification, reviewed migration artifacts, blank+upgrade tests and least-privilege runner address them. Snapshot cleanup requires explicit end-of-demo authority.

## Revisit triggers

Demonstrated tooling incompatibility or required unsupported persistence behavior. Database change requires reassessing all invariant/concurrency tests, not merely swapping a connection URL.

## Related authorities

[Database](../DATABASE.md), [Architecture](../ARCHITECTURE.md), [Backend Standards](../BACKEND_STANDARDS.md), [Testing Strategy](../TESTING_STRATEGY.md), [Development Workflow](../DEV_WORKFLOW.md).
