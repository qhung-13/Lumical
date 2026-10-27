# LumiCal — API Contract

Status: **Approved/frozen R04 REST/JSON contract baseline**. [Business Rules](BUSINESS_RULES.md) owns behavior; [Architecture](ARCHITECTURE.md) and [Database](DATABASE.md) own execution and persistence. Base path: **`/api/v1`**. Paths below are relative to that base. This specification authorizes no implementation in this documentation phase.

## 1. Contract principles

Backend is the only owner of authorization, validation, pricing and provider evidence. Safe explicit DTOs, no Prisma/provider object serialization. Order snapshots are fixed; Project responses describe mutable work. Recipient responses are a different projection with no Order/account/contact/payment data. P0 contains no blog/social/marketing APIs; P1 endpoints are separated below.

## 2. Authentication transport

Secure HttpOnly opaque account cookie `__Host-lumical_session` and separate recipient cookie `__Host-lumical_recipient`, both SameSite=Lax, Path=/, no Domain, as Architecture §9/14. No Authorization bearer token stored by frontend. `GET /auth/session` returns safe principal plus CSRF token for an authenticated browser, never session identifier/digest. SSR forwards only relevant cookies to its trusted backend API origin; no private cache.

## 3. CSRF/origin

Cookie-authenticated mutations require exact allowed Origin and `X-CSRF-Token` from the corresponding session bootstrap. Unauthenticated login/register/recovery/recipient-exchange requests still require approved Origin and rate limits. Recipient exchange returns recipient CSRF binding. Provider webhook is an exception to browser Origin/CSRF and requires verified provider signature/environment instead. Development credentialed CORS permits explicitly listed origins only. Browser provider return page performs no unauthenticated payment write.

## 4. JSON conventions and vocabulary

Requests/responses use `application/json` with UTF-8 camelCase DTO fields; opaque ID strings; unknown mutation fields rejected; distinction between omitted and null documented for optional fields. Success `{ "data": ... }`; list adds `meta`. Private media/artifact streams and raw verified provider webhook intake are explicit exceptions to JSON, with verified content type and no-sniff/private-cache headers. No password/token/hash/provider-secret fields in read DTOs. Canonical status values:

| Entity | API status vocabulary |
| --- | --- |
| Account / role | `ACTIVE`, `DISABLED`; account role `USER`, `ADMIN`, assigned by backend/operator |
| Template availability | `ACTIVE`, `INACTIVE`, `ARCHIVED`; only complete published revision is active/selectable |
| Project | `WORKING`, `ARCHIVED` |
| Order | `PLACED`, `CANCELLED`, `CLOSED` |
| PaymentAttempt | `INITIATED`, `AWAITING_APPROVAL`, `VERIFYING`, `COMPLETED`, `CANCELLED`, `FAILED` |
| Fulfillment | `WAITING_FOR_PAYMENT`, `PREPARING`, `DEMO_COMPLETE`, `STOPPED` |
| Media | `PENDING`, `READY`, `UNAVAILABLE`; category `IMAGE`, `VIDEO`, `AUDIO` |
| Share | `ACTIVE`, `REVOKED`, `SUSPENDED` |
| AR readiness (derived) | `NOT_CONFIGURED`, `PREPARING`, `READY`, `UNAVAILABLE` |

Frontend translates these labels; language never changes canonical business meaning. Order response carries separate `paymentSummary` and `fulfillment`; no `PAID` Project/Order state.

## 5. Date/time

UTC RFC 3339 instants (`2026-10-11T12:00:00Z`); civil event dates `YYYY-MM-DD`; year/month/quantity integer numbers. Calendar dates are not parsed as UTC timestamps. Backend Clock determines current-year creation validation; documented product clock configuration is used consistently across environments and frozen in tests.

## 6. Money

`{ "currency": "USD", "unitPriceMinor": 1450, "quantity": 2, "totalMinor": 2900 }`. Integer minor units, safe JSON integer range, exact cents. `discountMinor`, `taxMinor`, `shippingMinor` are zero. Backend computes all values from captured Project baseline. Browser Order request contains quantity and demo contact, **no price/total**. Provider decimal USD representation is an adapter concern; UI formats to two decimals. No FX or language-dependent conversion.

## 7. Pagination

