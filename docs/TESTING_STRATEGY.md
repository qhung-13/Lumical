# LumiCal — Testing Strategy

Status: **Approved/frozen R04 verification authority**. Proves [Product Scope](PRODUCT_SCOPE.md), [Business Rules](BUSINESS_RULES.md), [Design System](DESIGN_SYSTEM.md) and technical contracts. This is a planned strategy, **not a claim that a new application or its tests exist**.

## 1. Pragmatic tools and test pyramid

TypeScript compiler + ESLint static gates; **Jest** for backend/domain; **Vitest + Testing Library** for frontend; **Supertest** for Nest HTTP; **Playwright** for E2E/visual checks; **axe** automated accessibility plus manual review; disposable **PostgreSQL** for database integration. Pin compatible supported versions at I00. Many fast business-policy tests, focused real-database/API integration, a small set of complete critical E2E journeys. No coverage percentage substitutes for behavior/invariant evidence.

## 2. Static checks

Both apps strict typecheck, lint, production compilation; generated OpenAPI/client consistency and architecture import checks. Detect frontend Prisma/database/provider-secret imports, domain framework/provider dependencies, untyped DTO assumptions and accidental secret artifacts. Validate migration history is present and immutable; documentation links/contract drift reviewed. Static checks cannot prove payment or access correctness.

## 3. Unit and domain/business tests

Test policies from BR IDs without framework/DB: month range/count, owner relationship, readiness separately, optional Special Dates, Gregorian/leap date validity, exact minor-unit multiplication, Project and Order/Payment/Fulfillment transitions, inactive Template behavior, share generation. Controlled Clock for year changes and session expiry. Test meaningful permitted/rejected outcomes rather than restating implementation branches.

## 4. Backend and database integration

Disposable PostgreSQL created for each isolated suite/environment; apply reviewed migrations from empty and upgrade fixture. Never run tests on production/demo participant database or use SQLite. Repository/use-case tests verify foreign/unique/check constraints, transactional rollback, concurrent placement/settlement/share updates, immutable snapshot/media pins, child-write root locking and lease invalidation. Tests use real transaction paths; mocked Prisma is not transaction evidence.

## 5. API contract tests

Supertest Nest app with test database/adapters verifies every endpoint family, OpenAPI/schema envelopes, cookies, CSRF, idempotency keys, If-Match, exact money/date/status values, safe 404 and scoped projections. Snapshot equality before/after edits; recipient serialization denies owner/account/Order/payment/contact keys. Admin has no private-draft mutation route. Contract examples must match actual runtime DTOs.

## 6. Frontend component/integration tests

Testing Library verifies keyboard controls, visible required/optional copy, shared Dialog focus, form errors/state retention, upload Pending/Ready, query cache clearing, current Project version and conflict handling, safe status vocabulary. Vitest API stubs follow reviewed contract; provider return cannot render success before backend Completed. Image+message is accepted by AR configuration forms. No localStorage auth credential.

## 7. E2E

Playwright with synthetic identities/fixtures exercises public browse→register/login→create twelve Months→personalize→preview→Order→verified sandbox→account/Admin demo fulfillment→explicit share→recipient fallback. Small separate cases cover no Special Date Order, duplicate click, revoked share, role boundaries and pending/cancelled payment. Backend integration catches race/state variants that would make excessive browser scenarios slow/flaky.

## 8. Accessibility

Automated axe on representative public, Studio, checkout, account, recipient and Admin views in both themes/languages. Manual keyboard-only navigation, focus entry/trap/restore and screen-reader announcements; 320px reflow and 200% browser/text zoom; long VI/EN labels and correct diacritics. Reduced motion; preview readable alternative; camera-free authorized fallback; captions/transcripts. Document/review any exception against Design System WCAG 2.2 AA baseline. Passing axe is not certification.

## 9. Security/authorization

Two owners with different media/targets/Orders; attempt reads/writes using other IDs. Test origin+CSRF, cookie flags, logout/reset/disable, expired session, recipient generation rotation, unknown share/target scope, safe error shape, no raw secrets in logs/bundles/OpenAPI, no private image-optimizer/public provider delivery path. Check Admin ordered-content purpose/audit and denied private draft/media mutation. Test malicious upload type/oversize and provider URL injection; no hypothetical enterprise penetration-test requirement.

