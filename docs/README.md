# LumiCal — Authority Documentation

This folder is the standalone implementation baseline for a **new LumiCal university project**: personalized twelve-month memory calendars, explicit recipient AR/fallback, international sandbox ordering and simulated Admin fulfillment. It contains the complete authority documentation needed by the implementation team.

Status: **Approved/frozen coordinated R04 authority baseline — R04 DONE**. Product Scope, Business Rules, Design System and derived technical authorities are accepted as the implementation source of truth for creation of the new repository. All five ADRs are Accepted; the AR provider boundary is accepted while technology selection remains delegated to mandatory I03. No new application/repository/schema/test has been created by this documentation phase.

## 1. What these documents are

Product Scope defines **what** exists; Business Rules defines permitted behavior; Design System defines visual/accessibility behavior. Architecture, Database, API and coding/testing/workflow authorities make those decisions implementable. Roadmap defines dependency and acceptance order. ADRs retain major technical rationale. Together they define LumiCal's implementation contracts.

[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) is the approved visual and accessibility authority for frontend implementation. All authority-document references resolve within this pack; external standards and provider references supply supporting technical guidance.

## 2. Source of truth and decision ownership

**Approved authority for its decision > ADR within that authority > implementation > comments/temporary notes.** Authorities have complementary scopes; there is no permission for a technical document to override Product Scope, Business Rules or frozen visual decisions. A contradiction pauses the affected decision, is reported, and needs the smallest reviewed authority change.

| Document | Owns |
| --- | --- |
| [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md) | Capabilities, priorities, exclusions and official demo promise. |
| [BUSINESS_RULES.md](BUSINESS_RULES.md) | Actors/ownership, validation, readiness, lifecycle, pricing/currency, payment evidence, privacy/idempotency invariants. |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Approved tokens, typography, layout/layers/motion, components, themes and accessibility criteria. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Container/module/port boundaries, execution responsibility, security and transactional strategy. |
| [DATABASE.md](DATABASE.md) | Persistent relational model, constraints/indexes, snapshots, sessions, media/history and migrations. |
| [API_CONTRACT.md](API_CONTRACT.md) | REST resources, wire schemas/status/error vocabulary, cookies/CSRF, concurrency and retry contract. |
| [FRONTEND_STANDARDS.md](FRONTEND_STANDARDS.md) | UI code organization, typed API/query/forms, SSR/client behavior and DS consumption. |
| [BACKEND_STANDARDS.md](BACKEND_STANDARDS.md) | Authoritative use cases/domain rules, infrastructure/provider adapters, validation/audit/transactions. |
| [TESTING_STRATEGY.md](TESTING_STRATEGY.md) | Planned proof of Product/BR/INV and technical behavior, provider/device evidence and Definition of Tested. |
| [DEV_WORKFLOW.md](DEV_WORKFLOW.md) | Tickets, branches, review/change process, CI/migration/dependency and Done gates. |
| [ROADMAP.md](ROADMAP.md) | Milestone dependencies, deliverables/acceptance/non-goals and early mandatory AR spike. |
| [adr/](adr/) | Technical options, consequences and revisit rationale; no business-rule overrides. |

## 3. Reading order

Everyone reads Product Scope → Business Rules → Architecture → Development Workflow.

Frontend then reads Design System → Frontend Standards → API Contract. Backend/database contributors read Database → Backend Standards → API Contract. Testers read Testing Strategy alongside both contracts and Design System. Everyone uses Roadmap for the current milestone and reads ADRs for architectural rationale. OpenAPI generated later must match API Contract; it does not grant authority to change behavior independently.

## 4. Shared baseline

Next.js/React/TypeScript App Router is frontend-only, including SSR through backend HTTP. NestJS/TypeScript REST/JSON modular monolith owns business behavior. PostgreSQL + Prisma, proper reviewed migration history in all environments. Backend-owned revocable opaque HttpOnly cookies, same-origin preferred and Origin/CSRF protections. TanStack Query for browser API state; no localStorage auth secret.