Cursor lists with `limit` default 20/max 50 and opaque `cursor`; response `meta:{nextCursor,hasMore}`. Ordering uses timestamp+ID tie-break. Do not expose private total counts to unauthorized callers. Twelve Months are returned together in a Project/recipient calendar rather than paged.

## 8. Filtering/sorting

Allowlisted filters only: public Template category/query; own Project state; own Order state; Admin Order/fulfillment state and safe search. Sort enum `updatedDesc`/`createdDesc` or explicitly declared catalog name order; no arbitrary SQL column/direction query. Owner scope applied before filtering. Sensitive contact search only in authorized Admin operation, redacted from logs.

## 9. Error envelope

```json
{"error":{"code":"VERSION_CONFLICT","messageKey":"errors.versionConflict","requestId":"req-example","retryable":false,"fieldErrors":[]}}
```

Stable canonical code and translation key, safe context only. Codes map business categories: `VALIDATION_FAILED` 422; `UNAUTHENTICATED` 401; `FORBIDDEN`/`ORIGIN_REJECTED`/`CSRF_REJECTED` 403; safe `NOT_FOUND` 404; `CONFLICT`/`IDEMPOTENCY_CONFLICT`/`INVALID_TRANSITION` 409; `VERSION_CONFLICT` 412; `RATE_LIMITED` 429; `PROVIDER_UNAVAILABLE` 503; `PAYMENT_REJECTED` as confirmed attempt result or 409 when action is ineligible; `MEDIA_UNAVAILABLE` 409/503 according to known versus transient cause; `AR_UNAVAILABLE` as readiness result/fallback, not a guessed private reveal. Unhandled failure 500 with request ID, no stack/provider raw text. Payment uncertainty remains a pending state even if a status refresh returns 503.

## 10. Validation errors

`fieldErrors:[{path:"quantity",code:"OUT_OF_RANGE",messageKey:"validation.quantityRange"}]`. Paths are defined request fields, never private storage names. Limits follow Business Rules: title/recipient 1–80, Month caption/event note ≤300, quantity 1–10, media category/size/duration, real Project-year date. Input coercion cannot turn invalid date/quantity into a different accepted value. Events are optional per Order.

## 11. Idempotency

`Idempotency-Key` required for Project creation, Place Order, upload initiation/finalization, payment start/approval, share create/rotate, Admin publication/status actions and P1 reset consumption. Same actor+operation+key+request (including original expected/reviewed version) returns bound resource/outcome; changed request yields 409. After checking current actor authority, a valid replay precedes the version comparison that would reject the original successful mutation's old ETag. Financial/share intents retained through semester. Provider operation identity remains stable even after a response is lost. Share raw response is replayable to the owner only within encrypted 24-hour delivery window; afterward replay returns same metadata with `delivery:"SECRET_EXPIRED",shareUrl:null`, never silently rotates. Normal checkout retry for an open unpaid Project version resumes the existing Order with unchanged quantity/contact. A changed checkout request conflicts rather than rewriting it; cancel the eligible unpaid Order before a new intent. Settlement/final unpaid cancellation releases the open-checkout slot; intentional later reorder requires a new confirmed intent.

## 12. Concurrency/version conflicts

Mutable resource GET includes `version` and ETag. Mutation uses `If-Match` with that ETag unless explicitly idempotent-only; missing precondition returns 428. Child edits compare/increment **Project** version, not a separate uncoordinated Month version. Order creation carries `reviewedProjectVersion`; backend ensures that exact current revision is Order-ready. Admin Fulfillment/share lifecycle updates compare their own versions. 412 returns safe current version; user refreshes/reviews before new intent. Never retry a price/content-changing conflict as if accepted.

## 13. Ownership behavior

Owners can only use their own Projects/media/Orders. Archived work readable but not editable/orderable; existing shares revocable/rotatable. Any Order history makes Project deletion unavailable. Role Admin is not owner permission. P0 Admin content inspection is read-only and limited to an ordered version for concrete audited purpose.

## 14. No-information-leak policy

Cross-owner/unknown identifiers use same 404 shape. Invalid/revoked/old recipient credentials produce safe `RECIPIENT_ACCESS_INVALID` 404, no owner/order detail. Disabled account errors reveal no public email existence. Recipient DTOs omit ownerId/projectId/orderId/prices/contact/payment/provider IDs and unrelated media. Redact credentials, cookies, request bodies with personal content and approval URL secrets from logs.

