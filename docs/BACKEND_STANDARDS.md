# LumiCal — Backend Standards

Status: **Approved/frozen R04 implementation standard**. Stack: NestJS + TypeScript + PostgreSQL + Prisma. Follow [Architecture](ARCHITECTURE.md), [Database](DATABASE.md), [API Contract](API_CONTRACT.md), and [Business Rules](BUSINESS_RULES.md).

## 1. Responsibilities

Backend owns active-principal authorization, input/domain validation, twelve-Month creation, readiness, USD pricing, immutable snapshots, payment evidence, revocation/private delivery, simulated Fulfillment, retention and audit. External providers own only their facts; client data is input, not proof.

## 2. Internal architecture

Modular monolith with interface, application, domain and infrastructure boundaries. Plain rule functions/policies/value types are enough where they carry meaning. Avoid DDD ceremony, event-sourcing/CQRS platform or microservices. No controller or ORM model becomes the business authority.

## 3. Module structure

```text
src/
  modules/<business-module>/
    interface/          HTTP DTOs, controllers, transport mapping
    application/        use cases, ports and orchestration
    domain/             pure policies, transitions, typed business errors
    infrastructure/     Prisma repositories, provider adapters
  platform/             composition, configuration, clock, transaction,
                        request IDs, error/logging, durable job runner
```

Modules match Architecture §7. Identity/Templates/Projects/Media/AR/Orders/Payments/Fulfillment/Sharing/Admin are P0; recovery/Notifications P1 and Contributions P2 are isolated. Platform holds no feature-specific pricing/status logic.

## 4. HTTP interface

Controllers authenticate/parse, call one application use case, map safe response/error and status. Guards establish account/CSRF/origin context, not blanket object permission. Use cases still check owner/share/Admin purpose. Controllers contain no pricing formula, payment state machine, snapshot copy or Prisma query.

## 5. Application layer

Use cases own one documented operation, validate contextual authority, orchestrate domain policies/ports, define transaction boundary and return typed result. Pass actor, Clock, expected version and idempotency intent explicitly. Provider work occurs outside short transactions with durable operation intent. No transport objects in domain policies.

## 6. Domain rules

Trace important policies to BR IDs: Project Working/Archived, Order readiness with optional events, one reliable AR reveal including image, exact cents, legal Payment/Fulfillment transitions and recipient isolation. Keep pure behavior testable without NestJS/Prisma. No business rules duplicated in handlers/repositories/provider adapters.

## 7. Infrastructure

Implement repository/transaction/provider ports behind composition. Translate ORM/provider errors to canonical typed failures. Safe metadata only; no raw ORM exceptions or provider payload through HTTP. Provider-specific identifiers/configuration are adapter concerns.

## 8. Repository boundaries

Expose owner-scoped work reads, consistent snapshot capture, versioned writes, settlement insertion and scoped media retrieval; no generic repository that permits arbitrary entity edits. Repositories take transaction context where required. Snapshot repositories allow inserts/read only to normal app path. Use case chooses allowed operation; repository does not impersonate actor.

## 9. DTOs

Explicit input/output DTOs tied to OpenAPI, never Prisma types. Reject unknown fields, validate shape/limits, return minimal appropriate projections. Recipient DTO cannot extend owner Order DTO. Admin DTO has purpose-limited contact/payment facts but no share secret or unrelated draft. Monetary DTO uses integer USD minor units.

## 10. Validation

Transport shape validation plus backend/domain authority for email normalization, year/date, exact twelve Months, owned Ready media, active Template, quantity, captured price and target/version binding. UI assistance never bypasses checks. Size/duration determined by trusted provider inspection, not user declarations. Special Date zero is valid for an otherwise ready Order.

## 11. Authorization

Every private read/write validates current active account, object owner or explicit recipient generation; identifier knowledge is insufficient. Safe 404 for cross-owner identifiers. Admin role allows operational methods only, never owner-content editing. Backend streaming checks access again per GET/HEAD/range. Password reset/disable invalidate sessions; share suspension is enforced even if lease row remains.

## 12. Transactions

Implement Architecture §16 as reviewed transactional use cases: Project+twelve Months; every edit+root revision; Place Order+relational snapshot+pins+Waiting Fulfillment+idempotency; attempt intent; verified completion+unique settlement; cancellation; share generation; Admin transition+history+audit; Template publication and account disable. All collaborators share one transaction context. Never make provider network calls while holding database locks.

## 13. Concurrency

Project-root locking/expected version coordinates child writes and immutable snapshot capture. Order-root locking serializes payment/start/cancel/fulfillment; unique settlement is final protection. Share generation/version serializes rotation/revocation. Bounded retry for serialization/deadlock uses same intent. Interactive stale content yields 412 for review, no silent last-write-wins.

## 14. Idempotency

Persist actor/operation/key plus canonical request digest (including original expected/reviewed version) and resource/outcome atomically. Changed request conflicts. After current authorization, an accepted replay resolves before stale-version validation; new intents need current preconditions. Same checkout/payment/share/upload intent does not create unintended duplicates. Settlement/final unpaid cancellation releases the open-checkout slot in the same transaction; an existing Order is never rewritten to accept changed quantity/contact. Provider request IDs persisted before external work and reused. Completion intake deduplication plus unique settlement tolerates late/repeated webhook/status results. Expired raw share replay never regenerates without owner intent.

## 15. Prisma usage

