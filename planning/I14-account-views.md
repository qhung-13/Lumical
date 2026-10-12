# I14 — Account Views

## Summary

Integrated own Project/Order/payment/fulfillment history and returning workflows.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M4 — Product Completion

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

MEMBER_2

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

MEMBER_4, MEMBER_3, LEAD. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I05](I05-calendar-project-twelve-months.md); [I09](I09-order-snapshot-and-checkout.md); [I10](I10-paypal-sandbox-payment.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I05](I05-calendar-project-twelve-months.md); [I09](I09-order-snapshot-and-checkout.md); [I10](I10-paypal-sandbox-payment.md); [I13](I13-admin-orders-demo-fulfillment.md) until their acceptance artifacts are available.
- Blocks: [I15](I15-vi-en-theme-hardening.md), [I17](I17-p1-recovery-notifications.md), [I19](I19-final-e2e-security-demo-hardening.md) (direct roadmap consumers).
- Can run in parallel with: [I12](I12-ar-signature-experience.md) after respective gates. Presentation can use reviewed DTO fixtures after fixed Orders per ROADMAP §5; complete acceptance requires [I13](I13-admin-orders-demo-fulfillment.md)'s real fulfillment outcomes.

The authoritative dependency row is **I05, I09, I10, I13** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [PRODUCT_SCOPE](../docs/PRODUCT_SCOPE.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [DESIGN_SYSTEM](../docs/DESIGN_SYSTEM.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Integrated own Project/Order/payment/fulfillment history and returning workflows. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Owner lists/details.
- empty/error states.
- same-intent retry/reorder navigation.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Revenue dashboard/social feeds.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

Owner-scoped Project/Order lists, captured history, separate Payment/Fulfillment and safe retry/reorder navigation. Working/Archived continuity, no historical Project mutation, private query clearing on logout/account change.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i14-p01"></a>

### I14-P01 — Account navigation and actor-scoped queries

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I05](I05-calendar-project-twelve-months.md); [I09](I09-order-snapshot-and-checkout.md); [I10](I10-paypal-sandbox-payment.md); [I13](I13-admin-orders-demo-fulfillment.md) Inherited item hard gates: [I05](I05-calendar-project-twelve-months.md); [I09](I09-order-snapshot-and-checkout.md); [I10](I10-paypal-sandbox-payment.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Compose returning-user navigation from module contracts.

**Scope:** Safe principal bootstrap, own Project/Order queries, paging/filtering and session-scoped cache keys.

**Expected areas/files/modules:** Frontend Account composition and feature public APIs. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No backend Account mega-service that duplicates module rules; read business data only through reviewed HTTP.

**Acceptance criteria:**

- [ ] Account navigation shows appropriate own tasks.
- [ ] Queries are actor-scoped and typed.
- [ ] Logout/account change clears private caches.

**Tests required:** Component query/navigation/logout tests and API projection checks.

**Out of scope:** Revenue dashboard or generalized profile management.

**Review focus:** Ownership and cache isolation.

---

<a id="i14-p02"></a>

### I14-P02 — Own Project list and lifecycle continuity

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I14-P01](I14-account-views.md#i14-p01) Inherited item hard gates: [I05](I05-calendar-project-twelve-months.md); [I09](I09-order-snapshot-and-checkout.md); [I10](I10-paypal-sandbox-payment.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Can run in parallel with: [I14-P03](I14-account-views.md#i14-p03) once each task's prerequisites are accepted.

**Purpose:** Make saved work easy to find and resume.

**Scope:** Working/Archived list, empty/loading/error states and existing I05 lifecycle actions.

**Expected areas/files/modules:** Account Project presentation composing CalendarProjects. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Do not implement a second lifecycle policy/editor; source remains editable after ordering when Working.

**Acceptance criteria:**

- [ ] Only own Projects appear.
- [ ] Reopen/archive/restore follows authoritative state.
- [ ] Never-ordered delete remains confirmed/eligible.

**Tests required:** Component list/lifecycle/retry tests and returning-user browser flow.

**Out of scope:** Transfer ownership or ProjectPaid/Ordered state.

**Review focus:** Composition without duplicated rules.

---

<a id="i14-p03"></a>

### I14-P03 — Order/payment/demo progress operational view

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I14-P01](I14-account-views.md#i14-p01) Inherited item hard gates: [I05](I05-calendar-project-twelve-months.md); [I09](I09-order-snapshot-and-checkout.md); [I10](I10-paypal-sandbox-payment.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Can run in parallel with: [I14-P02](I14-account-views.md#i14-p02) once each task's prerequisites are accepted.

**Purpose:** Own a real account-facing order status implementation.

**Scope:** Own Order list/detail, fixed snapshot display, attempt history and separate verified payment/demo Fulfillment.

**Expected areas/files/modules:** Account Orders presentation composing Orders/Payments. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No Admin permissions or recipient share credential in generic read DTO; avoid live Project fields for history.

**Acceptance criteria:**

- [ ] Earlier Order content remains fixed after source edits.
- [ ] Payment and Fulfillment are distinct.
- [ ] Pending/unavailable status is shown honestly.

**Tests required:** T05/T08/T25 component and browser own-history/status tests.

**Out of scope:** Charts, refunds or actual shipment tracking.

**Review focus:** Immutable display and truthful status.

---

<a id="i14-p04"></a>

### I14-P04 — Resume payment and deliberate reorder navigation

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I14-P02](I14-account-views.md#i14-p02); [I14-P03](I14-account-views.md#i14-p03) Inherited item hard gates: [I05](I05-calendar-project-twelve-months.md); [I09](I09-order-snapshot-and-checkout.md); [I10](I10-paypal-sandbox-payment.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Support returning intent without accidental duplicate commerce.

**Scope:** Resume existing unpaid Order/eligible retry and explicit new confirmed reorder after slot release.

**Expected areas/files/modules:** Account/Orders/Payments navigation and confirmation composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use I09/I10 authoritative canRetry/current revision and original intent; re-preview current Project before later Order.

**Acceptance criteria:**

- [ ] Failed attempt retries the same Order.
- [ ] Open unpaid version resumes unchanged quantity/contact.
- [ ] New reorder is explicit and captures current reviewed version.

**Tests required:** Component intent/navigation tests and T06/T08 browser integration.

**Out of scope:** Silent changed checkout request or paid cancellation.

**Review focus:** Intent identity and safe continuation.

---

<a id="i14-p05"></a>

### I14-P05 — Returning workflow and privacy acceptance

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I14-P01](I14-account-views.md#i14-p01); [I14-P02](I14-account-views.md#i14-p02); [I14-P03](I14-account-views.md#i14-p03); [I14-P04](I14-account-views.md#i14-p04) Inherited item hard gates: [I05](I05-calendar-project-twelve-months.md); [I09](I09-order-snapshot-and-checkout.md); [I10](I10-paypal-sandbox-payment.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Prove ownership/history after navigation and session changes.

**Scope:** Two-user list/detail isolation, logout/cache clearing, archive continuity and snapshot/retry/reorder regressions.

**Expected areas/files/modules:** Account API/component/E2E acceptance evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Feature owners fix their slices; test actual HTTP and stored history, not presentation stubs alone.

**Acceptance criteria:**

- [ ] Cross-owner identifiers disclose no data.
- [ ] Logout leaves no private cached content.
- [ ] Returning workflows preserve historical versions and one-intent semantics.

**Tests required:** T01/T05/T06/T08/T22/T24 plus T21 and static gates.

**Out of scope:** Recipient account dashboard or notification prerequisite.

**Review focus:** Returning-user isolation.

## Integration / Merge Order

P01 shared account query/navigation contract precedes P02 Project and P03 Order views, which can overlap. P04 retry/reorder connects accepted [I09](I09-order-snapshot-and-checkout.md)/[I10](I10-paypal-sandbox-payment.md) outcomes; P05 proves actor isolation and returning workflows.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Own-only data, immutable snapshot display, logout cache clearing, working/archived continuity.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Return to saved Projects, archive/restore, inspect a fixed earlier Order after source edits, review separate payment/demo progress and resume or deliberately reorder without duplication.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

An account card must not query the latest Project to display an earlier Order. Reorder must create explicit new intent only when the open-version slot is released, never treat timeout or failed payment as a new Order.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