## 15. OpenAPI policy

NestJS publishes versioned OpenAPI for every endpoint/schema/security/error/precondition. Contract changes reviewed with frontend and testing; regenerate frontend client/types from the reviewed specification. Include cookie auth plus CSRF headers, idempotency/version requirements and raw webhook/media exceptions. Runtime integration contract tests ensure documentation and serialized DTOs match. OpenAPI UI disabled or limited in demo environment; no provider secret examples.

## 16. Resource/request shapes

| Name | Contract content |
| --- | --- |
| Registration / Login | `email,password`; registration creates ordinary User only. |
| Principal | safe `id,email,role,accountStatus`; owner only. |
| ProjectCreate | `templateId,title,year,recipientName,stylePresetId`; active published Template required. |
| ProjectPatch | changed `title,recipientName,stylePresetId`; style from captured baseline. Year is chosen by ProjectCreate; no year-change workflow is promised by this P0 contract. |
| Project | owner-authorized identity/state/baseline, `version`, ordered Month list, personal events, current AR config and readiness summary. |
| MonthPatch | `caption`, ordered `images:[{assetId,altText,crop}]` with 0–4 owned Ready images; reuses allowed. |
| EventWrite | `date,title,note?`; valid date in Project year. |
| UploadCreate | `category,fileName,declaredBytes,declaredDurationSeconds?`; declared metadata is assistance. |
| UploadIntent | `assetId,upload:{url,fields,expiresAt}`; bounded private-provider upload fields, never provider API secret or delivery URL. |
| Media | `id,category,status,verifiedBytes,durationSeconds?,contentPath?`; private contentPath requires account access. |
| ARWrite | `monthNumber,revealAssetId,readableText`; image+message OR video+caption/transcript OR audio+transcript/caption. |
| ARReadiness | `status,targetId?,artifactPath?,reveal,issues`; scoped owner preview. |
| Readiness | Project-scoped `previewReady,arReady,orderReady` plus safe issue codes; no event-count gate. **Sharing readiness is separately Order-scoped** in `Order.shareReadiness:{sharingReady,issues}` for that immutable paid version, not inferred from the mutable Project. |
| OrderCreate | `projectId,reviewedProjectVersion,quantity,contact:{name,email}`; optional acknowledgement `sandboxAcknowledged:true`; no monetary fields. |
| Order | own immutable summary/snapshot references, price USD, contact, `status,version,paymentSummary,fulfillment,shareReadiness,sandbox:true`. |
| PaymentAttempt | `id,orderId,status,sandbox:true,approvalUrl?,amountMinor,currency,version,canRetry`; amountMinor is fixed Order total, provider identifiers minimized to support reference. |
| ShareMetadata | `status,generation,version,createdAt,revokedAt?`; owner scoped, no credential/hash. |
| ShareMutation | `metadata,delivery,shareUrl`; raw secret fragment only on create/rotate or valid encrypted replay. |
| RecipientExperience | calendar title/year/dedication, twelve Months with only included image/caption/date content, reveal/target scoped paths, AR/fallback state; **no Order/account/contact/payment fields**. |
| TemplateWrite | complete VI/EN name/description, approved preset/layout configuration, positive `unitPriceMinor,currency:"USD"`; publication actions choose active/inactive/archive separately. |
| Inspection | `inspectionId,expiresAt,purpose,snapshot`; purpose-limited immutable content paths, no editable draft. |

## 17. P0 endpoints

Actors: **G** Guest; **U** active User; **O** owner of requested object; **A** authorized Admin; **R** valid recipient lease; **P** verified provider. All account mutations inherit CSRF/Origin, all private reads no-store. Table errors list operation-specific categories **in addition** to common 401/403/404/422/429/500. `V` means If-Match; `K` means Idempotency-Key. A named response is the shape in §16 or explicit fields below.

### Operational health (no product/private data)