Cloudinary is the initial MediaStorage adapter with backend-controlled private delivery; provider-specific design stays out of domain. PayPal Sandbox is preferred PaymentGateway, USD end-to-end and backend evidence only. AR is mandatory but SDK is not selected: early I03 recognition spike proves viable target approach before final AR implementation. EmailSender is P1 recovery only. Structured request IDs/logging and durable database jobs suffice; no microservices/broker/Kubernetes requirement.

## 5. Decisions nobody may reinvent

- Exactly one non-transferable Project owner and exactly twelve conceptual Months, private by default. Placing an Order does not freeze the mutable Project: a Working Project may continue to be edited and may create later Orders. An Archived Project is read-only until restored to Working. Existing ordered versions remain immutable.
- Special Dates remain P0 functionality and the official demo shows one; **zero Special Dates is valid for an individual otherwise-ready Order**.
- One reliable genuine AR target/reveal remains required: image+meaningful message **or** short video+caption/transcript **or** short audio+transcript/caption. No every-media-type requirement; authorized fallback exposes same meaningful content.
- New Project requires active published Template; captured baseline survives deactivation. Order fixes historical calendar/template/media/AR/price/contact version. Intentional later Orders allowed; duplicate intent returns one.
- USD captured unit price × quantity 1–10, zero discounts/tax/shipping fee, no FX; frontend estimates are assistance.
- Payment attempts are separate, frontend return/Admin claim cannot mark Completed, one backend-verified settlement per Order; failed/cancelled attempts can retry the same unpaid Order.
- Admin-managed simulated Fulfillment is separate and requires verified payment before preparation; no real shipment or paid cancellation/refund P0.
- Sharing grants one paid immutable Order recipient version, one current revocable credential, anonymous read-only access. No Order/payment/contact/account or unrelated media disclosed; current share/account checks precede target/media reveal.
- Admin has least-privilege ordered-content support access with purpose/audit, no blanket draft/media edit. Historical data/media retain semester meaning; Business Rules governs cleanup.
- Recovery/notifications P1, wishes/blog/advanced AR/analytics P2, newsletter/reviews/blog comments/likes OUT. No optional extension becomes a required P0 dependency.

OUT means excluded from the current committed university implementation scope, not permanently forbidden. Promoting an OUT capability requires a future reviewed Product Scope revision after the mandatory product is stable; it does not change this baseline's P0/P1/P2/OUT commitments.

## 6. How to propose changes

Open a documentation PR/ticket stating the decision, justification, smallest change, related capability/BR/INV, affected derived docs/tests/API/migrations and reviewer. Scope/business/visual changes require their authority owner before implementation; technical changes get coordinated review and ADR where substantial. Preserve applied migration/ADR history and update affected contracts together. See Development Workflow §§8–12.

All five ADRs are **Accepted**: [ADR-001](adr/ADR-001-system-architecture.md) architecture, [ADR-002](adr/ADR-002-postgresql-and-prisma.md) PostgreSQL/Prisma/migrations, [ADR-003](adr/ADR-003-authentication-session-model.md) opaque sessions, [ADR-004](adr/ADR-004-paypal-sandbox.md) sandbox adapter/evidence, [ADR-005](adr/ADR-005-ar-provider-boundary.md) AR provider boundary/spike. AR technology/SDK is not yet selected; actual selection remains delegated to mandatory I03. Future decision changes follow the reviewed authority/ADR process.

## 7. Implementation gates and unresolved technology

First milestone is **I00 new repository/project foundation**; R04 is approved and DONE. Current implementation branch is none. This authority pack supplies the approved implementation baseline; this documentation patch does not authorize or perform repository initialization, application implementation, installation or deployment.

AR SDK/target-recognition technology remains deliberately unselected and blocks final AR integration until mandatory **I03** evidence. It does not block repository/database/identity foundation; downstream I07–I12 dependencies require the spike. Verify actual sandbox USD setup and private-storage account behavior at their adapter acceptance gates. Version pinning, hosting/configuration and exact SDK wiring are implementation tasks under these contracts, not unresolved product decisions. No additional business contradiction is assumed.

## 8. Cross-document traceability matrix

