# LumiCal — Business Rules

Status: **R03 business authority for the new LumiCal university project**. Course: **Đồ án thực tế Công nghệ phần mềm**. This document refines the approved [Product Scope](PRODUCT_SCOPE.md): it defines who may do what, when objects change state, and which facts must remain true. It does not choose a framework, storage model, endpoint, payment SDK, AR SDK, or application implementation. The approved [Design System v2](DESIGN_SYSTEM.md) remains the authority for visual and accessibility details.

## 1. Rule language and authority

**P0** means required for the coherent final demonstration; **P1** is required supporting work after P0; **P2** is optional/stretch and dormant until explicitly approved. `OUT` is excluded. “Must” is binding; “may” is allowed but not required. A *Calendar Project* is the owner's editable workspace; an *Order* is a historically fixed request; a *Payment attempt* records one gateway attempt; *Fulfillment* is simulated operational progress; a *recipient version* is the fixed, authorized content exposed by a share. The words “snapshot” and “version” express historical business truth, not a database design.

Stable IDs are `BR-ID`, `BR-TPL`, `BR-PRJ`, `BR-MON`, `BR-MED`, `BR-EVT`, `BR-RDY`, `BR-SHR`, `BR-WISH`, `BR-AR`, `BR-ORD`, `BR-PRICE`, `BR-PAY`, `BR-FUL`, `BR-ADM`, `BR-PRV`, `BR-CON`, `BR-VAL`, `BR-NOT`, and `BR-I18N`, followed by three digits. `INV-xx` identifies a cross-cutting invariant. IDs are never reused for a changed meaning. Each rule table states the **rule**, **reason**, **applies to**, **expected enforcement**, and related Product Scope **capability**. Enforcement labels mean:

- **Business**: authoritative domain decision, regardless of interface.
- **Persistence**: durable protection of a critical invariant where appropriate.
- **Frontend assistance**: helpful early feedback, never final authority.
- **Provider evidence**: only for facts owned by the sandbox payment provider.
- **Multiple layers**: business decision plus durable protection and/or UI feedback as appropriate.

Later Architecture, Database, API Contract, and Testing Strategy may decide mechanisms, but may not silently change these rules. A desired capability outside Product Scope must be proposed as a scope change, not inferred from a rule here.

## 2. Actors and authority

Guest, Registered User, and Admin are account-level conditions/roles. Owner, Recipient/Viewer, and (P2) Contributor are **relationships to a particular object**, not global privileges. A registered person can be an owner of one project, a recipient of another, and an Admin account holder; the permissions for each action still depend on its object and purpose. Possession of recipient access does not prove account identity or ownership. A disabled account is not an active Registered User for protected actions.

| Action | Guest | Registered User | Owner of target project | Recipient/Viewer with valid share | Contributor (P2) | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Browse active templates | Yes | Yes | Yes | Yes | Yes | Yes; may also manage catalog |
| Create project | No | Yes, for self | Yes, for self | No by recipient status | No by contributor status | Only for own account, not on another's behalf |
| Read private project / preview | No | Only if owner | Yes | No; sees only recipient version | No | Not by role alone; limited ordered snapshot for order operation |
| Edit project / upload media / manage dates | No | Only if owner | Yes while Working | No | No | No for another user's project |
| Archive or delete project | No | Only if owner | Yes under lifecycle rules | No | No | No ordinary editorial authority |
| Share / revoke / regenerate recipient access | No | Only if owner | Yes for own eligible order/version | No | No | No; may suspend access for security only |
| Open recipient experience | Only with valid share | With valid share | With valid share or owner preview | Yes, read-only | Only with separately valid share | Only with valid share, not by Admin role alone |
| Place order / view order / attempt payment | No | Only for own eligible project/order | Yes | No | No | Inspect orders/references; cannot pay as owner |
| Manage fulfillment | No | No | No | No | No | Yes, within verified-payment gates |
| Manage templates | No | No | No | No | No | Yes |
| Inspect current private project/media for support | No | Only own | Yes | No | No | No P0 blanket access; see §12 |
| Manage another user's data | No | No | No | No | No | Only expressly defined operational metadata/status; no general content editing/deletion |

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-ID-001 | Every protected action requires an active account with the applicable object relationship; recipient access is a separate limited grant. | Account role alone must not imply ownership. | All actors | Multiple layers | C01, C03, C09, C15 |
| BR-ID-002 | An Admin role grants only the operational actions in §12, never automatic owner, recipient, or payment-completion powers. | Personal content and payment truth need least privilege. | Admin | Multiple layers | C09, C15 |

## 3. Identity and accounts

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-ID-003 | A guest may register with a unique normalized email and a password, then log in; an email identifies at most one account ignoring case and surrounding whitespace. | Unambiguous ownership and recovery. | Guest, User | Multiple layers | C01 |
| BR-ID-004 | A password is at least 12 and at most 128 characters, may be a passphrase, is not silently truncated or altered, and is never displayed or exposed after submission. No arbitrary symbol/uppercase composition rule is required. | Usable account protection for a semester project. | User | Multiple layers | C01 |
| BR-ID-005 | Login proves account credentials; repeated failed attempts are limited, failure messages do not reveal whether an email exists, and a disabled account cannot log in or perform protected actions. | Reduce account probing and abuse. | User, Admin | Multiple layers | C01, C26 |
| BR-ID-006 | Logout invalidates the current session. Password reset and account disable invalidate all existing sessions; no stale session may restore access. | A credential/security decision must take effect. | User, Admin | Multiple layers | C01, C22 |
| BR-ID-007 | Admin status is assigned/revoked only through an authorized operator process; public registration cannot grant it. Admin login remains subject to normal account-security rules. | Prevent privilege escalation. | Admin | Multiple layers | C01, C15 |
| BR-ID-008 | **P1:** self-service password recovery requires short-lived, single-use proof of control of the account email; it must not disclose account existence and it invalidates existing sessions after success. It is not a P0 prerequisite. | Recover access without operator intervention. | User | Multiple layers | C22 |
| BR-ID-009 | Email verification is **not required in the semester scope**. Email change and self-service account deletion are also not offered. The user is told to use an address they control; P1 recovery still requires proving mailbox control. | Avoid adding identity workflows not needed for the approved demo. | User | Business, frontend assistance | C01, C22 |
| BR-ID-010 | An authorized Admin may disable/re-enable an account for security or misuse with a recorded reason; disabling suspends owner actions and active recipient shares without erasing historical orders/payment evidence. | Security response without corrupting history. | Admin, User | Multiple layers | C01, C09, C15 |