| Method / path | Actor / purpose | Request | Response | Business rules | Errors | Replay/concurrency |
| --- | --- | --- | --- | --- | --- | --- |
| GET `/health/live` | Infrastructure or G; process liveness | None | 200 `{alive:true}` | Architecture observability; no product authority | no private diagnostics | Read-only; no provider work |
| GET `/health/ready` | Infrastructure or G; necessary backend readiness | None | 200 `{ready:true}` or 503 `{ready:false}` | Architecture observability; no product authority | 503 unavailable essential persistence/config | Read-only; no payment/media mutation or provider probes with side effects |

### Identity and account

| Method / path | Actor / purpose | Request | Response | Business rules | Errors | Replay/concurrency |
| --- | --- | --- | --- | --- | --- | --- |
| POST `/auth/register` | G; ordinary account registration | Registration | 201 Principal + account cookie + csrfToken | BR-ID-003/004/007/009 | safe registration conflict | K; unique normalized email |
| POST `/auth/login` | G; prove credentials | Login | 200 Principal + rotated cookie + csrfToken | BR-ID-005/006 | generic credentials rejection 401 | New session only after validated login; limited attempts |
| GET `/auth/session` | U or G; bootstrap session | None | 200 `{authenticated,principal?,csrfToken?}` | BR-ID-001/006 | no secrets | No-store; expired account returns authenticated false |
| DELETE `/auth/session` | U; logout current session | CSRF | 204 expired account cookie | BR-ID-006 | CSRF/origin | Repeating logout is safe; already logged out 204 with Origin check |
| GET `/account/me` | U; own account summary | None | 200 Principal | BR-ID-001/009 | — | No-store |

### Templates and Projects

`PublicTemplate` is an explicit projection: `{id,category,publishedRevision:{id,version,publishedAt,name:{vi,en},description:{vi,en},layout,presets,price:{currency:"USD",unitPriceMinor}}}`. Catalog order is Vietnamese name ascending then Template UUID ascending. Cursor encodes those keys only. Search trims input and performs case-insensitive substring matching on both-language names and descriptions; PostgreSQL's current comparison is accent-sensitive. `%`, `_`, and the escape character are treated literally. Incomplete or unsupported revisions are omitted/404. See [I04-P01 decisions](DECISIONS_I04_P01.md) for the version-1 layout and curated preset set.

| Method / path | Actor / purpose | Request | Response | Business rules | Errors | Replay/concurrency |
| --- | --- | --- | --- | --- | --- | --- |
| GET `/templates` | G; discover active catalog | `category?`, `query?`, `cursor?`, `limit?` | `{data:[PublicTemplate],meta:{nextCursor,hasMore}}` | BR-TPL-001 | invalid filter/cursor/limit 422 | `limit` defaults 20/max 50; public cache permitted, availability rechecked at create |
| GET `/templates/{id}` | G; active Template details | UUID ID | `{data:PublicTemplate}` | BR-TPL-001 | 404 inactive/absent/incomplete | Public cache does not grant orderability |
| POST `/projects` | U; create owned twelve-Month work | ProjectCreate | 201 Project | BR-PRJ-001/002/003, BR-TPL-001/002 | TEMPLATE_UNAVAILABLE 409 | K; atomic baseline/twelve Months |
| GET `/projects` | U; own account work list | state/cursor/limit | 200 Project summaries + meta | BR-PRJ-001, BR-ORD-005 | invalid filter | Owner scope before query |
| GET `/projects/{id}` | O; reopen own work | ID | 200 Project + ETag | BR-PRJ-001/004 | — | No-store |
| PATCH `/projects/{id}` | O; edit identity/curated style | ProjectPatch | 200 Project + ETag | BR-PRJ-007, BR-TPL-002 | invalid transition 409/version 412 | V; Project revision increments |
| POST `/projects/{id}/archive` | O; archive | Empty | 200 Project | BR-PRJ-005 | 412 | V; repeated desired state safe, no automatic share revoke |
| POST `/projects/{id}/restore` | O; restore | Empty | 200 Project | BR-PRJ-005 | 412 | V; no automatic new share |
| DELETE `/projects/{id}` | O; confirmed never-ordered deletion | `{confirmed:true}` | 204 | BR-PRJ-006 | PROJECT_HAS_ORDERS 409/version 412 | V; protect snapshot dependencies |
| GET `/projects/{id}/preview` | O; current preview/readiness | None | 200 Project preview + Readiness + reviewed version | BR-RDY-001/003 | — | Empty content previewable; no-store |
| GET `/projects/{id}/readiness` | O; separate preview/AR/Order criteria | None | 200 Readiness + projectVersion | BR-RDY-001..003 | — | Current Project version only; share readiness belongs to own Order response |
| GET `/projects/{id}/checkout-preview` | O; price estimate/context | quantity 1–10 | 200 current Project version + exact USD quote + readiness | BR-PRICE-001..003 | invalid quantity 422 | Read only; quote not an Order/snapshot |

