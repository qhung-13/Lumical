# I10 — PayPal Sandbox Payment

## Summary

Durable bound attempts, backend verification, unique settlement and safe retry.

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

- Hard dependencies: [I09](I09-order-snapshot-and-checkout.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I09](I09-order-snapshot-and-checkout.md) until their acceptance artifacts are available.
- Blocks: [I11](I11-recipient-sharing-and-fallback.md), [I13](I13-admin-orders-demo-fulfillment.md), [I14](I14-account-views.md) (direct roadmap consumers).
- Can run in parallel with: After fixed Orders and reviewed payment DTOs, [I13](I13-admin-orders-demo-fulfillment.md)/[I14](I14-account-views.md) presentation fixtures may be prepared per ROADMAP §5; live Admin transitions/account acceptance wait for [I10](I10-paypal-sandbox-payment.md) and their own dependencies. Sharing waits for real settlement.

The authoritative dependency row is **I09** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [DATABASE](../docs/DATABASE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)
- [ADR-004-paypal-sandbox](../docs/adr/ADR-004-paypal-sandbox.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Durable bound attempts, backend verification, unique settlement and safe retry. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- PaymentGateway adapter.
- approval/return status UX.
- verified webhook inbox/jobs and status refresh.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Real money, refund/reconciliation platform.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

PayPal Sandbox behind PaymentGateway; persist bound attempts and stable operation identities before network work. Verify account/environment/Order/attempt/exact USD evidence; one unique settlement; unknown results stay VERIFYING. Failed/Cancelled retries stay under the same unpaid Order; no browser/Admin paid flag.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i10-p01"></a>

### I10-P01 — Sandbox gateway and durable attempt initiation

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I09](I09-order-snapshot-and-checkout.md) Inherited item hard gates: [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Own the payment-provider execution boundary.

**Scope:** Sandbox-only config, PaymentGateway adapter, bound attempts, one active unresolved attempt and stable create/capture/status IDs.

**Expected areas/files/modules:** Payments application/domain/infrastructure and operation/job intent. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Validate actual sandbox USD/account setup; secrets/return origin stay backend; external calls outside transaction.

**Acceptance criteria:**

- [ ] Initiation persists intent before provider work.
- [ ] Repeated start reuses bound attempt/operation.
- [ ] Live environment or arbitrary return URLs fail closed.

**Tests required:** Gateway fake binding/config/error tests and DB active-attempt/start races.

**Out of scope:** Real money or frontend provider secrets.

**Review focus:** Environment and durable execution identity.

---

<a id="i10-p02"></a>

### I10-P02 — Verified completion and unique settlement

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I10-P01](I10-paypal-sandbox-payment.md#i10-p01) Inherited item hard gates: [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Make backend evidence the only path to paid truth.

**Scope:** Approval/status/capture verification, exact binding/amount checks, one settlement and atomic attempt completion/open-checkout slot release.

**Expected areas/files/modules:** Payments completion use case and Orders transaction collaboration. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use the same completion path for status and inbox evidence; unknown outcome remains pending.

**Acceptance criteria:**

- [ ] Wrong amount/currency/account/environment never settles.
- [ ] Duplicate evidence yields one settlement.
- [ ] Settlement and slot release commit atomically.

**Tests required:** T09–T12 real-DB concurrency/crash and adapter wrong-evidence tests.

**Out of scope:** Manual paid flag, refund or recapture after uncertain success.

**Review focus:** INV-06/10/13 and provider evidence.

---

<a id="i10-p03"></a>

### I10-P03 — Verified webhook inbox and bounded recovery jobs

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I10-P02](I10-paypal-sandbox-payment.md#i10-p02) Inherited item hard gates: [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: [I10-P04](I10-paypal-sandbox-payment.md#i10-p04) once each task's prerequisites are accepted.

**Purpose:** Recover late/lost outcomes without duplicate external effects.

**Scope:** Signature/environment verification, durable event-ID dedupe, leases/backoff/status refresh coalescing and restart handling.

**Expected areas/files/modules:** Payments provider interface and shared database job/inbox runner. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** LEAD approves retry/capture boundaries; acknowledge only after durable verified intake, not trusted body labels.

**Acceptance criteria:**

- [ ] Invalid signatures cannot mutate attempts.
- [ ] Duplicate/out-of-order intake uses same completion authority.
- [ ] Crash recovery checks known provider status before retry.

**Tests required:** T11/T12 inbox/signature/lease/restart fake and PostgreSQL race tests.

**Out of scope:** Broker, Redis or unauthenticated completion endpoint.

**Review focus:** Durability and safe retry.

---

<a id="i10-p04"></a>

### I10-P04 — Payment status, approval and cancellation-signal API

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I10-P02](I10-paypal-sandbox-payment.md#i10-p02) Inherited item hard gates: [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: [I10-P03](I10-paypal-sandbox-payment.md#i10-p03) once each task's prerequisites are accepted.

**Purpose:** Expose accurate bounded payment operations to owner/Admin.

**Scope:** Attempt history/status, approval signal, refresh and cancellation intent; audited Admin recheck; OpenAPI/client projection.

**Expected areas/files/modules:** Payments/Orders/Admin HTTP interface and generated types. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Client cancellation is a signal, not final truth; 503 preserves uncertainty, and Admin recheck cannot mark paid.

**Acceptance criteria:**

- [ ] Owner scope and safe support references are enforced.
- [ ] Browser approval cannot declare Completed.
- [ ] Pending/cancelled/failed retry eligibility is accurate.

**Tests required:** Supertest real-DB role/paid-flag/binding/error/status contract tests.

**Out of scope:** Capture business logic in controllers or Admin success override.

**Review focus:** No false completion and privacy.

---

<a id="i10-p05"></a>

### I10-P05 — Sandbox handoff and verified result experience

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I10-P04](I10-paypal-sandbox-payment.md#i10-p04) Inherited item hard gates: [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Keep provider navigation separate from verified product state.

**Scope:** Approval/return/cancel pages, bounded polling/status refresh, Verifying/Completed/Failed/Cancelled and explicit same-Order retry.

**Expected areas/files/modules:** Frontend Payments feature and Orders composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No success from query string; preserve Order/intent and show sandbox/no-real-shipment copy in VI/EN.

**Acceptance criteria:**

- [ ] Return initially displays verified backend state.
- [ ] Unknown outcome never becomes false failure/success.
- [ ] Definitive retry remains on the existing unpaid Order.

**Tests required:** Component return/pending/retry tests; synthetic E2E followed by real P07 evidence.

**Out of scope:** Frontend capture SDK authority or endless polling.

**Review focus:** Honest state and recoverable navigation.

---

<a id="i10-p06"></a>

### I10-P06 — Payment race and recovery regression proof

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I10-P02](I10-paypal-sandbox-payment.md#i10-p02); [I10-P03](I10-paypal-sandbox-payment.md#i10-p03); [I10-P04](I10-paypal-sandbox-payment.md#i10-p04); [I10-P05](I10-paypal-sandbox-payment.md#i10-p05) Inherited item hard gates: [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Exercise financial invariants deterministically before live sign-off.

**Scope:** Duplicate starts/completion, cancellation-versus-success, wrong evidence and crash after external success.

**Expected areas/files/modules:** Payments DB/API/component integration and concurrency suites. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use synchronization barriers and stable provider-operation fakes; feature owners implement fixes.

**Acceptance criteria:**

- [ ] One Order has at most one successful settlement.
- [ ] Unresolved outcome blocks unsafe retry/cancel.
- [ ] Restart recovery never issues a fresh blind capture.

**Tests required:** T08–T12/T25 on real PostgreSQL plus component/UI truth tests.

**Out of scope:** Fakes as genuine sandbox acceptance.

**Review focus:** Race ordering and durable evidence.

---

<a id="i10-p07"></a>

### I10-P07 — Genuine PayPal Sandbox acceptance

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I10-P01](I10-paypal-sandbox-payment.md#i10-p01); [I10-P02](I10-paypal-sandbox-payment.md#i10-p02); [I10-P03](I10-paypal-sandbox-payment.md#i10-p03); [I10-P04](I10-paypal-sandbox-payment.md#i10-p04); [I10-P05](I10-paypal-sandbox-payment.md#i10-p05); [I10-P06](I10-paypal-sandbox-payment.md#i10-p06) Inherited item hard gates: [I09](I09-order-snapshot-and-checkout.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Own final verification of the academic commerce path.

**Scope:** Actual USD approval/completion, supported failure/cancel, same-Order retry, status recovery and duplicate-event evidence.

**Expected areas/files/modules:** Payments acceptance artifacts and synthetic academic demo configuration. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Record safe references only; outage recording is presentation backup, not acceptance. MEMBER_2/MEMBER_4 support UI/evidence.

**Acceptance criteria:**

- [ ] Actual provider evidence proves correct bound USD payment.
- [ ] Negative/retry/recovery paths are demonstrated.
- [ ] Sandbox and simulated wording remains explicit.

**Tests required:** Testing Strategy §12 genuine sandbox run plus full deterministic gate.

**Out of scope:** Production commerce, refunds or acceptance from redirect alone.

**Review focus:** Provider truth and evidence redaction.

## Integration / Merge Order

P01 gateway/operation contract precedes P02 completion. P03 inbox/jobs and P04 interface follow approved completion boundaries and may overlap; P05 consumes reviewed DTOs. P06 deterministic races precede P07 genuine sandbox sign-off.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Genuine sandbox evidence, no browser/Admin mark-paid, repeated completion one settlement, uncertain status and failed/cancelled retry safe.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Run genuine sandbox approval and backend-verified USD completion, a supported definitive cancellation/failure and retry, duplicate verified event and lost-response status recovery; record safe references only.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

External success before process crash/local commit must recover by provider status, never fresh blind capture. Webhook intake needs trusted signature/environment and durable deduplication before acknowledgment. Genuine sandbox setup/outage can block acceptance.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