Email is private account data. Public or recipient-facing views never reveal it by default. Admin sees only the identity/contact needed for an associated order. No product flow stores payment credentials.

## 4. Templates

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-TPL-001 | Only an active, complete, published Template is browseable/selectable for **new** projects. An inactive or archived Template cannot start a new project. | Catalog availability must be intentional. | Guest, User, Admin | Multiple layers | C02, C15 |
| BR-TPL-002 | Creating a project captures its selected Template identity/name, approved layout/style choices and published base unit price as that project's baseline. Later Template edits do not mutate that baseline. | Existing work must not change unexpectedly. | Owner, Admin | Business, persistence | C02, C03, C12 |
| BR-TPL-003 | Admin may edit and deactivate a used Template for future projects. Existing projects remain editable, previewable and orderable from their captured baseline even if the Template becomes inactive. | Deactivation is a catalog decision, not retroactive destruction. | Owner, Admin | Multiple layers | C02, C03, C15 |
| BR-TPL-004 | P0 uses deactivation/archive rather than hard deletion; a referenced Template cannot be erased through normal product use. A historical Order keeps its own Template description even after catalog changes. | Preserve traceability and order truth. | Admin | Business, persistence | C02, C12, C15 |

Admin changes to the catalog apply to **future project creations**. If an operator needs to stop an unsafe existing design from being ordered, that is an exceptional support/scope decision requiring explicit review; ordinary deactivation alone does not silently revoke existing owners' work.

## 5. Calendar Project creation, ownership, and lifecycle

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-PRJ-001 | A Calendar Project has exactly one registered owner from creation. P0 ownership is non-transferable; only that active owner can edit, archive, delete, or order it. | Clear private-work authority. | Owner | Multiple layers | C01, C03, C14 |
| BR-PRJ-002 | A new project requires authenticated owner, active Template, nonblank title (1–80 visible characters after trimming), intended recipient/context name (1–80), and a Gregorian calendar year from the current year through two years ahead at creation time. Existing projects remain valid as time advances. | Complete, near-term calendar identity without retroactive invalidation. | Owner | Multiple layers | C03, C26 |
| BR-PRJ-003 | A successful creation immediately represents exactly one editable Month for each number 1–12, even if implementation materializes data later. No extra or duplicate month belongs to that project. | Full-year product invariant independent of storage strategy. | Owner | Business, persistence | C03, C05 |
| BR-PRJ-004 | Projects begin **Working** and private. Preview/order/AR readiness are derived checks, not project states. An Order does not transition or freeze the project. | Keep editing and historical order truth separate. | Owner | Business | C03, C08, C12 |
| BR-PRJ-005 | A Working project may be edited and previewed. It may be archived by its owner; Archived is read-only and cannot create new orders or first-time shares. The owner may restore it to Working. Existing order-bound shares remain controlled separately: the owner may revoke/rotate them while Archived, and they are not silently revoked or recreated by archive/restore. | Archival organizes owner work without breaking a delivered gift. | Owner, Recipient | Multiple layers | C03, C09, C14 |
| BR-PRJ-006 | A project with **no Order ever placed** may be permanently deleted by its owner after clear confirmation. Once any Order exists, it may only be archived; its ordered versions remain intact. | Owner control without destroying transaction history. | Owner | Business, persistence | C03, C12, C14 |
| BR-PRJ-007 | The owner may edit a Working project after placing an Order and may intentionally place later Orders. Each later Order uses the then-current project version; no edit retroactively changes an earlier Order or its recipient version. | Support iteration and repeat gifts with correct history. | Owner | Business, persistence | C03, C12 |

| State | Meaning and allowed actions | Entry | Exit |
| --- | --- | --- | --- |
| **Working** | Private editable project; save, preview, personalize, order when eligible, inspect own order history. Readiness may vary. | Successful creation or owner restore. | Owner archives; or confirmed deletion only if never ordered. |
| **Archived** | Owner-readable historical workspace; no edit, new order, or first-time share. Existing immutable Orders and their already-issued recipient shares continue; owner may revoke/rotate an existing share. | Owner archives Working project. | Owner restores; or confirmed deletion only if never ordered. |
| **Deleted** | Terminal absence from owner work; not a state available to users. | Allowed only for a never-ordered project. | None. |

`Working → Working` on save, preview, share, or Order placement is intentional. The word “Ready” describes a check; “Ordered” describes a related Order, not an exclusive Project state.