### Months, personal dates, media and AR

| Method / path | Actor / purpose | Request | Response | Business rules | Errors | Replay/concurrency |
| --- | --- | --- | --- | --- | --- | --- |
| GET `/projects/{id}/months` | O; twelve individually reviewable Months | None | 200 ordered Month list + projectVersion | BR-MON-001 | — | All twelve together |
| PUT `/projects/{id}/months/{number}` | O; replace Month content | MonthPatch | 200 Month + projectVersion | BR-MON-001..003, BR-MED-002/003 | media mismatch/conflict 409/version 412 | V on Project; Ready owned images only |
| GET `/projects/{id}/special-dates` | O; own optional events | None | 200 Event list + projectVersion | BR-EVT-001/002 | — | Empty list valid |
| POST `/projects/{id}/special-dates` | O; add personal event | EventWrite | 201 Event + projectVersion | BR-EVT-001/002 | invalid date 422/version 412 | K + V; same date permitted, same intent not duplicated |
| PUT `/projects/{id}/special-dates/{eventId}` | O; edit event | EventWrite | 200 Event + projectVersion | BR-EVT-001..003 | 412 | V; snapshot unchanged |
| DELETE `/projects/{id}/special-dates/{eventId}` | O; remove current event | None | 204 + current Project ETag | BR-EVT-003 | 412 | V; snapshot unchanged |
| POST `/media/uploads` | U; authorize private upload | UploadCreate | 201 UploadIntent | BR-MED-001..004 | unsupported size/category 422/provider 503 | K; one Pending asset/intent |
| POST `/media/{id}/finalize` | O of asset; verify uploaded object | `{uploadCompleted:true}` hint only | 200 Media or 202 `{assetId,status:"PENDING"}` | BR-MED-003/004, BR-CON-005 | rejected content 422/provider 503 | K; provider facts inspected; no client metadata proof |
| GET `/media/{id}` | O of asset; readiness status | None | 200 Media | BR-MED-002/003 | — | No-store |
| GET `/media/{id}/content` | O of asset; private preview | optional Range | 200/206 media bytes | BR-MED-002 | unavailable 409/503 | Each GET/HEAD/range access checked; no-store |
| DELETE `/media/{id}` | O of asset; remove unused current asset | None | 204 or 200 `{retainedForHistory:true}` | BR-MED-005/006 | active current reference conflict 409 | Safe repeat; retained Order references never purged |
| PUT `/projects/{id}/ar` | O; set one designated reveal | ARWrite | 200 AR config + projectVersion; preparation may be pending | BR-AR-001/002, BR-RDY-002 | invalid/mismatched media 422/409/version 412 | K + V; new immutable artifact when source changes |
| DELETE `/projects/{id}/ar` | O; remove current AR config | None | 204 + Project ETag | BR-AR-002, BR-MED-005 | 412 | V; prior Order artifact retained |
| GET `/projects/{id}/ar` | O; config/readiness and target artifact metadata | None | 200 ARReadiness + projectVersion | BR-RDY-002, BR-AR-001 | preparation unavailable in issues | No SDK selected by contract |
| GET `/projects/{id}/ar/preview` | O; owner target/reveal preview | None | 200 scoped target/reveal/fallback paths | BR-AR-001/003/004 | unavailable 409/503 | Owner authorization; no recipient grant implied |
| GET `/projects/{id}/ar/targets/{targetId}/artifact` | O; authorized prepared target | optional Range | 200/206 private artifact bytes | BR-AR-001/003 | not current scoped target 404/unavailable | No-store; adapter format identified but private binding kept |

### Orders and Payment attempts