| Concern | Authority | Supporting docs | Must not be redefined by |
| --- | --- | --- | --- |
| Product scope/priorities/exclusions | PRODUCT_SCOPE | BUSINESS_RULES, ROADMAP | Technical docs, code, implementation assumptions |
| Business permissions/validation/lifecycles | BUSINESS_RULES | ARCHITECTURE, DATABASE, API_CONTRACT, TESTING_STRATEGY | Database enum, controller, frontend, provider |
| Visual system/accessibility | DESIGN_SYSTEM | FRONTEND_STANDARDS, TESTING_STRATEGY | Feature styles, theme override, snapshots |
| Architecture responsibilities/boundaries | ARCHITECTURE | ADR-001/003/004/005, FE/BE standards | Page/BFF, ORM convenience, provider SDK |
| Database model/constraints/migrations | DATABASE | ADR-002, BACKEND_STANDARDS, TESTING_STRATEGY | Ad hoc schema push, SQLite test shortcut |
| API transport/projection/errors/replay | API_CONTRACT | ARCHITECTURE, FE/BE standards, OpenAPI later | Component fetch or ORM model serialization |
| Frontend structure/UI state | FRONTEND_STANDARDS | DESIGN_SYSTEM, API_CONTRACT, TESTING_STRATEGY | Feature-local second backend/domain authority |
| Backend use-case/persistence/provider discipline | BACKEND_STANDARDS | ARCHITECTURE, DATABASE, API_CONTRACT | Controller rules or provider-dependent domain |
| Testing/evidence gates | TESTING_STRATEGY | BUSINESS_RULES, DS, API, ROADMAP | Mock-only pass claim or typecheck alone |
| Workflow/change approval | DEV_WORKFLOW | README, ROADMAP, ADRs | Individual unreviewed branch/temporary note |
| Roadmap/dependency order | ROADMAP | All authorities | Late unproven AR choice or optional-feature dependency |
| Immutable Order/current Project distinction | BUSINESS_RULES BR-PRJ/ORD, INV-05 | ARCHITECTURE §15, DATABASE §14, API Orders, Testing T05 | Live Project join, Template edit, frontend display |
| USD/backend pricing | BUSINESS_RULES BR-PRICE | DATABASE §11, API §6, Testing T07, ADR-004 | Browser total, provider currency conversion |
| Provider-only payment and one settlement | BUSINESS_RULES BR-PAY, INV-06/10/13 | ARCHITECTURE §13/16/17, DB settlement, API attempts, Testing T09–12 | Redirect, Admin flag, duplicate callback |
| Recipient paid version/revocation | BUSINESS_RULES BR-SHR, INV-04/12 | ARCHITECTURE §14, DB share/lease, API recipient, Testing T14/15 | Mutable Project share, public asset URL |
| Correct target/private content/fallback | BUSINESS_RULES BR-AR, INV-08 | ARCHITECTURE §12, API scoped targets, Testing T16/17/20, ADR-005 | Recognition SDK/global target lookup |
| Admin/simulated fulfillment | BUSINESS_RULES BR-ADM/FUL, INV-09 | ARCHITECTURE §18, DB history, API Admin, Testing T13/18/25 | General Admin draft editor, carrier claim |
| Sessions/disable/CSRF | ARCHITECTURE within BR-ID authority | ADR-003, DB sessions, API §2/3, Testing T22 | localStorage token or frontend route guard |
| Media retention/history | BUSINESS_RULES BR-MED/PRV | DATABASE §15/23, backend jobs, Testing T24/26 | Project deletion cascade or storage overwrite |

## 9. Global consistency audit

**PASS — final authority review patch and cross-document check, 2026-10-12.** Review below is of specifications and traceability, not runtime build/test/provider/device evidence. The approved authority pack contains seventeen Markdown files.