## 6. Months, media, and special dates

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-MON-001 | Months are uniquely numbered 1–12 within a Project and use that project's year; every Month remains individually editable and reviewable. Empty months are allowed. | A complete calendar does not require twelve distinct uploads. | Owner | Multiple layers | C05 |
| BR-MON-002 | Each Month may show zero to four owner-selected images (reuse across months is allowed) and one optional caption/message of at most 300 visible characters. The small image limit keeps the semester preview and recipient experience legible. | Bound complexity without forcing content in each month. | Owner | Multiple layers | C05, C06 |
| BR-MON-003 | Saving a Month does not require photos/caption. Preview shows empty or incomplete content honestly; ordering has the separate calendar-level rules in §7. | Work must be saveable incrementally. | Owner | Business, frontend assistance | C04, C05, C08 |
| BR-MED-001 | P0 media categories are personal images for calendar pages or AR reveals, and short owner-chosen video or audio for AR reveals. An AR-linked image needs a meaningful readable caption/message; video needs an appropriate readable caption/transcript; audio needs a readable transcript/caption. A reveal uses one of these forms, not every media type. Arbitrary unrelated uploads are not automatically shareable. | Memory content and accessible fallback without a general media library. | Owner, Recipient | Multiple layers | C06, C10, C25 |
| BR-MED-002 | A media item belongs to its uploading owner and is private until explicitly included in an authorized recipient version. A share exposes only referenced, approved items for that version, never every file the owner uploaded. | Prevent accidental disclosure of unrelated media. | Owner, Recipient | Multiple layers | C06, C09 |
| BR-MED-003 | Uploads have **Pending**, **Ready**, or **Unavailable** business readiness. Only Ready media may appear in an Order or be revealed; failed/incomplete uploads have clear retry/removal feedback and cannot be treated as Ready. | Avoid broken snapshots or false previews. | Owner | Multiple layers | C06, C26 |
| BR-MED-004 | P0 limits: image up to 10 MB; AR video up to 60 seconds and 100 MB; AR audio up to 60 seconds and 20 MB. These are per item, chosen for reliable mobile/semester demonstration rather than codec/storage prescriptions. Unsupported or unsafe content is rejected before becoming Ready. | Bound upload delay and demo failure risk. | Owner | Multiple layers | C06, C10, C26 |
| BR-MED-005 | Replacing/removing media from a Working Project updates only future previews/orders. A prior Order and its recipient version retain the media they historically reference until its retention period ends; the owner may revoke recipient access separately. | Preserve the actual ordered/revealed gift. | Owner, Recipient | Business, persistence | C06, C09, C12 |
| BR-MED-006 | An unreferenced incomplete upload is not publicly accessible and is eligible for prompt cleanup; an item referenced by an Order cannot be purged merely because the Working Project no longer uses it. | Minimize orphaned data without breaking history. | Owner, Admin | Business, persistence | C06, C12 |
| BR-EVT-001 | P0 Special Dates are owner-authored personal events only, on a real Gregorian date in the Project year. Leap day exists only in a leap year; an invalid date is rejected. No system-holiday management is implied. | Keep the calendar accurate and in approved scope. | Owner | Multiple layers | C07 |
| BR-EVT-002 | Each event has a nonblank title (1–80 visible characters) and optional note (up to 300). Multiple distinct events may share a date; the owner may edit/delete them in a Working Project. Event-level media is not P0. | Support real family occasions without arbitrary one-per-day rule. | Owner | Multiple layers | C07 |
| BR-EVT-003 | Editing/deleting an event affects future Project versions only; an existing Order retains its captured event content. | Historical calendar correctness. | Owner | Business, persistence | C07, C12 |

## 7. Four distinct readiness checks

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-RDY-001 | **Preview-ready:** an owner has a valid saved Project with twelve Months. Preview may show placeholders and unmet requirements; it must not imply order/AR readiness. | Let an incomplete draft be reviewed. | Owner | Business, frontend assistance | C08, C26 |
| BR-RDY-002 | **AR-ready:** a designated target in the Project version is unambiguous and maps to one Ready personalized reveal: an image with meaningful readable caption/message, a short video with appropriate readable caption/transcript, or short audio with readable transcript/caption. Owner preview confirms the intended mapping. A supported prepared target must reveal that content, and fallback must expose the same authorized meaningful content. | Make the signature reveal testable and accessible. | Owner, Recipient | Multiple layers | C06, C10, C25 |
| BR-RDY-003 | **Order-ready:** Working Project, valid identity/year (the creation-year window is not reimposed later), exactly twelve Months, at least one Ready personal image somewhere, at least one AR-ready target/reveal, and owner review of the current preview. Special Dates are optional content for an individual calendar: C07 remains a required P0 product capability and the official demo must show a Special Date, but neither makes one required for every Order. No distinct image or AR target is required in every Month. | Ensure an ordered calendar demonstrates the approved value without unnecessary per-order content. | Owner | Multiple layers | C03–C08, C10, C12 |
| BR-RDY-004 | **Sharing-ready:** a completed sandbox-paid Order has an intact recipient-facing ordered version with AR-ready mapping, its owner account is active, and the owner deliberately grants access. Preview or an unpaid Order alone does not create recipient access. | Share a stable version that matches the demonstrated calendar target. | Owner, Recipient | Multiple layers | C09, C10, C12, C13 |

Readiness is reevaluated for the relevant version at the relevant action. An already-paid Order is not made “unpaid” or historically unready by later Project edits. If media retained for a recipient version becomes unavailable unexpectedly, fail closed and show a recoverable media-unavailable state; never substitute another owner's file.

## 8. Sharing and recipient access

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-SHR-001 | P0 sharing is an explicit owner grant to **one paid Order's immutable recipient version**, not publication of the mutable Project. At most one active share exists per Order; its bearer access link/credential is unguessable conceptually, with exact format left to architecture. | Match the delivered/demo target to stable content. | Owner, Recipient | Multiple layers | C09, C10, C12 |
| BR-SHR-002 | Recipient login is not required. Anyone holding a valid share may read that version, including multiple recipients using the same share; viewing is anonymous by default. The owner is warned that forwarding the link forwards access. | Simple gifting while making bearer-access risk clear. | Owner, Recipient | Business, frontend assistance | C09 |
| BR-SHR-003 | The share reveals only the ordered calendar's recipient-facing months, included images/messages/dates, designated AR content and non-AR fallback. It never reveals owner account settings, email, payment, order price/reference, contact data, unrelated Projects or unattached media. It grants no editing or ordering. | Strict least-access boundary. | Recipient | Multiple layers | C06, C09, C10 |
| BR-SHR-004 | Owner can revoke or regenerate access. Revocation/rotation invalidates the former credential for both AR and fallback immediately on subsequent access; regeneration creates a new explicit grant without changing ordered content. Two concurrent regenerations yield one current grant. | Owner control and safe response to a leaked link. | Owner, Recipient | Multiple layers | C09, C26 |
| BR-SHR-005 | P0 shares have no automatic expiry while their Order/version and active owner account remain available; the owner can revoke them at any time. Project archival does not silently revoke an order-bound share; Project deletion is disallowed once ordered. | A gift remains usable without an unexpected timer. | Owner, Recipient | Business | C09, C14 |