| Method / path | Actor / purpose | Request | Response | Business rules | Errors | Replay/concurrency |
| --- | --- | --- | --- | --- | --- | --- |
| POST `/orders` | O of Project; place immutable request | OrderCreate | 201 Order (200 when resuming existing intent) | BR-ORD-001..003, BR-RDY-003, BR-PRICE-001..004 | NOT_ORDER_READY 409/version 412 | K; atomic snapshot/twelve Months/pins/Fulfillment Waiting; no Special Date requirement |
| GET `/orders` | U; own account history | state/cursor/limit | 200 Order summaries + meta | BR-ORD-005 | invalid filter | Owner scope |
| GET `/orders/{id}` | O; own payment/fulfillment result | None | 200 Order + ETag | BR-ORD-005 | — | No-store |
| GET `/orders/{id}/snapshot` | O; ordered content | None | 200 immutable version incl twelve Months, optional events and AR | BR-ORD-002 | — | Never queries mutable Project for display |
| GET `/orders/{id}/snapshot/media/{referenceId}` | O; retained ordered media | Range optional | 200/206 private bytes | BR-MED-005, BR-ORD-002 | unavailable 409/503 | Scoped snapshot reference, no-store |
| GET `/orders/{id}/snapshot/targets/{targetId}/artifact` | O; retained ordered target | Range optional | 200/206 private artifact bytes | BR-AR-002, BR-ORD-002 | wrong snapshot target 404/unavailable | Ordered artifact pin, never mutable Project target; no-store |
| POST `/orders/{id}/cancel` | O; cancel unpaid request | Empty | 200 Order, Fulfillment Stopped | BR-ORD-004, BR-FUL-003 | PAID_ORDER/UNRESOLVED_PAYMENT 409/version 412 | K + V; terminal evidence needed before final cancel |
| POST `/orders/{id}/payment-attempts` | O; start sandbox payment | `{sandboxAcknowledged:true}` | 201 PaymentAttempt or 202 Initiated pending | BR-PAY-001/004/005 | already settled/ineligible 409/provider 503 | K; one active attempt; provider create after commit |
| GET `/orders/{id}/payment-attempts` | O; trace attempt history | None | 200 PaymentAttempt list | BR-PAY-001/004 | — | No secrets |
| GET `/payment-attempts/{id}` | O of Order; check outcome | None | 200 PaymentAttempt | BR-PAY-002/005 | — | Frontend polls only boundedly; no implicit new capture |
| POST `/payment-attempts/{id}/approval` | O; report apparent provider approval | `{providerOrderId}` | 202/200 PaymentAttempt | BR-PAY-002/003/005 | BINDING_MISMATCH 409/provider 503 | K; persisted binding verified by backend; boolean paid ignored/rejected |
| POST `/payment-attempts/{id}/refresh` | O; request status recheck | Empty | 202/200 PaymentAttempt | BR-PAY-002/003/005 | provider 503 | Coalesces existing job; never creates new attempt/capture |
| POST `/payment-attempts/{id}/cancellation-intent` | O; report cancelled provider UI | Empty | 202/200 PaymentAttempt | BR-PAY-004/005 | invalid transition 409 | K; signal triggers status check, cannot override verified success |
| POST `/providers/paypal/webhooks` | P; verified external evidence intake | raw provider body + signature headers | 202 `{received:true}` after durable verified intake | BR-PAY-002/003, BR-CON-003 | bad signature 400/body-limit 413/unavailable 503 | Provider/environment/event-ID dedupe; no cookie/CSRF |

Provider return/cancel locations are **frontend navigation pages**, not payment-completion endpoints. Backend selects configured safe return origin and PayPal approval navigation; frontend never supplies arbitrary redirect destinations or PayPal secrets. Backend may perform one idempotent capture after checking approval through the adapter; uncertain outcomes use status refresh/webhook processing, not blind recapture.

### Owner sharing and recipient access