## 10. Concurrency/idempotency

Parallel real-database requests with a synchronization barrier, not only sequential duplicate tests: same/different checkout keys, child edit during snapshot, repeated payment start, duplicate/late settlement evidence, cancellation versus uncertain/successful attempt, stale fulfillment update, upload finalization and share rotation/revoke races. Assert one intended Order/settlement/current grant, no skipped states/mixed snapshot and stable provider operation ID. Simulate process crash after provider success before local commit, then verify status recheck avoids second capture.

## 11. External adapter tests

Payment fakes return approved-but-not-complete, delayed/duplicate/cancelled/rejected/wrong amount/currency/account/environment/signature outcomes. Media fake independently verifies metadata and non-overwrite/pinning/cleanup; actual configured Cloudinary adapter acceptance verifies anonymous original/derivative denied and backend-authorized range access. AR fake verifies version binding; it cannot count as real target-recognition evidence. P1 email capture tests proof expiry/single use/non-enumeration; no live mail dependency P0.

## 12. PayPal Sandbox acceptance

Before milestone sign-off, run genuine sandbox approval and backend-verified completion, confirmed cancellation/rejection or documented provider-supported failure case, same unpaid Order retry, lost-response recheck and duplicate verified event. Record safe attempt/provider support reference, exact USD amount and backend evidence without secrets. Verify visible non-real-money wording. Test account/environment setup separately; no real-money endpoint/credentials or Admin override. Provider outage recording is presentation backup only, not acceptance proof for a failing current integration.

## 13. AR acceptance/device testing

**R1 timing revision — ready for coordinated review:** [I03 boundary decision](../spikes/ar/I03-acceptance-boundary-revision.md)
records LEAD's explicit request and pending independent/authority review. I03 demonstrates early technical feasibility,
prototype recognition/preparation, version-safe scope separation, fallback/provider feasibility and a conditional decision
with known limits. It does not certify product devices. I08 owns source/provenance/integrity/stale-result/durable preparation
acceptance; I12 owns actual product mobile HTTPS, physical scans, environments, lifecycle/denial/indicator/performance,
network/payload/storage privacy, equivalent fallback and manual accessibility. V01–V12 assign existing owners and gates.
Independent preparation/device execution formerly required by I03-P06 moves explicitly to I08-P06/I12-P05 and review in
I12-P06; an unexecuted handoff is not a pass. Product/security requirements remain mandatory before product acceptance.

**Original R04 verification timing (retained history; superseded only when the R1 review package is approved):**

Mandatory early I03 spike: at least one genuine prepared target recognized in supported mobile browsers over HTTPS, bound to the correct authorized version. Record device/OS/browser/version, lighting/distance/orientation, preparation metadata, license constraints and successful reveal evidence. Test image+meaningful message; optionally video/audio as supported alternatives. Wrong owner's target, ambiguous/no target, permission denied, unsupported device and runtime failure never reveal unrelated content. Fallback returns same meaningful authorized content, and revoked share blocks both. Retest the selected adapter in final AR milestone; no SDK selected by this document.

## 14. Visual regression

Playwright approved component/page snapshots with deterministic fonts/media, both themes, VI/EN, compact/wide layouts, ready/loading/error/disabled/selected/focus states. Compare against approved Design System baselines, registry and patterns. Snapshot changes require visual review, not blanket regeneration to pass CI.

## 15. Critical planned scenario register