## 9. AR experience

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-AR-001 | For P0, the owner configures one designated calendar target and one genuine personalized reveal: a Ready image with meaningful readable caption/message, a Ready short video with appropriate readable caption/transcript, or Ready short audio with readable transcript/caption. The owner may preview the target-to-content mapping before ordering. The final demo needs one reliable prepared reveal, not every media type; more complex overlays/multi-target experiences are P2. | Deliver one reliable genuine reveal. | Owner | Multiple layers | C06, C10, C27 |
| BR-AR-002 | The paid Order captures the target identity, intended linked media and fallback content. Recipient scanning and fallback resolve **that Order's version**, not the owner's latest Working Project. Later edits or media replacement cannot remap an issued target. | Physical/on-screen target and digital reveal must stay aligned. | Owner, Recipient | Business, persistence | C09, C10, C12 |
| BR-AR-003 | A valid share is required before target recognition or fallback content can reveal private media. A supported prepared target resolves to its own intended personalized content and never another owner's private content. An unknown/ambiguous target reveals nothing private. | Core privacy and correctness invariant. | Recipient | Multiple layers | C09, C10 |
| BR-AR-004 | Unsupported device, denied camera permission, recognition failure, or unavailable camera gives clear help and **authorized non-AR access to the same meaningful content**. Missing/unready media or a revoked share gives an error, not a guessed substitute. | Accessibility and honest recovery. | Recipient | Business, frontend assistance | C10, C25, C26 |
| BR-AR-005 | A revoked share or disabled owner blocks both AR and fallback on subsequent access. Project archive alone does not; removal from the mutable Project does not erase retained Order media. | Consistent access and historical semantics. | Owner, Recipient | Multiple layers | C09, C10 |

The target/recognition technology and exact media-delivery protections remain Architecture decisions. They must satisfy the version and access rules above.

## 10. Orders, historical snapshots, and pricing

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-ORD-001 | Only the active owner may place an Order for their existing Working, Order-ready Project after seeing a current preview, explicit sandbox price summary, quantity 1–10, and required demo contact name/email. No physical shipping address is required or promised. | Complete an honest, proportionate course-demo checkout. | Owner | Multiple layers | C08, C12, C13 |
| BR-ORD-002 | Place Order fixes an immutable historical version: Template identity/name and captured design/style; project year, title, intended recipient, twelve Month content/events and referenced media; AR target/media/fallback; quantity, USD unit price/total and zero adjustments; and provided demo contact. Later Project, Template, or price edits never alter it. | The Order must describe what was actually requested. | Owner, Admin | Business, persistence | C02–C08, C10, C12 |
| BR-ORD-003 | One Project may intentionally produce multiple Orders, including repeated Orders of the same current version after an explicit new confirmation. While an unpaid Order for that version is still open, normal checkout retry resumes it. Two rapid submissions of the **same checkout intent** produce or return one Order, not two. | Permit reorders without accidental duplication. | Owner | Multiple layers | C12, C26 |
| BR-ORD-004 | A failed/cancelled payment attempt does not require a new Order; retry under the same open Order with a new Payment attempt. An owner may cancel an unpaid Order. A paid Order cannot be cancelled in P0 because refunds/reconciliation are outside scope. | Separate purchase intent from gateway attempts. | Owner | Business, persistence | C12, C13 |
| BR-ORD-005 | An Order remains visible to its owner with separate Payment and Fulfillment results. Admin sees only the order/context needed for operation. Recipient access never includes Order data. | Clear status without privacy leakage. | Owner, Admin, Recipient | Multiple layers | C09, C14, C15 |

### Academic pricing and currency decision