| Concern | Audit result / evidence |
| --- | --- |
| Product/priorities | PASS: twelve Months everywhere; optional per-Order event content while C07/demo remains required; AR P0; recovery/notifications P1; blog/wishes P2; newsletter/reviews/blog comments/likes remain OUT for the current semester commitment. P0/P1/P2/OUT priorities are unchanged. |
| Project/Order/history | PASS: Working Project remains editable after Order; Archived Project is read-only until restored; relational fixed Order snapshot and immutable media/artifact references; intentional repeats allowed after open-checkout slot release; duplicate intent cannot duplicate Order. |
| Price/currency | PASS: USD integer cents, captured baseline × quantity 1–10, zero discounts/tax/shipping fee, no FX; backend authority. |
| Payment | PASS: separate attempts and unique settlement, verified provider binding/evidence, frontend return is signal only, no Admin success control; durable retries/inbox/operation identities. |
| Fulfillment | PASS: separate Waiting/Preparing/Demo complete/Stopped; Admin-only simulated preparation after settlement; state/history/audit and Order closure atomic. |
| Sharing/privacy | PASS: paid ordered version, one current credential/generation, anonymous read-only lease, revoke/rotate checks at subsequent AR/media/fallback request; no private/Order/payment/contact leakage. Lease expiry does not expire underlying share. |
| AR | PASS: no SDK selected; image/video/audio alternative, one genuine prepared reveal, scoped target before content exposure, stable ordered artifact and same-content fallback; early I03 spike prerequisite. |
| Auth/security | PASS: backend opaque durable revocable cookie sessions, separate recipient lease, same-origin preference, Origin/CSRF, no localStorage auth secret; disabled account invalidates/suspends access. |
| Browser/provider boundary | PASS: backend owns provider secrets and authoritative verification/business operations; browser only uses explicitly authorized bounded upload, PayPal approval or I03-selected client-runtime flows. Browser/provider interaction alone is not business/payment proof; frontend has no database access and PostgreSQL remains backend-only. |
| Database | PASS: relational snapshot/twelve-child handling, exact money, suitable unique/index/lock protection, backend cross-row responsibility, retained historical data; PostgreSQL/migrations only; isolated P1/P2. |
| Admin | PASS: necessary ordered support inspection with purpose/audit and bounded grant, no draft editor/blanket media access, no payment completion override. |
| Design | PASS: clean authority has all **100 named token table rows and all color values unchanged** from the approved source; visual/component/accessibility decisions retained; packaging/audit dependencies removed. Frontend standards use this authority without duplicating token values. |
| Tests | PASS: every INV-01..INV-14 has explicit Database protection mapping and planned testing-layer/scenario coverage; genuine sandbox/device gates distinguished from fakes and presentation recordings. |
| Workflow/roadmap | PASS: reviewed PR/migration/API/authority workflow, early AR spike before dependent integration, target preparation before Order readiness, P0 stability before P2, optional I18 does not gate final hardening. R04 is approved and DONE; implementation milestone acceptance still requires its specified evidence. |
| Contract/document structure | PASS: all endpoint rows include actor/purpose, request/response, rules/errors and replay/concurrency; examples parse as JSON; local links resolve and fences balance; required section families and five ADRs present. |
| Approved-decision preservation | PASS: PRODUCT_SCOPE.md and DESIGN_SYSTEM.md are unchanged. BUSINESS_RULES.md changes only introductory packaging and its clean Design System link; all business-rule decisions, lifecycles, invariants and priorities remain unchanged. |
| Standalone authority links | PASS: all local documentation links resolve within this authority pack; the team can use these contracts as the complete implementation baseline. External standards/provider links remain supporting references. |
| Approval/ADR status | PASS: derived R04 authorities are approved/frozen, R04 is DONE, ADR-001 through ADR-004 are Accepted, and ADR-005's provider boundary is Accepted. AR technology/SDK remains unselected until mandatory I03. |

Derived-document refinements during audit clarified replay-before-version validation, release of the unpaid checkout slot, Order-scoped sharing readiness, immutable target references independent of mutable AR configuration, and scoped historical target/support access. They preserve frozen business behavior. **No contradiction requiring a Product Scope, Business Rules or approved visual decision change was found.**

**Readiness verdict: READY TO CREATE NEW LUMICAL REPOSITORY — approved/frozen R04 baseline.** Required AR technology selection remains the planned I03 gate before AR-dependent implementation. No repository initialization, application source, schema/migration, dependency or deployment was changed by this patch. Future implementation must produce the runtime acceptance evidence defined in Testing Strategy.
