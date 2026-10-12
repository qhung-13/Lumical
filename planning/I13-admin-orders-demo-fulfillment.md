# I13 — Admin Orders / Demo Fulfillment

## Summary

Least-privilege operational Order/payment view and audited simulated progression.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M4 — Product Completion

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

MEMBER_4

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

LEAD, MEMBER_3, MEMBER_2. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md)
- Soft/helpful dependencies: [I06](I06-private-media-pipeline.md) (ordered media delivery, already transitively required by [I09](I09-order-snapshot-and-checkout.md))
- Blocked by: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md) until their acceptance artifacts are available.
- Blocks: [I14](I14-account-views.md), [I15](I15-vi-en-theme-hardening.md), [I17](I17-p1-recovery-notifications.md), [I19](I19-final-e2e-security-demo-hardening.md) (direct roadmap consumers).
- Can run in parallel with: [I11](I11-recipient-sharing-and-fallback.md) after payment; [I12](I12-ar-signature-experience.md) once Sharing is accepted. Admin presentation fixtures may start after fixed Orders/reviewed DTOs per ROADMAP §5, not paid transition acceptance.

The authoritative dependency row is **I10, I09** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [DATABASE](../docs/DATABASE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [DESIGN_SYSTEM](../docs/DESIGN_SYSTEM.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Least-privilege operational Order/payment view and audited simulated progression. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Purpose-bound ordered inspection.
- Waiting→Preparing→Demo complete.
- history and Order closure.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Logistics/carrier/real printing, blanket private media browser.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

Only Admin, only after verified settlement: Waiting→Preparing→Demo complete, then Order Closed atomically. Unpaid cancellation gives Stopped. Minimal operation/contact/payment facts; ordered-content inspection needs concrete purpose, actor/Order binding, 15-minute expiry and audit. No private draft editor or paid override.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i13-p01"></a>

### I13-P01 — Demo Fulfillment policies and transaction

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md) Inherited item hard gates: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Own the real operational state transition implementation.

**Scope:** Legal settlement-gated transitions, If-Match/idempotency, reason/history/audit and atomic Order closure.

**Expected areas/files/modules:** Fulfillment domain/application/repositories with Orders/Payments public ports. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** LEAD reviews settlement and shared transaction boundary before dependent API/UI work.

**Acceptance criteria:**

- [ ] Unpaid/non-Admin advance is rejected.
- [ ] State/history/audit/closure commit together.
- [ ] Stale or duplicate update cannot skip a step.

**Tests required:** T13 PostgreSQL/API transition, race, rollback and closure tests.

**Out of scope:** Carrier, tracking, paid cancellation or real shipment.

**Review focus:** INV-09 and truthful separate lifecycles.

---

<a id="i13-p02"></a>

### I13-P02 — Minimal Admin operational query and command API

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I13-P01](I13-admin-orders-demo-fulfillment.md#i13-p01) Inherited item hard gates: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Expose only necessary operational information.

**Scope:** Order list/detail/contact/payment support references, allowlisted filters, audited access and fulfillment commands.

**Expected areas/files/modules:** Backend Admin interface/application and generated contract. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No share credentials, global draft/media browsing or direct cross-module ORM edits; refresh delegates I10 provider-status authority.

**Acceptance criteria:**

- [ ] Admin sees only operation-needed fields.
- [ ] Owner/recipient roles cannot call Admin operations.
- [ ] Audit and canonical error/version contract are consistent.

**Tests required:** Supertest role/projection/filter/version and real-DB audit checks.

**Out of scope:** Mark-paid endpoint or general account surveillance.

**Review focus:** Least-privilege DTOs and delegation.

---

<a id="i13-p03"></a>

### I13-P03 — Purpose-bound historical content inspection

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I13-P02](I13-admin-orders-demo-fulfillment.md#i13-p02) Inherited item hard gates: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: [I13-P04](I13-admin-orders-demo-fulfillment.md#i13-p04) once each task's prerequisites are accepted.

**Purpose:** Give scoped support access without owner impersonation.

**Scope:** Order/actor/purpose/reason grant, 15-minute expiry and media/target artifact range paths.

**Expected areas/files/modules:** AdminContentAccess use cases and shared Media/AR delivery composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Only immutable ordered version; every new request checks active actor/grant/scope and records safe audit.

**Acceptance criteria:**

- [ ] Expired/wrong-actor/wrong-Order grants deny content.
- [ ] Draft and unrelated assets are inaccessible.
- [ ] Range/HEAD cannot bypass grant or no-store.

**Tests required:** T18 API/DB purpose/expiry/actor/reference/range negatives with controlled Clock.

**Out of scope:** Private draft support consent feature or content editing.

**Review focus:** Purpose/expiry and least disclosure.

---

<a id="i13-p04"></a>

### I13-P04 — Admin order list and verified result detail

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I13-P02](I13-admin-orders-demo-fulfillment.md#i13-p02) Inherited item hard gates: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: [I13-P03](I13-admin-orders-demo-fulfillment.md#i13-p03) once each task's prerequisites are accepted.

**Purpose:** Deliver the operational data view and status clarity.

**Scope:** Responsive list/table, safe filters, minimal contact, separate payment/fulfillment and audited status refresh.

**Expected areas/files/modules:** Frontend Admin Orders feature with shared DS data layouts. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Compact mode uses labeled key-value rows; no chart/report expansion; pending payment is not failed.

**Acceptance criteria:**

- [ ] Admin can find permitted Orders.
- [ ] Verified/pending results are accurately worded.
- [ ] Keyboard/320px/200% preserve labels/actions.

**Tests required:** Component list/filter/status and browser Admin read/recheck tests.

**Out of scope:** Advanced analytics or payment completion control.

**Review focus:** Operational usefulness and safe status.

---

<a id="i13-p05"></a>

### I13-P05 — Fulfillment and inspection interaction

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I13-P01](I13-admin-orders-demo-fulfillment.md#i13-p01); [I13-P02](I13-admin-orders-demo-fulfillment.md#i13-p02); [I13-P03](I13-admin-orders-demo-fulfillment.md#i13-p03); [I13-P04](I13-admin-orders-demo-fulfillment.md#i13-p04) Inherited item hard gates: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Make Admin actions explicit, auditable and safe.

**Scope:** Reason input, allowed transition controls, stale-state recovery, purpose-bound inspection and expiry feedback.

**Expected areas/files/modules:** Frontend Admin Fulfillment/inspection composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use shared confirmation/focus patterns; refresh current state before new intent; no optimistic completion.

**Acceptance criteria:**

- [ ] Only eligible transitions are offered and server-checked.
- [ ] Reason/purpose remains explicit.
- [ ] Expired/conflicting operations preserve recoverable UI state.

**Tests required:** Component reason/conflict/expiry tests and synthetic Admin fulfillment flow.

**Out of scope:** Real print/dispatch claims or owner editing.

**Review focus:** Concrete intent and truthful demo wording.

---

<a id="i13-p06"></a>

### I13-P06 — Admin permission, race and audit acceptance

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I13-P01](I13-admin-orders-demo-fulfillment.md#i13-p01); [I13-P02](I13-admin-orders-demo-fulfillment.md#i13-p02); [I13-P03](I13-admin-orders-demo-fulfillment.md#i13-p03); [I13-P04](I13-admin-orders-demo-fulfillment.md#i13-p04); [I13-P05](I13-admin-orders-demo-fulfillment.md#i13-p05) Inherited item hard gates: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Prove operations cannot bypass financial/private-content authority.

**Scope:** Unpaid/stale/non-Admin transitions, wrong inspection context, safe contact/provider reference projection and simulation copy.

**Expected areas/files/modules:** Admin/Fulfillment DB/API/browser review evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** MEMBER_4 owns operational fixes; MEMBER_3 owns delivery fixes; LEAD final security review.

**Acceptance criteria:**

- [ ] Invalid transition/role never changes state.
- [ ] Inspection never accesses current drafts.
- [ ] Demo/no-shipment wording and audit history are observable.

**Tests required:** T13/T18/T25 real-DB races/API negatives and T21 browser checks.

**Out of scope:** Security claims from UI-hidden buttons alone.

**Review focus:** Audit truth and forbidden-operation absence.

## Integration / Merge Order

P01 reviewed transition contract precedes P02 operations API; P03 purpose-bound delivery follows safe query scope. P04 and P05 integrate approved APIs; P06 proves authorization/audit/concurrency and simulated wording.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Only Admin after verified payment; stale/skipped transition rejected; no draft editor or paid override.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Admin reads necessary order/payment facts, opens purpose-limited historical inspection and advances verified demo fulfillment; reject unpaid, stale, expired-grant, wrong-actor and private-draft attempts.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Stale/duplicate fulfillment writes cannot skip states or close twice. An Admin role is not blanket media authority; every inspection media/target/range request must recheck the actor, grant and ordered reference.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