**Decision A: one currency end-to-end.** Display, Order, and preferred PayPal Sandbox payment amounts are all **USD**. USD is a [PayPal-supported currency](https://developer.paypal.com/api/codes/currency/) (checked 2026-10-11); the eventual sandbox account/payment method still needs normal setup verification. There is **no VND price, fixed conversion, or live exchange-rate service** in P0. Both VI and EN interfaces show `USD`/`$` unambiguously at Template selection, checkout, provider handoff, and Order/payment review. A language change never converts or changes a price.

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-PRICE-001 | Admin publishes a positive Template base **unit** price in USD with two-decimal precision. A Project captures that price at creation; later catalog price edits affect only new Projects. | Deterministic, explainable owner expectation. | Admin, Owner | Multiple layers | C02, C12, C15 |
| BR-PRICE-002 | P0 total = captured unit price × quantity (1–10). Discounts, add-ons, tax collected, shipping/physical-delivery fees and surcharges are all **USD 0.00**; no promotion engine exists. | Simple non-commercial academic model. | Owner, Admin | Business, persistence | C12, C13 |
| BR-PRICE-003 | Unit price and total have two USD decimal places; multiplication is exact to cents and no FX rounding occurs. The server-side business authority recalculates price/quantity/total when the Order is placed and checks them against the amount/currency sent to and reported by the provider. Frontend estimates are assistance only. | Prevent client price tampering or currency mismatch. | Owner, Admin | Multiple layers, provider evidence | C12, C13 |
| BR-PRICE-004 | Every checkout and payment-result view plainly says the transaction uses sandbox funds, is not a real-money purchase, and does not promise a physical shipment. | Avoid misleading users/faculty. | Owner, Admin | Multiple layers | C12, C13, C15 |

| Captured unit price | Quantity | Subtotal | Discount + tax + demo delivery | Total shown/paid |
| --- | ---: | ---: | ---: | ---: |
| USD 12.00 | 1 | USD 12.00 | USD 0.00 | **USD 12.00** |
| USD 14.50 | 2 | USD 29.00 | USD 0.00 | **USD 29.00** |
| USD 9.99 | 3 | USD 29.97 | USD 0.00 | **USD 29.97** |
| USD 20.00 | 10 | USD 200.00 | USD 0.00 | **USD 200.00** |

These are examples, not required catalog prices. Pricing is set by the product's authoritative business rules, not by the browser or provider display.

### Order lifecycle

| State | Meaning | Allowed transition; actor | Preconditions |
| --- | --- | --- | --- |
| **Placed** | Immutable Order request exists; Payment and Fulfillment have separate status. | → Cancelled by owner; → Closed automatically after simulated fulfillment completes. | Cancel only before verified payment; close only after completed Fulfillment. |
| **Cancelled** | Unpaid Order abandoned; no new Payment attempts or share. Terminal. | None. | No completed Payment; any pending attempt must be safely stopped/reconciled before cancellation is final. |
| **Closed** | Paid Order's demo fulfillment is complete. Historical record and authorized share may remain. Terminal. | None. | Verified paid and Fulfillment complete. |

There is no separate Order “Paid” state: payment truth belongs to Payment. “Placed” does not imply paid or shipped. Cancellation of a paid Order, refunds, and real shipping are not P0.

## 11. Payment, fulfillment, and their separation

**Order** is an owner's immutable request; **Payment** is one or more traceable non-real-money provider attempts against that Order; **Fulfillment** is the separately tracked, manually operated simulation. An Order can be Placed with no completed Payment and with Fulfillment waiting. A cancelled/failed Payment attempt does not erase its Order; a completed Payment does not itself mean Fulfillment complete.

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-PAY-001 | P0 uses an international **sandbox** gateway, with PayPal Sandbox preferred. Every attempt belongs to exactly one open Order and records a traceable provider reference/result without storing payment credentials. | Honest demo and auditable relationship. | Owner, Admin | Multiple layers | C13, C15 |
| BR-PAY-002 | A browser redirect, approval screen, callback, or user claim never proves completion. Only backend-verifiable provider evidence of a successful payment for the correct Order, USD amount, currency and attempt can make that attempt **Completed**. | Prevent false “paid” status. | Owner, Admin | Business, provider evidence, persistence | C12, C13 |
| BR-PAY-003 | No user or Admin may manually mark Payment Completed. Duplicate provider completion/capture evidence for one attempt is one outcome; at most one Completed attempt may settle an Order. Unknown/late evidence is checked against provider status, never blindly captured again. | Prevent duplicate success and forged payment. | Owner, Admin | Multiple layers, provider evidence | C13, C15 |
| BR-PAY-004 | Failed or Cancelled attempt remains historical and does not mark the Order paid. An owner may start a new attempt under the same Placed unpaid Order; concurrent starts for the same payment intent reuse one active attempt. | Safe retry without new unintended Orders. | Owner | Business, persistence | C12, C13 |
| BR-PAY-005 | Provider unavailability or uncertain result is shown as pending/needs verification; it is not silently promoted to Completed or Failed. Before another attempt, provider-status recheck must establish whether an earlier attempt succeeded. This is not banking reconciliation. | Avoid duplicate capture and dishonest outcome. | Owner, Admin | Business, provider evidence | C13, C26 |
| BR-FUL-001 | Fulfillment is **manually Admin-managed and physically simulated**. A new Order is Waiting for verified payment. Only after one verified Completed Payment may Admin move it to Preparing and then Demo complete. | A demo order is not real production/shipping. | Admin | Multiple layers | C12, C13, C15 |
| BR-FUL-002 | Only an authorized Admin may advance simulated fulfillment, with actor, time and reason/status history; stale or duplicate updates must not skip steps. An owner sees clear “demo/simulated” wording. | Operational integrity and transparency. | Admin, Owner | Multiple layers | C14, C15 |
| BR-FUL-003 | Cancelling an unpaid Order stops its Waiting fulfillment. Paid Orders cannot be cancelled/returned in P0; no carrier, tracking number, real packing, or actual dispatch is represented. | Keep demo lifecycle coherent and within scope. | Owner, Admin | Business | C12, C15 |

### Payment attempt lifecycle

| State | Meaning | Allowed transition; cause | Important condition |
| --- | --- | --- | --- |
| **Initiated** | Valid attempt associated with a Placed unpaid Order. | → Awaiting approval when provider flow is ready; → Failed if provider rejects initiation. | Same payment intent must not create concurrent duplicate attempts. |
| **Awaiting approval** | User may approve/cancel in sandbox. | → Verifying after apparent approval/return; → Cancelled on confirmed cancellation; → Failed on confirmed rejection. | Frontend return is not proof. |
| **Verifying** | Result is uncertain until provider evidence is checked. | → Completed only after correct verified success; → Cancelled/Failed only after trustworthy provider result. | If provider unavailable, remain Verifying and reconcile. |
| **Completed** | Correct provider success verified once for this Order/amount/currency. Terminal. | None. | Order now considered paid; no second successful attempt. |
| **Cancelled / Failed** | Attempt ended without verified success. Terminal. | New explicit retry creates a different attempt under same unpaid Order. | Neither means the Order was paid. |

An explicit owner cancellation of checkout before approval cannot override a later verified success; the uncertain attempt's provider status is checked first. Provider-specific technical steps remain for Architecture.

### Fulfillment lifecycle

| State | Meaning | Transition; actor | Gate |
| --- | --- | --- | --- |
| **Waiting for payment** | Order exists; no work is claimed. | → Preparing by Admin; → Stopped when unpaid Order is cancelled. | Preparing requires verified Completed Payment. |
| **Preparing (demo)** | Admin has begun simulated preparation. | → Demo complete by Admin. | Payment remains verified; progress action is auditable. |
| **Demo complete** | Simulated workflow finished; Order becomes Closed. | Terminal. | No claim of actual print/shipment. |
| **Stopped** | Unpaid Order was cancelled. | Terminal. | No preparation occurred. |

## 12. Admin and privacy boundaries

| Admin action | P0 authority | Boundary / evidence |
| --- | --- | --- |
| Create/edit/activate/deactivate Templates | Allowed | Changes affect new Projects; used Templates remain historically traceable. |
| View Orders and minimal user identity/contact | Allowed | Only for order operation and support; record operator access. |
| View Payment reference/result | Allowed | Read/reconcile verified evidence; cannot forge success or initiate a user's payment. |
| Update demo Fulfillment | Allowed | Only legal gated transitions; log actor/time/reason. |
| View ordered calendar snapshot/media | Allowed only when necessary to support that Order | Purpose-limited access to that Order's content, logged; not a browser for all private work. |
| Open a current private draft or unrelated media | Not allowed by Admin role in P0 | Owner must request any future exceptional support access; a reviewed scope/authority change would define consent, purpose, duration and audit before it exists. |
| Edit/delete another user's Project/media/events or change its share | Not allowed | Only owner controls content/share; security suspension of an account is separate. |
| Manage payment completion/refunds or real shipment | Not allowed | Provider evidence controls payment; real commerce is out of scope. |

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-ADM-001 | Admin authority is purpose-limited to Templates, Orders, verified payment references, minimal order contact, and simulated Fulfillment. Relevant access/status changes are auditable. | Operability without surveillance or editorial control. | Admin | Multiple layers | C15 |
| BR-ADM-002 | Admin may inspect an Order's fixed calendar context/media only for fulfillment or concrete support need; P0 gives no blanket access to current private drafts or unrelated uploads and no power to edit/delete owner content. | Least-privilege support. | Admin, Owner | Multiple layers | C03, C06, C15 |
| BR-PRV-001 | Projects/media are private by default. Access checks apply to every read/write and to derived previews/AR content; knowing an identifier or being Admin is insufficient. | Prevent cross-user disclosure. | All actors | Multiple layers | C03, C06, C09 |
| BR-PRV-002 | Recipient access is explicit, read-only, version-bound and revocable. It excludes account, contact, pricing, payment, order and unrelated media. Revocation blocks both camera and fallback access. | Protect the owner and recipients. | Owner, Recipient | Multiple layers | C09, C10 |
| BR-PRV-003 | Disabled owner account suspends owner actions and recipient shares; restoration may restore still-valid shares only after operator review. User-generated names/media/text are not translated or made public merely by account/order existence. | Security response and content integrity. | Owner, Recipient, Admin | Business, persistence | C01, C09, C23 |

## 13. Delete, archive, and retention semantics

| Object | During semester: hard delete / archive / retained history | Dependency rule |
| --- | --- | --- |
| User account | No self-service deletion. Admin may disable/re-enable; course-team cleanup after assessment is separate from product workflow. | Keep ownership and payment traceability while Orders exist. |
| Template | Deactivate/archive; no P0 hard delete. | Existing Projects/Orders retain captured baseline. |
| Calendar Project | Owner may permanently delete only if never ordered; otherwise archive/restore. | Deleting an un-ordered Project removes its private content and any unreferenced media; ordered content remains with Orders. |
| Month / Special Date | Owner may edit/remove from Working Project. | Historical Order versions retain prior values. |
| Media | Owner may remove from current Project; unattached/failed uploads become inaccessible and are cleaned promptly. | Media referenced by an Order is retained through assessment even if its share is revoked; revocation removes recipient access, not historical evidence. Removal from the Working Project is not historical erasure. |
| Order | No P0 hard deletion; unpaid can be Cancelled, paid eventually Closed. | Historical snapshot/price and associated evidence remain. |
| Payment attempt/evidence | No user/Admin deletion or rewriting during semester. | Preserve verified result and failure history; never keep card/payment credentials. |
| Recipient share | Owner revokes/regenerates; old credential immediately ceases granting access. | Revocation does not delete immutable Order content. |

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-PRV-004 | Retain Order snapshots, their necessary media, payment evidence and minimal contact through final course assessment. The course team performs documented demo-data cleanup within 30 days after assessment unless the institution explicitly requires a different retention period; no real customer data is needed for the demo. | Simple finite retention with historical integrity. | Owner, Admin | Business, persistence | C06, C12, C13, C15 |
| BR-PRV-005 | Revoked shares, deleted never-ordered Projects and orphan uploads cease access immediately; physical cleanup may be asynchronous but must be completed within the same 30-day end-of-demo cleanup window, with failed/unattached uploads cleaned sooner. | Access revocation must not wait for file deletion. | Owner, Recipient, Admin | Multiple layers | C03, C06, C09 |

No technical cascade, file provider, or backup mechanism is prescribed. If institution policy conflicts with the proposed 30-day cleanup, that is an explicit policy review before collecting real participant content, not permission to silently retain indefinitely.

## 14. Concurrency and validation authority

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-CON-001 | Repeating/concurrently submitting one checkout intent yields one Order and its fixed snapshot. A deliberate later reorder requires a new explicit confirmation. | Prevent double orders from double-click/retry. | Owner | Business, persistence | C12 |
| BR-CON-002 | Repeating/concurrently starting one payment intent yields one active attempt; after definitive Failed/Cancelled, a new explicit retry may make another attempt under the same Order. | Avoid duplicate gateway attempts. | Owner | Business, persistence | C13 |
| BR-CON-003 | Duplicate/out-of-order provider completion evidence is reconciled against the same attempt and Order, producing at most one Completed outcome and never a second capture/settlement claim. | Payment integrity. | Owner, Admin | Business, persistence, provider evidence | C13 |
| BR-CON-004 | Concurrent Admin Fulfillment updates apply only from the observed current state; a stale update is rejected/reviewed, never silently skips a gate. | Preserve state sequence and audit truth. | Admin | Business, persistence | C15 |
| BR-CON-005 | Repeated finalization of the same media upload yields one Ready item; incomplete/failed media is not attached twice or exposed. | Stable preview and media limits. | Owner | Business, persistence | C06 |
| BR-CON-006 | Repeated share creation/regeneration for one owner intent yields one current credential; a rotated or revoked credential never regains validity because of a racing request. | Reliable revocation. | Owner, Recipient | Business, persistence | C09 |
| BR-VAL-001 | Frontend validation assists users; backend/domain validation and permission checks are authoritative on protected operations, with persistence guarding critical uniqueness/relationship invariants. Provider evidence is authoritative only for provider-owned payment facts. | Clients can be bypassed; provider cannot decide ownership/pricing. | All actors | Multiple layers | C01–C15, C26 |

| Example | Helpful frontend check | Authoritative business rule | Additional authority |
| --- | --- | --- | --- |
| Email | Format/required feedback | Normalize, format, unique account identity | Persistence protects uniqueness. |
| Project year | Show allowed years | Current through +2 at creation; existing year remains valid | Persistence keeps Project/Month association. |
| Month | Only show 1–12 | Exactly one per number and Project | Persistence protects uniqueness. |
| Event date | Calendar picker/leap-day feedback | Real date within Project year | Persistence protects relationship. |
| Quantity | Display 1–10 control | Reject outside 1–10 at Place Order | Order snapshot preserves accepted value. |
| Price | Show estimated total | Recompute captured price × quantity in USD | Provider verifies charged amount/currency, not product pricing policy. |
| Payment completion | Show pending while returning | Check correct Order/attempt/amount/currency | Backend-verifiable provider evidence. |
| Ownership | Hide unavailable controls | Recheck owner/role/share on each protected action | Durable owner/share relationship. |

### Business error/rejection vocabulary

| Category | Conceptual use and user outcome |
| --- | --- |
| Validation failure | Input is malformed/out of allowed business range; identify repairable field without leaking private data. |
| Unauthenticated | Protected account action lacks an active session; offer login. |
| Forbidden | Actor lacks ownership/role/valid share; do not expose target content. |
| Not found | Object absent or cannot be safely disclosed to actor; no private details. |
| Conflict | Concurrent duplicate/stale intent or changed version; show current safe state and retry path. |
| Invalid state transition | E.g., archive-only Project ordered, unpaid Fulfillment advance, paid Order cancellation; explain valid next action. |
| Provider unavailable | Gateway truth cannot currently be checked; preserve pending state and allow reconciliation. |
| Payment rejected | Provider confirms failure/cancellation; Order stays unpaid and retry is possible when eligible. |
| Media unavailable | Upload or ordered media cannot be read; do not substitute a different item. |
| AR unavailable | Camera/target/recognition path unavailable; provide authorized fallback if share remains valid. |

No HTTP status or exact message code is specified here. UI feedback follows the approved Design System and Product Scope C26.

## 15. P1 notifications, P2 wishes, and language

| ID | Rule | Reason | Applies to | Enforcement | Scope |
| --- | --- | --- | --- | --- | --- |
| BR-NOT-001 | **P1:** in-product notifications cover verified payment completion or definitive failure, and meaningful demo Fulfillment changes. P0 account views already show these statuses; no notification is sent for every save/edit. | Inform owners about consequential changes without noise. | Owner | Business | C17 |
| BR-NOT-002 | **P1 only if P2 wishes is enabled:** notify owner of a submitted wish awaiting moderation; notify a registered contributor of an owner decision only if that contributor has an account/appropriate visibility. Never reveal private recipient content in an unrelated notification. | Useful moderation feedback without anonymous-contact collection. | Owner, Contributor | Business | C11, C17 |
| BR-WISH-001 | **Dormant P2:** only an explicitly invited contributor may submit a short personal wish to the intended Project; submission is private/pending until owner approval and any approved wish can enter only a future ordered recipient version. A contributor cannot edit the Project or publish directly. | Preserve owner control and privacy. | Contributor, Owner | Multiple layers if enabled | C11 |
| BR-WISH-002 | **Dormant P2:** owner may approve, reject, or remove a wish; only approved content enters a future recipient version, never retroactively an existing Order. If C11 is approved, an invitation permits at most one pending wish at a time and a Project displays at most 20 approved wishes; repeated/spam submissions are limited and reviewable. | Moderation without burdening P0 design. | Contributor, Owner | Business if enabled | C11 |
| BR-I18N-001 | Business concepts, states, amounts, dates and permission outcomes have language-independent meaning. Product-managed labels/instructions/errors for P0 flows have approved Vietnamese and English presentations; switching language does not change state, price or access. | Consistent bilingual product behavior. | All actors | Business, frontend assistance | C23 |
| BR-I18N-002 | User-authored names, captions, events, media transcripts and wishes remain in the author's language; no automatic translation is promised. Raw provider errors are mapped to safe VI/EN product explanations, not displayed blindly. | Respect authorship and avoid unsafe/confusing gateway text. | All actors | Business, frontend assistance | C23, C26 |

P2 wishes, blog, analytics, richer AR/music and reactions do not block or enlarge P0 entities/flows. P2 contribution rules are a future constraint **if approved**, not authorization to implement C11 now. Email verification, email change, account self-delete, real payment/refunds/shipping, discounts, newsletter, reviews, blog comments/likes, and broad admin private-content management are not hidden P0/P1 tasks.

## 16. Consolidated business invariant register

| ID | Invariant | Reason | Future enforcement layers |
| --- | --- | --- | --- |
| INV-01 | Every Calendar Project has exactly one non-transferable owner. | Private authority is unambiguous. | Business + persistence + access checks. |
| INV-02 | Every Project represents exactly Months 1–12 once each. | Full-year calendar promise. | Business + persistence + acceptance tests. |
| INV-03 | No user may edit another owner's private Project. | Ownership/privacy. | Business + access checks + tests. |
| INV-04 | Recipient access reveals only its authorized ordered recipient version, never account/order/contact/unrelated content. | Least disclosure. | Business + access checks + tests. |
| INV-05 | An Order's content, AR mapping, price, currency and quantity never change because its Project or Template changes later. | Historical correctness. | Business + immutable persistence + tests. |
| INV-06 | Payment cannot be Completed from frontend state alone; correct backend-verifiable provider evidence is required. | Payment truth. | Business + provider evidence + durable state + tests. |
| INV-07 | Sandbox funds/fulfillment are never presented as real-money purchase or actual shipment. | Honest academic demonstration. | Business + VI/EN content + acceptance review. |
| INV-08 | A recognized target cannot reveal another user's private media; unknown/ambiguous target reveals nothing private. | Highest-risk AR privacy failure. | Business + access/version checks + tests. |
| INV-09 | Only authorized Admin actions advance demo Fulfillment and only after verified payment. | Operational integrity. | Business + access checks + audit + tests. |
| INV-10 | Duplicate Payment completion evidence does not produce two successful outcomes or captures for one Order. | Financial/demo integrity. | Business + persistence + provider-status verification + tests. |
| INV-11 | Inactive Templates cannot create new Projects, but existing Projects keep their captured baseline and remain usable/orderable. | Stable owner expectation. | Business + persistence + tests. |
| INV-12 | At most one current share credential grants access for one Order; revocation/rotation blocks old credentials for AR and fallback. | Effective privacy control. | Business + access checks + concurrency tests. |
| INV-13 | An Order can be paid at most once, although it may have multiple failed/cancelled attempts. | Safe retries. | Business + persistence + provider-status verification. |
| INV-14 | A paid/ordered Project cannot be hard-deleted through P0 product use; historical references survive current edits. | Recipient and order continuity. | Business + persistence + tests. |

## 17. Conceptual state diagrams

```text
Calendar Project:  Created → Working ⇄ Archived
                                  ↘ Deleted only if never ordered
                   Place Order creates an immutable Order; Project stays Working.

Order:             Placed → Cancelled (only before verified payment)
                      ↘ Closed (only after demo Fulfillment complete)

Payment attempt:   Initiated → Awaiting approval → Verifying → Completed
                       ↘ Failed      ↘ Cancelled       ↘ Failed/Cancelled
                   Uncertain provider outcome remains Verifying.
                   A new attempt after definitive failure/cancellation belongs to same Order.

Fulfillment:       Waiting for payment → Preparing (demo) → Demo complete
                            ↘ Stopped (only when unpaid Order cancelled)

AR readiness:      Target + Ready linked media + readable text → AR-ready
                   AR-ready + verified paid Order version + explicit share → recipient access
                   Camera failure → same authorized non-AR content; revoked share → no content.
```

State words describe business meaning. They are not mandated SQL enums, API values or UI strings.

## 18. Given / When / Then acceptance examples

| # | Given | When | Then |
| --- | --- | --- | --- |
| A01 | A Template is inactive | A user tries to create a new Project from it | Creation is rejected; only active published Templates can start new Projects. |
| A02 | A Project was created from an active Template | Admin deactivates/edits that Template | The Project keeps its design/price baseline and can still be edited and ordered when otherwise ready. |
| A03 | User A owns a private Project | User B tries to read/edit it without a valid share | B cannot see/edit it; knowledge of its identifier gives no authority. |
| A04 | An Order captured version V and USD 29.00 | Owner later edits the Project and Admin changes Template price | The Order and its AR recipient version remain V at USD 29.00. |
| A05 | Owner has one reviewed checkout intent | Place Order is clicked twice rapidly | One Order is created/returned, not two; deliberate later reorder needs new confirmation. |
| A06 | A sandbox Payment is awaiting approval | Buyer cancels at provider | Attempt becomes Cancelled on trustworthy result; Order stays unpaid/Placed and can be retried or cancelled. |
| A07 | Gateway returns an approval/redirect | Backend verifies matching successful provider evidence for Order, amount and USD currency | Attempt becomes Completed once; Order is paid and Fulfillment may begin. |
| A08 | A Payment attempt is already Completed | The same completion evidence arrives again | No second capture, paid outcome or Fulfillment trigger is created. |
| A09 | Owner has shared a paid Order | Owner revokes the share and recipient reopens it | Both AR and non-AR content are denied; private media is not revealed. |
| A10 | Recipient has a valid share and points at a prepared target linked to a Ready personal image with a meaningful readable caption | Recognition succeeds | Only that image and caption from the Order's recipient version appear, never another owner's content; video and audio are not required for this reveal. |
| A11 | Recipient has valid share but device lacks AR/camera | Recipient chooses fallback | The same authorized meaningful content is readable without camera use. |
| A12 | Admin can inspect an Order | Admin attempts to edit/delete the owner's unrelated private Project/media | Action is rejected; Admin role is not owner authority. |
| A13 | Owner has a Working Project with twelve Months but no Ready photo/AR item | Owner previews then places an Order | Preview works with missing-content feedback; Order is rejected until Order-ready. |
| A14 | An unpaid Order has Failed payment attempt | Owner explicitly retries | A new attempt belongs to that same Order; the failed one remains historical. |
| A15 | Order has no verified payment | Admin tries to set Fulfillment to Preparing | Transition is rejected; Waiting remains. |
| A16 | A paid Order share exists and its source Project is archived | Recipient opens still-valid share | Ordered version remains available; archive does not silently revoke a delivered gift. |
| A17 | An owner has a Working Project with valid identity/year, exactly twelve Months, a Ready personal image, an AR-ready target/reveal, and has reviewed the current preview, but has added no Special Date | Owner places an Order | The Order is allowed; C07 remains P0 functionality and the official university demo separately demonstrates a Special Date. |

## 19. Priority boundary and handoff

**P0 binding:** BR-ID except `BR-ID-008`; Template, Project, Month, Media, Event, readiness, sharing, AR, Order, pricing, Payment, Fulfillment, Admin, privacy, concurrency, validation, I18N, and invariants that apply to them. **P1 dormant until scheduled:** `BR-ID-008` password recovery and `BR-NOT-001` basic in-product notifications. **P2 dormant until separately approved:** `BR-WISH-001/002`, `BR-NOT-002` contribution notices, and any richer AR/music/blog/analytics work. P2 does not require P0 to build wish moderation or social infrastructure.

**Architecture.md** can now allocate responsibilities for identity, ownership checks, immutable versioning, private media access, target resolution, provider verification/status recheck, idempotency and audit. It must not collapse Payment into Order, make a browser authoritative for payment, or let an AR technology redefine recipient access.

**Database.md** can model owners, exactly twelve Months, captured Template/price baselines, immutable Order/AR/media versions, attempts, fulfillment history and revocable shares. It must not redefine owner transfer, retroactively change Order content, or permit a second settled Payment.

**API_CONTRACT.md** can define commands, representations, errors and retry semantics for these business outcomes. It must not invent a frontend “mark paid,” let an Admin edit private owner content, expose Order/contact data through recipient access, or decide a different pricing/currency policy.

**Open blockers:** none for Architecture/Database design. Before implementation, the team must verify its actual sandbox account supports the chosen USD flow and align the 30-day post-assessment cleanup with institution policy; neither changes the approved P0 product scope. Any request for pre-payment sharing, real shipment/refund, email verification/change, account deletion, more AR targets, or admin private-draft support access is an explicit scope/business-rule revision, not a silent implementation choice.
