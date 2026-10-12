# I17 — P1 Recovery / Notifications

## Summary

Deliver approved supporting work once P0 coherent.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M4 — Product Completion

## Priority

P1 — required supporting work after coherent P0; deferral requires explicit Product Scope approval.

## Primary Owner

MEMBER_4

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

LEAD, MEMBER_2, MEMBER_3. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I16](I16-accessibility-responsive-hardening.md); [I14](I14-account-views.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I16](I16-accessibility-responsive-hardening.md); [I14](I14-account-views.md); [I13](I13-admin-orders-demo-fulfillment.md) until their acceptance artifacts are available.
- Blocks: [I18](I18-p2-stretch-optional.md), [I19](I19-final-e2e-security-demo-hardening.md) (direct roadmap consumers).
- Can run in parallel with: Recovery and in-product notifications are independent P1 tracks after the hard gates; [I18](I18-p2-stretch-optional.md) is not a dependency. [I19](I19-final-e2e-security-demo-hardening.md) waits for [I17](I17-p1-recovery-notifications.md) or explicit approved P1 deferral.

The authoritative dependency row is **I16, I14, I13** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [PRODUCT_SCOPE](../docs/PRODUCT_SCOPE.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [DATABASE](../docs/DATABASE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Deliver approved supporting work once P0 coherent. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- EmailSender recovery proof/reset/session invalidation; in-product consequential notices.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Marketing email, email verification/change, every-edit notifications.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

BR-ID-008 and BR-NOT-001 only: mailbox proof is short-lived/single-use, no enumeration, reset revokes all sessions. In-product notices cover verified payment completion/definitive failure and meaningful demo Fulfillment, not every edit. P2 contribution notices remain absent unless separately approved.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i17-p01"></a>

### I17-P01 — Password recovery and reset security use cases

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I16](I16-accessibility-responsive-hardening.md); [I14](I14-account-views.md); [I13](I13-admin-orders-demo-fulfillment.md) Inherited item hard gates: [I16](I16-accessibility-responsive-hardening.md); [I14](I14-account-views.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Own P1 identity mutation and session revocation correctness.

**Scope:** Reviewed P1 token migration, generic recovery response, token digest/expiry/consumption, password policy and reset/session transaction.

**Expected areas/files/modules:** Identity recovery application/infrastructure and P1 REST contract. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Rate-limit and exact Origin; Idempotency-Key required for reset; token consumption and session revocation are atomic.

**Acceptance criteria:**

- [ ] Unknown/known email requests look safely generic.
- [ ] Proof is short-lived and single-use.
- [ ] Successful reset invalidates all old account sessions.

**Tests required:** Controlled-Clock/API/real-DB expiry/replay/concurrent reset and revocation tests.

**Out of scope:** Email verification/change or account deletion.

**Review focus:** BR-ID-004/006/008 and secret lifecycle.

---

<a id="i17-p02"></a>

### I17-P02 — EmailSender recovery adapter and capture proof

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I17-P01](I17-p1-recovery-notifications.md#i17-p01) Inherited item hard gates: [I16](I16-accessibility-responsive-hardening.md); [I14](I14-account-views.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Can run in parallel with: [I17-P04](I17-p1-recovery-notifications.md#i17-p04) once each task's prerequisites are accepted.

**Purpose:** Deliver bounded mailbox control proof without marketing infrastructure.

**Scope:** EmailSender port, safe reset-link construction, controlled adapter/config and local capture tests.

**Expected areas/files/modules:** Backend P1 EmailSender adapter and recovery job/config. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Select only needed compatible tooling through review; no named provider assumed; secrets stay backend; no raw token logs.

**Acceptance criteria:**

- [ ] Safe configured frontend origin forms reset links.
- [ ] Captured delivery contains bounded proof/expiry guidance.
- [ ] Delivery failure does not enumerate accounts.

**Tests required:** Adapter/capture/retry tests and actual controlled recovery delivery evidence when configured.

**Out of scope:** Marketing, generic notification email or provider lock-in.

**Review focus:** Safe proof delivery and optional-until-P1 config.

---

<a id="i17-p03"></a>

### I17-P03 — Recovery request and reset experience

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I17-P01](I17-p1-recovery-notifications.md#i17-p01); [I17-P02](I17-p1-recovery-notifications.md#i17-p02) Inherited item hard gates: [I16](I16-accessibility-responsive-hardening.md); [I14](I14-account-views.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Can run in parallel with: [I17-P04](I17-p1-recovery-notifications.md#i17-p04); [I17-P05](I17-p1-recovery-notifications.md#i17-p05) once each task's prerequisites are accepted.

**Purpose:** Let users regain accounts without disclosing identity existence.

**Scope:** Accessible VI/EN generic request acknowledgement, new password form and expired/used proof recovery.

**Expected areas/files/modules:** Frontend Identity P1 recovery routes/features. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No localStorage of tokens; use safe link handling/redaction and shared controls.

**Acceptance criteria:**

- [ ] Request feedback is non-enumerating.
- [ ] Reset policy and errors are accessible.
- [ ] Successful reset ends stale protected session/UI.

**Tests required:** Component form/expiry/replay tests and captured-email browser recovery flow.

**Out of scope:** New profile settings or login provider.

**Review focus:** Usable proof failures and privacy.

---

<a id="i17-p04"></a>

### I17-P04 — Consequential notification persistence and API

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I16](I16-accessibility-responsive-hardening.md); [I14](I14-account-views.md); [I13](I13-admin-orders-demo-fulfillment.md) Inherited item hard gates: [I16](I16-accessibility-responsive-hardening.md); [I14](I14-account-views.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Can run in parallel with: [I17-P01](I17-p1-recovery-notifications.md#i17-p01); [I17-P02](I17-p1-recovery-notifications.md#i17-p02); [I17-P03](I17-p1-recovery-notifications.md#i17-p03) once each task's prerequisites are accepted.

**Purpose:** Own P1 event-to-notice behavior.

**Scope:** Separate P1 Notification migration, committed payment/Fulfillment event dedupe, owner-scoped cursor list and mark-read.

**Expected areas/files/modules:** Notifications application/domain/infrastructure and account P1 interface. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Consume committed facts after I10/I13 transactions; never email or notify for every save; exclude wish events.

**Acceptance criteria:**

- [ ] Repeated event creates one meaningful notice.
- [ ] Only intended owner can read/update it.
- [ ] Payload contains safe outcome/navigation facts.

**Tests required:** Real-DB event/dedupe/owner/API tests and rollback/late-event cases.

**Out of scope:** P2 wishes, marketing or public feed.

**Review focus:** Committed event truth and least disclosure.

---

<a id="i17-p05"></a>

### I17-P05 — Own notification list and read interaction

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I17-P04](I17-p1-recovery-notifications.md#i17-p04) Inherited item hard gates: [I16](I16-accessibility-responsive-hardening.md); [I14](I14-account-views.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Can run in parallel with: [I17-P03](I17-p1-recovery-notifications.md#i17-p03) once each task's prerequisites are accepted.

**Purpose:** Deliver a real P1 account operational experience.

**Scope:** Own notices, empty/loading/error states, safe related-object navigation and repeatable read status.

**Expected areas/files/modules:** Frontend Account/Notifications composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** P0 account status views remain valid without notices; no new global bell/noise requirement invented.

**Acceptance criteria:**

- [ ] Meaningful outcomes are understandable in VI/EN.
- [ ] Read state is stable across repeated actions.
- [ ] Cross-user/private content is never cached together.

**Tests required:** Component/query/read tests and browser owner-notice flow.

**Out of scope:** Social feed or every-edit alert.

**Review focus:** Useful outcome communication.

---

<a id="i17-p06"></a>

### I17-P06 — P1 recovery and notification acceptance

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I17-P01](I17-p1-recovery-notifications.md#i17-p01); [I17-P02](I17-p1-recovery-notifications.md#i17-p02); [I17-P03](I17-p1-recovery-notifications.md#i17-p03); [I17-P04](I17-p1-recovery-notifications.md#i17-p04); [I17-P05](I17-p1-recovery-notifications.md#i17-p05) Inherited item hard gates: [I16](I16-accessibility-responsive-hardening.md); [I14](I14-account-views.md); [I13](I13-admin-orders-demo-fulfillment.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Verify required supporting work or expose an explicit deferral decision.

**Scope:** Single-use/expiry/non-enumeration/reset revocation and deduplicated safe notifications with all states.

**Expected areas/files/modules:** Identity/Notifications DB/API/browser acceptance evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** A P1 deferral requires scope-owner approval recorded before I19; planning does not grant it.

**Acceptance criteria:**

- [ ] Reset proof cannot be reused concurrently.
- [ ] Old sessions and private caches are invalidated.
- [ ] Consequential notifications are deduplicated and own-only.

**Tests required:** T22 plus P1 token/event cases, captured mail journey and static gates.

**Out of scope:** P2 contribution notices or silent P1 omission.

**Review focus:** Required P1 evidence versus explicit approved deferral.

## Integration / Merge Order

P01 recovery security contract precedes P02 mail delivery and P03 forms. P04 notification persistence/event handling is independent; P05 follows its safe contract. P06 validates both tracks before P1 acceptance.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Single-use expiry/non-enumeration, successful reset revokes sessions, deduplicated useful notices.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.
- [ ] P1 is accepted, or any requested deferral is explicitly approved by the Product Scope owner and recorded before final acceptance.

## Demo Evidence

Request generic recovery, receive synthetic captured mailbox proof, reset once and reject replay/expired proof/old sessions; show deduplicated own consequential notices and mark-read behavior.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Token/reset versus simultaneous session requests must fail old sessions. A duplicate committed event cannot create repeated notice noise. Email delivery failure must not reveal account existence or become a P0 dependency.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