Prisma only in infrastructure and backend-generated client. Pin compatible supported version at I00; all environments PostgreSQL. Review generated migrations and database-specific constraints/indexes; no deploy `db push`, no SQLite shortcut. Explicit selections/projections, no raw query string interpolation. Required locks/constraints that exceed ORM expression live in reviewed migration/repository implementation, never in controllers. ORM models are persistence structures, not domain APIs.

## 16. Payment adapter

PayPal Sandbox behind PaymentGateway, sandbox-only configuration and USD. Stable create/capture operation identity, correct provider binding/account/environment/amount and trustworthy evidence. Browser approval signal may prompt verification, never Completed directly. Verify webhook before durable intake. Unknown status remains uncertain until provider recheck; Failed/Cancelled only definitive. No refund/real money/Admin success override.

## 17. Media adapter

Cloudinary initial MediaStorage adapter with private authenticated uploads and immutable non-overwriting content keys. Finalize only after provider metadata/ownership/category limits checked. Backend stream proxy keeps provider delivery signatures internal and checks current access; public Template media separate. Cleanup checks all historical/current references; repeated finalization yields one asset. Account/provider protection verified before real participant uploads.

## 18. AR adapter

No SDK until early spike. Preparation port reports target artifact/source revision and Ready/Unavailable; private artifact retrieval and recognition resolve only authorized version. An image+message is a valid P0 reveal. Wrong/ambiguous target reveals nothing private; same authorized fallback. Preserve existing ordered artifacts when current configuration changes.

## 19. Email adapter

EmailSender exists as a port only until P1 recovery. Recovery messages contain bounded single-use mailbox proof and safe expiry; no email enumeration, marketing or verification workflow added. Local capture/test email adapter for integration tests; no P0 dependency on live email delivery.

## 20. Errors

Domain error vocabulary maps centrally to API envelope; expected validation/state/permission failures are not uncontrolled exceptions. Preserve correlation ID and safe retryability. Unavailable provider is distinct from rejection; uncertain payment result never falsely failed/completed. No stack, credentials or raw provider error to client.

## 21. Logging

Structured operation/request IDs, actor category, safe entity IDs, latency/error code. Redact password/cookie/token/CSRF/share credentials, personal text/contact and provider secrets. Avoid logging full request/response bodies. Useful counters for pending payment verification, failed jobs, invalid transitions; no enterprise monitoring requirement.

## 22. Audit

Append-only Admin action/access events and Fulfillment transitions. Content inspection requires concrete purpose/reason and short-lived actor/Order grant; no generic draft access. Record rejected sensitive operations safely. Payment provider evidence is distinct from operator claims and application logs.

## 23. Secrets/config

Backend validates database URL, cryptographic keys, exact origin allowlist, provider sandbox/webhook identity, private media configuration and frontend return origin. Secrets never in OpenAPI, frontend env, logs or fixtures. P1 email config required only when enabled. Separate environment credentials and least-privilege migration/runtime DB roles.

## 24. Security

Adaptive password hash, strong random opaque identifiers, keyed secret digests, cookie flags, synchronizer CSRF+Origin, limits/rate controls, validated upload metadata, trusted URL allowlists and signature verification. Prevent arbitrary URL proxying/SSRF. Parameterize all persistence. Recipient lease and account session are distinct authority contexts.

## 25. Background/retry work

Durable PostgreSQL JobRecord/ProviderEventInbox polled by same-build worker or controlled backend runner. Transaction writes intent; worker acquires bounded lease, calls provider, commits verified result, retries transient failure with backoff. No blanket retry of capture/create without stable provider identity. Crash/restart after an external success checks outcome first. Exhausted retries remain observable/uncertain and may be refreshed by authorized user/Admin; no manual mark paid. P1 notification jobs follow committed facts.

## 26. Tests

Jest for backend/domain, Supertest for Nest HTTP, disposable PostgreSQL with applied migrations for repositories/transactions. Provider fakes model delayed, duplicate, wrong amount/environment and uncertain results. Sandbox/device acceptance separate from fakes. See Testing Strategy invariant matrix. Do not use SQLite/mocked Prisma as evidence for transaction integrity.

## 27. Naming

Business-language modules and use cases (`PlaceOrder`, `VerifyPaymentOutcome`, `RotateRecipientShare` conceptually); `…Port/…Adapter`, input/output DTO names, specific errors. Avoid generic `updateStatus` that bypasses transitions. Canonical API status vocabulary translated at UI, not mixed with Vietnamese database state strings.

## 28. Forbidden patterns

Controller pricing/state logic; generic Admin draft editor; ORM object-as-DTO; provider imports in domain; network call in transaction; frontend boolean as evidence; public private-media URL; silent status overwrite; mutable Project for recipient Order display; unreviewed schema synchronization; blind payment retry; out-of-scope/social feature dependency.

## 29. Module collaboration rules

Use the Architecture §7 graph: Projects consumes immutable Template baseline/Media/AR facts; Orders consumes consistent Project capture; Payments consumes fixed Order obligation; Fulfillment consumes settlement and closes Order through orchestration; Sharing consumes paid snapshot/current owner; Admin invokes public application commands. Identity exposes active principal and suspension checks. Avoid cycles by extracting orchestration, not moving domain rules into a global shared module.

## 30. Review checklist

Rule/INV traceability, authoritative permission check, typed DTO, transaction/lock/version/key, money and evidence verification, immutable content pins, safe recipient projection, audit/redaction, bounded retry, reviewed PostgreSQL migration and meaningful integration tests. Review actual affected modules with teammates; no extra layers created solely to satisfy a folder template.