| Method / path | Actor / purpose | Request | Response | Business rules | Errors | Replay/concurrency |
| --- | --- | --- | --- | --- | --- | --- |
| POST `/orders/{id}/share` | O; first explicit grant | Empty | 201 ShareMutation | BR-RDY-004, BR-SHR-001..003 | unpaid/archived first grant/existing active share 409 | K; one current credential per paid Order |
| GET `/orders/{id}/share` | O; current grant metadata | None | 200 ShareMetadata or 404 none | BR-SHR-001/004 | — | No raw secret/hash |
| POST `/orders/{id}/share/rotate` | O; regenerate existing grant | Empty | 200 ShareMutation | BR-SHR-004/005 | absent/ineligible 409/version 412 | K + V; old generation invalidated atomically, allowed while Project Archived |
| DELETE `/orders/{id}/share` | O; revoke | None | 204 | BR-SHR-004 | 412 | V; repeated revoked state safe |
| POST `/recipient/access` | G holding credential; exchange access | `{credential}` from link fragment | 200 `{expiresAt,csrfToken}` + recipient cookie | BR-SHR-001..003, BR-AR-003 | invalid access 404/rate limit 429 | Origin enforced; no account session/Order info; raw body redacted |
| DELETE `/recipient/access` | R; end current browser lease | CSRF | 204 expired recipient cookie | BR-SHR-002 | CSRF/origin | Safe repeat; does not revoke owner's share |
| GET `/recipient/experience` | R; shared version/fallback | None | 200 RecipientExperience | BR-SHR-003, BR-AR-002..005 | invalid access 404/media unavailable | Current share generation and active owner checked every request |
| GET `/recipient/targets` | R; scoped target instructions/artifact paths | None | 200 target list (one P0 target) | BR-AR-001..003 | invalid access 404 | No global lookup; no provider secrets |
| GET `/recipient/targets/{targetId}/artifact` | R; prepared recognition artifact | optional Range | 200/206 bytes | BR-AR-002/003 | wrong-version/invalid access 404 | Private no-store; new request rechecks lease |
| GET `/recipient/targets/{targetId}/reveal` | R; resolve intended personalized content | targetId | 200 scoped reveal caption/media paths | BR-RDY-002, BR-AR-003/004 | wrong target/invalid access 404/unavailable | Access precedes resolution; recognition not authority |
| GET `/recipient/media/{referenceId}` | R; same authorized AR/fallback media | optional Range | 200/206 bytes | BR-MED-002/005, BR-AR-004/005 | wrong reference/invalid access 404/unavailable | Snapshot reference only; no-store; no public provider URL |

### Admin operations

| Method / path | Actor / purpose | Request | Response | Business rules | Errors | Replay/concurrency |
| --- | --- | --- | --- | --- | --- | --- |
| GET `/admin/templates` | A; catalog operation | state/cursor/limit | 200 Admin Template list + meta | BR-TPL-001, BR-ADM-001 | role forbidden 403 | Operational DTO |
| POST `/admin/templates` | A; create complete inactive Template | TemplateWrite | 201 Template/revision, INACTIVE | BR-TPL-001/002, BR-PRICE-001 | invalid definition 422 | K; audit; positive USD price |
| POST `/admin/templates/{id}/revisions` | A; publish new complete baseline | TemplateWrite | 201 immutable revision + Template version | BR-TPL-002/003 | 412 | K + V; existing Projects unchanged |
| PUT `/admin/templates/{id}/availability` | A; activate/deactivate/archive | `{availability,reason}` | 200 Template | BR-TPL-001/003/004 | incomplete publication 409/version 412 | K + V; audited; no hard-delete endpoint |
| GET `/admin/orders` | A; operational list | state/fulfillment/cursor/limit | 200 minimal Order list + meta | BR-ADM-001 | invalid filter | No all-draft browser |
| GET `/admin/orders/{id}` | A; necessary order/contact/payment facts | None | 200 operational Order summary/payment refs/Fulfillment | BR-ADM-001/002 | role forbidden | Audited operational access; no share credentials |
| POST `/admin/orders/{id}/inspection` | A; concrete ordered-content support | `{purpose:"ORDER_SUPPORT" or "DEMO_FULFILLMENT",reason}` | 201 Inspection | BR-ADM-002 | invalid purpose 422 | K; short-lived actor/order-bound grant and audit |
| GET `/admin/inspections/{id}/media/{referenceId}` | A bound to inspection; private ordered media | optional Range | 200/206 bytes | BR-ADM-002, BR-MED-005 | wrong actor/version/expired 404 | Each request checks grant, account and scope; audit/no-store |
| GET `/admin/inspections/{id}/targets/{targetId}/artifact` | A bound to inspection; ordered target support | optional Range | 200/206 private artifact bytes | BR-ADM-002, BR-AR-002 | wrong actor/version/expired 404 | Same purpose-bound immutable Order inspection; audit/no-store |
| PUT `/admin/orders/{id}/fulfillment` | A; gated simulated progress | `{status:"PREPARING" or "DEMO_COMPLETE",reason}` | 200 Fulfillment + Order summary | BR-FUL-001..003, BR-CON-004 | unpaid/invalid step 409/version 412 | K + V; state/history/audit/Order closure atomic |
| POST `/admin/payment-attempts/{id}/refresh` | A; recheck provider outcome | `{reason}` | 202/200 PaymentAttempt | BR-PAY-002/003/005, BR-ADM-001 | provider 503 | Audited coalesced verification only; cannot mark paid |
| GET `/admin/users/{id}/account-status` | A; minimal security-support status | None | 200 `{id,status,version}` + ETag | BR-ID-010, BR-ADM-001 | role forbidden 403 | No user-content browser or private account profile; audit |
| PUT `/admin/users/{id}/account-status` | A; security suspension/restoration | `{status:"ACTIVE" or "DISABLED",reason,restoreEligibleShares?}` | 200 safe account status | BR-ID-010, BR-PRV-003 | invalid transition/version 412 | K + V; invalidate sessions/suspend access; explicit audited restoration |

