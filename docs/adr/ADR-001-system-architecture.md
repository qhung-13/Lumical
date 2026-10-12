# ADR-001 — Separate frontend and modular-monolith backend

## Status

**Accepted**; follows the approved technical baseline. No applications are initialized by this ADR.

## Context

LumiCal requires private editable Projects, immutable Orders, provider-verified sandbox payments and paid-version recipient AR. A university team needs clear authority boundaries and one manageable backend deployment. Approved business behavior cannot live only in browser rendering.

## Decision

Separate Next.js/React/TypeScript App Router frontend and NestJS/TypeScript backend. Backend is a modular monolith with REST/JSON `/api/v1` and OpenAPI. Interface→application→domain/ports→infrastructure; frontend business reads, including SSR, cross the backend HTTP contract. Same-origin HTTPS proxy routes API to NestJS; PostgreSQL is backend-only. Domain code is independent of frameworks/provider SDKs. Durable backend database jobs handle necessary external retry work without broker infrastructure.

## Options considered

- Next.js-only full-stack: fewer containers, but contradicts required frontend/backend separation and frontend-only role.
- Microservices: independent service deployment adds distributed transactions/operations without a product need.
- Separate frontend plus modular monolith: chosen; explicit typed boundary with one transactional backend and pragmatic internal modules.

## Consequences

Both apps have independent builds and coordinated contract changes. HTTP/DTO discipline costs more than direct ORM rendering, but enables separate team ownership, safe recipient projections and authoritative business testing. No duplicated Next.js business API or direct frontend DB connection.

## Risks

Contract drift, over-layering and module cycles. Reviewed OpenAPI/generated client, application orchestration and narrow module interfaces address them. Private SSR cookie forwarding/no-store must be tested.

## Revisit triggers

A concrete measured deployment/scale need or approved technology constraint—not preference for additional services. Changing separation needs coordinated authority/ADR review.

## Related authorities

[Architecture](../ARCHITECTURE.md), [API Contract](../API_CONTRACT.md), [Frontend Standards](../FRONTEND_STANDARDS.md), [Backend Standards](../BACKEND_STANDARDS.md), [Business Rules](../BUSINESS_RULES.md).
