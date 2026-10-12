# I11 — Recipient Sharing + Fallback

## Summary

Paid immutable version, one owner grant/current generation and anonymous access.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M3 — Order & Recipient Experience

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

MEMBER_3

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

LEAD, MEMBER_2, MEMBER_4. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md); [I06](I06-private-media-pipeline.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md); [I06](I06-private-media-pipeline.md) until their acceptance artifacts are available.
- Blocks: [I12](I12-ar-signature-experience.md) (direct roadmap consumers).
- Can run in parallel with: [I13](I13-admin-orders-demo-fulfillment.md) after payment acceptance; independent Sharing frontend slices follow reviewed grant/recipient DTOs. [I12](I12-ar-signature-experience.md) waits for accepted paid-recipient access.

The authoritative dependency row is **I10, I09, I06** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [DATABASE](../docs/DATABASE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)
- [ADR-003-authentication-session-model](../docs/adr/ADR-003-authentication-session-model.md)
- [ADR-005-ar-provider-boundary](../docs/adr/ADR-005-ar-provider-boundary.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Paid immutable version, one owner grant/current generation and anonymous access. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Create/rotate/revoke.
- fragment exchange/recipient cookie.
- safe projection/media/fallback.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Mutable draft share, contributor privileges, scan analytics.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

Share one paid immutable Order version; one current credential generation, no automatic share expiry. Separate 24h recipient lease is not share expiry. Fragment credential exchange, keyed digests and bounded encrypted raw-response replay. Every access rechecks generation/active owner; no account/Order/contact/payment/provider fields.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i11-p01"></a>

### I11-P01 — Paid-version grant and generation security

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md); [I06](I06-private-media-pipeline.md) Inherited item hard gates: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md); [I06](I06-private-media-pipeline.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Own the recipient access authority before UI/AR expansion.

**Scope:** Eligibility, first grant/rotate/revoke, generation/version, keyed secret digest and 24h encrypted idempotent secret replay.

**Expected areas/files/modules:** Sharing domain/application/repositories and owner REST interface. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** First grant rejects unpaid/archived source; existing archive grants continue. Never expose digest/secret in metadata/Admin.

**Acceptance criteria:**

- [ ] One current generation survives concurrent mutations.
- [ ] Raw secret appears only in intended bounded delivery.
- [ ] Paid snapshot and active-owner gates apply.

**Tests required:** T15 real-DB generation/race/expiry/replay and API first-grant/archive tests.

**Out of scope:** Mutable draft publication or P2 invitations.

**Review focus:** INV-12 and secret lifecycle.

---

<a id="i11-p02"></a>

### I11-P02 — Anonymous fragment exchange and recipient lease

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I11-P01](I11-recipient-sharing-and-fallback.md#i11-p01) Inherited item hard gates: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md); [I06](I06-private-media-pipeline.md)
- Can run in parallel with: [I11-P04](I11-recipient-sharing-and-fallback.md#i11-p04) once each task's prerequisites are accepted.

**Purpose:** Establish a principal separate from account identity.

**Scope:** Origin/rate-limited credential exchange, separate HttpOnly cookie/CSRF, 24h lease and safe invalid-access shape.

**Expected areas/files/modules:** Sharing recipient interface and lease application/infrastructure. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Check current generation/owner at exchange and every later use; underlying share remains reusable after technical lease expiry.

**Acceptance criteria:**

- [ ] Recipient lease cannot authorize owner/Admin actions.
- [ ] Invalid access discloses no owner/Order facts.
- [ ] Expired lease may re-exchange a still-valid original share.

**Tests required:** API cookie/origin/expiry/generation and principal-confusion tests.

**Out of scope:** Recipient registration or persisted browser bearer token.

**Review focus:** Separate security context and lease/share distinction.

---

<a id="i11-p03"></a>

### I11-P03 — Immutable recipient projection and scoped delivery

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I11-P02](I11-recipient-sharing-and-fallback.md#i11-p02) Inherited item hard gates: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md); [I06](I06-private-media-pipeline.md)
- Can run in parallel with: [I11-P04](I11-recipient-sharing-and-fallback.md#i11-p04) once each task's prerequisites are accepted.

**Purpose:** Expose only the authorized version and fallback.

**Scope:** Twelve-Month recipient DTO, included dates/messages, pinned target/media paths and per-request stream/range access.

**Expected areas/files/modules:** Sharing query projection with Orders/Media/AR public ports. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No live Project joins, public provider URL or frontend image-optimizer cache; fail closed on unavailable pinned content.

**Acceptance criteria:**

- [ ] Recipient contains no account/Order/contact/price/payment keys.
- [ ] Every GET/HEAD/range checks lease/generation/active owner.
- [ ] Fallback returns exactly the same meaningful authorized reveal.

**Tests required:** T14–T17 real-DB/API projection, cross-reference, range/revoke and unavailable cases.

**Out of scope:** Global target lookup or unrelated uploaded assets.

**Review focus:** INV-04/08 and private no-store.

---

<a id="i11-p04"></a>

### I11-P04 — Owner share controls and forwarding explanation

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I11-P01](I11-recipient-sharing-and-fallback.md#i11-p01) Inherited item hard gates: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md); [I06](I06-private-media-pipeline.md)
- Can run in parallel with: [I11-P02](I11-recipient-sharing-and-fallback.md#i11-p02); [I11-P03](I11-recipient-sharing-and-fallback.md#i11-p03) once each task's prerequisites are accepted.

**Purpose:** Make sharing deliberate and controllable.

**Scope:** Paid Order share-readiness, create/copy/revoke/rotate, forwarding warning and SECRET_EXPIRED recovery.

**Expected areas/files/modules:** Frontend Sharing owner feature and Order composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Explicit rotation only after owner action; do not fetch/recover secrets through metadata reads.

**Acceptance criteria:**

- [ ] Owner understands forwarding grants access.
- [ ] Unpaid/first-archived grant is unavailable.
- [ ] Expired replay shows metadata and an explicit recovery action.

**Tests required:** Component grant/confirm/conflict/replay-state tests and owner browser flow.

**Out of scope:** Account-wide publication or background secret regeneration.

**Review focus:** Consent and accurate grant state.

---

<a id="i11-p05"></a>

### I11-P05 — Recipient exchange and camera-free experience

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I11-P03](I11-recipient-sharing-and-fallback.md#i11-p03) Inherited item hard gates: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md); [I06](I06-private-media-pipeline.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Give anonymous recipients a private usable fallback.

**Scope:** Fragment extraction/redacted exchange and removal, no-referrer/no-store shell, twelve-Month view and accessible reveal media/text.

**Expected areas/files/modules:** Frontend Recipient/Sharing feature and scoped Media composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No logging/analytics/localStorage of link; handle revoked/rotated/unsupported/unavailable honestly; scanner comes in I12.

**Acceptance criteria:**

- [ ] Credential fragment is removed after exchange.
- [ ] Accessible text and captions/transcripts match ordered reveal.
- [ ] Revocation/error stops new private fetches.

**Tests required:** Component fragment/error/media tests and anonymous browser fallback/revoke flow.

**Out of scope:** Final recognition scanner or reaction analytics.

**Review focus:** Minimal disclosure and accessible fallback.

---

<a id="i11-p06"></a>

### I11-P06 — Sharing concurrency and privacy acceptance

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I11-P01](I11-recipient-sharing-and-fallback.md#i11-p01); [I11-P02](I11-recipient-sharing-and-fallback.md#i11-p02); [I11-P03](I11-recipient-sharing-and-fallback.md#i11-p03); [I11-P04](I11-recipient-sharing-and-fallback.md#i11-p04); [I11-P05](I11-recipient-sharing-and-fallback.md#i11-p05) Inherited item hard gates: [I10](I10-paypal-sandbox-payment.md); [I09](I09-order-snapshot-and-checkout.md); [I06](I06-private-media-pipeline.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Prove forwarding/revocation semantics on real version access.

**Scope:** Concurrent rotation/revoke, disabled owner, archive continuity, lease expiry/re-exchange and denied serialization keys.

**Expected areas/files/modules:** Sharing DB/API/E2E and safe review evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use two owners/versions and retained historical assets; MEMBER_3/LEAD fix their respective boundaries.

**Acceptance criteria:**

- [ ] Only latest generation grants access.
- [ ] Old leases fail AR artifact/media/fallback subsequent requests.
- [ ] Account and Order private facts never appear.

**Tests required:** T14–T17/T22/T24 and PostgreSQL races plus static gates.

**Out of scope:** Synthetic access alone as final genuine AR evidence.

**Review focus:** Access-first denial and irreversible history.

## Integration / Merge Order

P01 security/grant use cases merge first; P02 exchange/lease follows. P03 scoped version delivery then supports P05 recipient UI; P04 owner controls follows grant API. P06 races/privacy validate all before [I12](I12-ar-signature-experience.md) integration.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Unpaid cannot share; revoked/rotated/disabled access fails; archived existing share continuity; no Order/contact/account leak.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Grant explicitly after verified payment, exchange fragment into recipient cookie, view twelve Months and the same meaningful camera-free reveal, revoke/rotate and show later content/range denial without private Order leakage.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

First grant needs a Working source Project, while existing grant rotation/revocation stays permitted when Archived. Expired secret replay must return metadata/SECRET_EXPIRED, never silently rotate. Already-downloaded pixels cannot be revoked, but every later request must deny old access.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
