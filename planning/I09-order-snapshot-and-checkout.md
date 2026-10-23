# I09 — Order Snapshot + Checkout

## Summary

Authoritative USD quote and immutable relational snapshot with correct media/target pins.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M3 — Order & Recipient Experience

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

LEAD

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

MEMBER_2, MEMBER_3, MEMBER_4. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I08](I08-preview-and-readiness-and-target-preparation.md); [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I08](I08-preview-and-readiness-and-target-preparation.md); [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md) until their acceptance artifacts are available.
- Blocks: [I10](I10-paypal-sandbox-payment.md), [I11](I11-recipient-sharing-and-fallback.md), [I13](I13-admin-orders-demo-fulfillment.md), [I14](I14-account-views.md) (direct roadmap consumers).
- Can run in parallel with: Checkout presentation can use reviewed DTO fixtures after P01; live acceptance waits for snapshot/API work. [I10](I10-paypal-sandbox-payment.md) follows accepted [I09](I09-order-snapshot-and-checkout.md); later Admin/account fixture preparation cannot claim fulfillment/payment acceptance.

The authoritative dependency row is **I08, I01, I02** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [DATABASE](../docs/DATABASE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Authoritative USD quote and immutable relational snapshot with correct media/target pins. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Place Order/idempotency.
- snapshot/API.
- quantity/contact summary.
- unpaid cancellation.
- Waiting Fulfillment.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- FX, discounts/tax/shipping fees, real shipment, paid cancellation/refund.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

INV-05/14 and BR-ORD/PRICE/CON: relational immutable snapshot, twelve Months, optional events, pinned Ready media/target. USD captured unit price × quantity 1–10; all adjustments zero; only demo contact name/email. Project stays Working after Order; same-intent retry differs from explicit reorder.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i09-p01"></a>

### I09-P01 — Pricing, checkout and snapshot policy contract

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I08](I08-preview-and-readiness-and-target-preparation.md); [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md) Inherited item hard gates: [I08](I08-preview-and-readiness-and-target-preparation.md); [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Own authoritative checkout rules before persistence/UI expansion.

**Scope:** Exact USD calculation, quantity/contact limits, reviewed-version eligibility, snapshot fields and separate lifecycle/error contract.

**Expected areas/files/modules:** Orders domain/application ports and reviewed DTO/OpenAPI design. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No submitted price/total or physical address; no event count or per-Month photo requirement.

**Acceptance criteria:**

- [ ] Quote derives from captured baseline.
- [ ] Quantity/contact/current review are validated.
- [ ] Project/Order/Payment/Fulfillment remain separate.

**Tests required:** Jest exact-cent, quantity and readiness policy tests; T07/T19.

**Out of scope:** FX, taxes, discounts or paid cancellation.

**Review focus:** Authoritative price and content contract.

---

<a id="i09-p02"></a>

### I09-P02 — Atomic relational Order snapshot capture

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I09-P01](I09-order-snapshot-and-checkout.md#i09-p01) Inherited item hard gates: [I08](I08-preview-and-readiness-and-target-preparation.md); [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Freeze what the owner actually reviewed.

**Scope:** Order/version/twelve Month/date/media/AR children, historical pins, contact/price and initial Waiting fulfillment in one transaction.

**Expected areas/files/modules:** Orders application orchestration/repositories collaborating with Project/Media/AR ports. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Shared Project-root lock/expected revision; no provider calls in transaction; historical reads never join mutable content.

**Acceptance criteria:**

- [ ] Snapshot has exactly twelve Months and optional events.
- [ ] Price/content/artifacts are fixed atomically.
- [ ] Failure rolls back Order, children and pins.
- [ ] R1 V09: persist actual captured Order snapshot references and immutable media/target artifact pins atomically; historical content never resolves through a mutable current-artifact pointer.

**Tests required:** T04/T05/T24 real-PostgreSQL rollback, mixed-edit race and before/after equality tests.

**Out of scope:** Opaque whole-snapshot JSON or later historical edits.

**Review focus:** INV-05/14 and consistent capture.

---

<a id="i09-p03"></a>

### I09-P03 — Checkout intent, replay and unpaid cancellation

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I09-P02](I09-order-snapshot-and-checkout.md#i09-p02) Inherited item hard gates: [I08](I08-preview-and-readiness-and-target-preparation.md); [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Prevent duplicate requests while allowing intentional later Orders.

**Scope:** Actor/key/request digest, open-version slot, accepted replay before stale ETag, cancel eligibility and slot release.

**Expected areas/files/modules:** Orders use cases and idempotency/Payment fact ports. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Settlement release integrates with I10; cancellation cannot bypass unresolved durable attempts. Changed input conflicts.

**Acceptance criteria:**

- [ ] Double-click/lost-response returns one Order.
- [ ] Changed contact/quantity cannot rewrite it.
- [ ] Eligible cancellation atomically stops Waiting fulfillment and releases slot.

**Tests required:** T06/T08/T12 DB concurrency and idempotency/precondition tests.

**Out of scope:** Blind cancellation of uncertain/paid attempts.

**Review focus:** Replay ordering and intent separation.

---

<a id="i09-p04"></a>

### I09-P04 — Owner Order and historical content REST API

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I09-P03](I09-order-snapshot-and-checkout.md#i09-p03) Inherited item hard gates: [I08](I08-preview-and-readiness-and-target-preparation.md); [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Expose fixed history through explicit owner projections.

**Scope:** Place/read/list/snapshot/cancel, retained media/target paths, no-store and reviewed OpenAPI/client types.

**Expected areas/files/modules:** Orders interface and scoped media/AR delivery composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Controllers invoke LEAD-owned use cases; keep recipient projection separate. Backend implements /health/live and /health/ready alignment via I01 platform work, not this business slice.

**Acceptance criteria:**

- [ ] Cross-owner history is denied safely.
- [ ] Historical paths use pinned references.
- [ ] Versions, envelope and sandbox fields match contract.

**Tests required:** Supertest owner/projection/stream/ETag and OpenAPI consistency tests.

**Out of scope:** Admin blanket access or recipient Order DTO reuse.

**Review focus:** Safe immutable projection.

---

<a id="i09-p05"></a>

### I09-P05 — Checkout quantity, demo contact and review experience

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I09-P04](I09-order-snapshot-and-checkout.md#i09-p04) Inherited item hard gates: [I08](I08-preview-and-readiness-and-target-preparation.md); [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Let the owner commit an informed academic Order.

**Scope:** USD summary with zero components, name/email, current preview/revision, sandbox/no-shipment disclosure and same-intent submit/retry.

**Expected areas/files/modules:** Frontend Orders checkout feature and shared forms/summary. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** UI estimates assist; only backend acceptance establishes Order. Re-review on version conflict; no shipping address.

**Acceptance criteria:**

- [ ] USD and sandbox context are explicit.
- [ ] Double-click/retry preserves intent.
- [ ] Conflict preserves input and requests review of current content.

**Tests required:** Testing Library form/idempotency/conflict and browser zero-event checkout tests.

**Out of scope:** Payment completion or arbitrary contact collection.

**Review focus:** Truthful price and explicit commitment.

---

<a id="i09-p06"></a>

### I09-P06 — Order result and safe resume/cancel interaction

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I09-P04](I09-order-snapshot-and-checkout.md#i09-p04) Inherited item hard gates: [I08](I08-preview-and-readiness-and-target-preparation.md); [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Can run in parallel with: [I09-P05](I09-order-snapshot-and-checkout.md#i09-p05) once each task's prerequisites are accepted.

**Purpose:** Own the immediate post-checkout operational experience.

**Scope:** Fixed Order result, separate unpaid/Waiting state, retry resume and eligible cancellation feedback.

**Expected areas/files/modules:** Frontend Orders result/status composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Full account history/navigation is I14; this slice supports checkout continuation only.

**Acceptance criteria:**

- [ ] Confirmed Order uses fixed snapshot details.
- [ ] Unpaid retry resumes the existing unchanged Order.
- [ ] Cancellation eligibility follows backend outcome.

**Tests required:** Component result/retry/cancel tests and API integration.

**Out of scope:** Full account dashboard or optimistic paid status.

**Review focus:** Separate lifecycles and preserved intent.

---

<a id="i09-p07"></a>

### I09-P07 — Snapshot and checkout concurrency acceptance

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I09-P02](I09-order-snapshot-and-checkout.md#i09-p02); [I09-P03](I09-order-snapshot-and-checkout.md#i09-p03); [I09-P04](I09-order-snapshot-and-checkout.md#i09-p04); [I09-P05](I09-order-snapshot-and-checkout.md#i09-p05); [I09-P06](I09-order-snapshot-and-checkout.md#i09-p06) Inherited item hard gates: [I08](I08-preview-and-readiness-and-target-preparation.md); [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Prove historical truth before financial work depends on it.

**Scope:** Same/different-key races, child-edit capture barriers, reorders after slot release and retained media/target equality.

**Expected areas/files/modules:** Orders DB/API/browser regression evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use real PostgreSQL; source modification and snapshot comparison must exercise actual persistence paths.

**Acceptance criteria:**

- [ ] One intended checkout creates one Order.
- [ ] No mixed revision snapshot commits.
- [ ] Later edits/deactivation cannot change history or exact USD values.
- [ ] R1 V09: verify actual captured Order snapshot/pin persistence and historical stability across later Project/media/target edits using real PostgreSQL persistence paths and before/after equality checks.

**Tests required:** T04–T08/T19/T24 real-DB races and focused browser checkout plus static gates.

Transferred source: [R1 V09](../spikes/ar/I03-acceptance-boundary-revision.md#deferred-verification-register); I08 supplies immutable preparation artifacts before I09 capture. Failure reopens selection under R3/R5; integrated historical recipient validation remains at [I12-P06](I12-ar-signature-experience.md#i12-p06).

**Out of scope:** Provider acceptance or full account completion.

**Review focus:** Invariant evidence under concurrency.

## Integration / Merge Order

P01 is the commerce rule/DTO review gate. P02 captures history; P03 coordinates intent/cancellation. P04 publishes authoritative APIs before P05/P06 live UI integration. P07 proves concurrency and history before payment expands.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Concurrent duplicate one Order, consistent reviewed revision/twelve Months, later edits do not alter content/price, no event gate.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Place a reviewed zero-event Order, double-submit it, modify the source Project/Template/media afterward and show the unchanged snapshot/USD amount; demonstrate eligible unpaid cancellation.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Child edits versus snapshot capture can mix content unless all use Project-root coordination. Idempotent replay must precede rejection of its originally successful old version. Changed quantity/contact cannot rewrite an open Order. Uncertain payment must block cancellation.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