No Admin Project editor/deleter, blanket media library, payment-success override, refund, carrier or recipient-credential retrieval endpoint exists.

## 18. P1 contract — dormant until implementation milestone

| Method / path | Actor / purpose | Request | Response | Business rules | Errors | Replay/concurrency |
| --- | --- | --- | --- | --- | --- | --- |
| POST `/auth/password-recovery` | G; request mailbox proof | `{email}` | 202 generic acknowledgment | BR-ID-008 | rate limited; no email enumeration | Repeated requests safely bounded; EmailSender only P1 |
| POST `/auth/password-reset` | G holding proof; reset password | `{token,newPassword}` | 204; existing sessions revoked | BR-ID-004/006/008 | invalid/expired proof 422 | K; single consumption/password+session transaction |
| GET `/account/notifications` | U; meaningful own notices | cursor/limit | 200 safe Notification list + meta | BR-NOT-001 | — | Owner scoped |
| PATCH `/account/notifications/{id}` | O; mark read | `{read:true}` | 200 Notification | BR-NOT-001 | — | Repeated read safe |

P2 wishes/editorial/analytics endpoints require a separately reviewed extension. OUT comments/likes/newsletter/reviews do not appear here.

## 19. Representative payloads

```json
{"projectId":"11111111-1111-4111-8111-111111111111","reviewedProjectVersion":7,"quantity":2,"contact":{"name":"Demo Recipient","email":"recipient@example.test"},"sandboxAcknowledged":true}
```

With `Idempotency-Key` and account CSRF, Place Order returns:

```json
{"data":{"id":"22222222-2222-4222-8222-222222222222","status":"PLACED","version":1,"sourceProjectVersion":7,"quantity":2,"currency":"USD","unitPriceMinor":1450,"totalMinor":2900,"discountMinor":0,"taxMinor":0,"shippingMinor":0,"sandbox":true,"paymentSummary":{"settled":false},"fulfillment":{"status":"WAITING_FOR_PAYMENT","simulated":true}}}
```

An image reveal in a recipient projection:

```json
{"data":{"calendar":{"title":"Our memories","year":2027},"reveal":{"type":"IMAGE","readableText":"A meaningful personal message","mediaPath":"/api/v1/recipient/media/33333333-3333-4333-8333-333333333333"},"fallbackAvailable":true}}
```

This is a shortened example; complete experience includes exactly twelve Months and its authorized target. It never includes Order/account/contact/payment details.

## 20. Acceptance handoff

Contract tests cover errors, cookies/CSRF, safe DTO projections, expected versions, exact cents, duplicate intents, provider evidence and streamed access after share rotation. Match Business Rules A01..A17, including a valid Order with zero Special Dates and an image+message AR reveal. OpenAPI and generated client must reflect this specification before affected feature work merges.