| ID | Scenario / expected evidence | Primary layers |
| --- | --- | --- |
| T01 | Cross-user Project read/edit denied; ownership non-transferable | Domain, API/security |
| T02 | New Project from inactive Template denied | Domain, API+DB |
| T03 | Existing Project baseline/price survives Template edits/deactivation | Domain, DB/API |
| T04 | Exactly twelve unique Months created and snapshotted atomically | DB, domain |
| T05 | Order content/price/AR/media unchanged after Project/Template replacement | DB/API |
| T06 | Duplicate checkout intent gives one Order; accepted replay precedes old-version rejection; settlement/cancellation releases slot for deliberate later reorder; changed quantity/contact cannot rewrite Order | Concurrency DB/API |
| T07 | Backend ignores/rejects client price, computes USD × quantity 1–10 | Domain/API |
| T08 | Cancelled/Failed attempts retry under same unpaid Order | Domain, API, sandbox |
| T09 | Browser redirect/approval boolean cannot mark paid | API, frontend, E2E |
| T10 | Correct provider-bound exact USD evidence completes once | Adapter, DB/API, sandbox |
| T11 | Duplicate/late completion/crash recovery yields one settlement | Concurrency, adapter, DB |
| T12 | One successful attempt per Order; uncertain attempt blocks unsafe new attempt | DB/API |
| T13 | Unpaid/stale/unauthorized fulfillment transition rejected; completion closes Order | Domain, DB/API |
| T14 | Recipient projection excludes account/Order/payment/contact/unrelated media | API contract/security |
| T15 | Revoked/rotated share and disabled owner invalidate AR/media/fallback later reads; technical lease expiry does not expire valid underlying share | DB/API, E2E/security |
| T16 | Target resolves only correct authorized ordered content, even after later edit | Adapter, API/security, device |
| T17 | Unsupported/denied/no-recognition fallback exposes same authorized content | Frontend, device/E2E |
| T18 | Admin can't edit another user's draft; ordered read needs purpose/audit | API/security |
| T19 | Zero Special Dates allowed in ready Order; C07 feature demonstrated separately | Domain, API/E2E |
| T20 | Image+message is valid genuine AR reveal; no video/audio invariant | Domain, contract, device |
| T21 | VI/EN, theme, focus, 320px/200%, reduced motion | Component, visual, manual/axe |
| T22 | Session logout/reset/disable, CSRF/origin and private-cache separation | API/security, frontend |
| T23 | Upload finalization metadata/owner binding and duplicate handling | Adapter, DB/API |
| T24 | Ordered Project can't be hard-deleted; media retention survives current removal | DB/API |
| T25 | Explicit sandbox and simulated/no-actual-shipment copy | Component/E2E, manual |
| T26 | Retention cleanup checks referenced assets and grants lose access before purge | DB/integration |

## 16. Invariant coverage

| Invariant | Planned evidence |
| --- | --- |
| INV-01 | T01 + non-null owner DB constraint |
| INV-02 | T04 (unique/range plus twelve-count rollback) |
| INV-03 | T01 and T18 cross-role tests |
| INV-04 | T14 recipient contract projection |
| INV-05 | T03/T05 historical version/media equality |
| INV-06 | T09/T10 provider-only completion |
| INV-07 | T25 and sandbox adapter configuration checks |
| INV-08 | T16 wrong-owner/wrong-version device/API test |
| INV-09 | T13 Admin/payment/current-state gate |
| INV-10 | T11 duplicate completion/crash replay |
| INV-11 | T02/T03 active creation/captured baseline |
| INV-12 | T15 concurrent rotation/revoke and private stream checks |
| INV-13 | T11/T12 unique settlement under simultaneous attempts |
| INV-14 | T24 snapshot/pin/deletion protection |

## 17. Definition of Tested and final demonstration

A feature is Tested when its BR/INV scenarios pass at appropriate layers, affected contract/DB boundaries use real PostgreSQL where relevant, negative cases are covered, UI common gate passes, and evidence is attached to PR/milestone. Mocks cannot substitute for final provider/device acceptance. CI includes affected tests and broad critical suite; external sandbox/device acceptance has a separately recorded gate to avoid falsely green offline runs.

Final demo explicitly shows one **Special Date**, all twelve editable Months, personal image/message, one genuine prepared AR reveal (image/video/audio alternative), Order→verified sandbox→Admin simulated fulfillment→explicit share→recipient/fallback, and brief VI/EN/theme/accessibility evidence. Separate test proves Special Date is optional per Order. Use synthetic content and safe credentials. A labeled recording may support presentation during outage but does not replace successful acceptance evidence.
