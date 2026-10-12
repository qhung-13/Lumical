# I05 — Calendar Project / Twelve Months

## Summary

Private Working/Archived ownership and exact year/month foundation.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M2 — Calendar Creation

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

LEAD

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

MEMBER_2, MEMBER_4, MEMBER_3. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I02](I02-identity-and-sessions.md); [I04](I04-template-catalog-and-admin-templates.md)
- Soft/helpful dependencies: [I06](I06-private-media-pipeline.md) (Ready media is needed only for later content attachment)
- Blocked by: [I02](I02-identity-and-sessions.md); [I04](I04-template-catalog-and-admin-templates.md) until their acceptance artifacts are available.
- Blocks: [I07](I07-studio-personalization.md), [I14](I14-account-views.md) (direct roadmap consumers).
- Can run in parallel with: [I06](I06-private-media-pipeline.md); contract-based Studio presentation preparation only as permitted by ROADMAP §5, with [I07](I07-studio-personalization.md) live integration gated by [I03](I03-early-ar-technology-spike.md)/[I05](I05-calendar-project-twelve-months.md)/[I06](I06-private-media-pipeline.md).

The authoritative dependency row is **I02, I04** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [DATABASE](../docs/DATABASE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Private Working/Archived ownership and exact year/month foundation. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Project create/read/edit/archive/restore/delete eligibility.
- twelve-Month persistence and list.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Transfer ownership, freeze-on-order state, free-form editor.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

INV-01/02/03/11/14; one non-transferable owner, exactly Months 1–12, Working/Archived only. Creation year current through +2 is not reimposed later. Capture Template baseline; any Order history prevents hard deletion.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i05-p01"></a>

### I05-P01 — Project ownership, identity and lifecycle policies

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I02](I02-identity-and-sessions.md); [I04](I04-template-catalog-and-admin-templates.md) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I04](I04-template-catalog-and-admin-templates.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Define pure core Project rules before UI/API expansion.

**Scope:** Title/recipient 1–80, creation year, Working/Archived, non-transferable owner and delete eligibility; Project revision contract.

**Expected areas/files/modules:** Backend CalendarProjects domain/application ports. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Derived readiness is not Project state; Order placement never freezes a Working Project.

**Acceptance criteria:**

- [ ] Invalid identity/year is rejected.
- [ ] Owner and lifecycle decisions are explicit.
- [ ] Ordered history prevents hard delete without inventing Paid/Ordered Project states.

**Tests required:** Jest policies with Clock, year advance, owner/lifecycle and deletion cases.

**Out of scope:** Full media/editor/readiness implementation.

**Review focus:** BR-PRJ-001–007 and INV-01/03/14.

---

<a id="i05-p02"></a>

### I05-P02 — Atomic Project creation and baseline capture

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I05-P01](I05-calendar-project-twelve-months.md#i05-p01) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I04](I04-template-catalog-and-admin-templates.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Persist a coherent full-year owned workspace.

**Scope:** Active Template revision capture, twelve children, idempotent creation and Project-root transaction/version support.

**Expected areas/files/modules:** CalendarProjects use cases/repositories and Template module query collaboration. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** One transaction context; no module-internal ORM leakage or provider work inside locks.

**Acceptance criteria:**

- [ ] Create commits baseline plus exactly twelve children.
- [ ] Duplicate intent returns the same Project.
- [ ] Later Template edits/deactivation cannot change baseline.

**Tests required:** PostgreSQL creation concurrency, rollback, count and baseline tests.

**Out of scope:** Lazy missing-month promises or ownership transfer.

**Review focus:** INV-02/11 and atomic baseline read.

---

<a id="i05-p03"></a>

### I05-P03 — Project REST and lifecycle interface

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I05-P02](I05-calendar-project-twelve-months.md#i05-p02) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I04](I04-template-catalog-and-admin-templates.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Expose core use cases through the approved owner contract.

**Scope:** Owner list/read/identity-style edit, months list, archive/restore/delete; ETag/If-Match and safe errors/OpenAPI.

**Expected areas/files/modules:** CalendarProjects interface; typed generated contract; bounded cleanup handoff. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use-case permissions remain authoritative; media cleanup invokes reviewed ports once I06 exists, not direct provider calls.

**Acceptance criteria:**

- [ ] Cross-owner IDs use safe 404.
- [ ] Archived edits are rejected and restore works.
- [ ] Expected-version changes and deletion history are enforced.

**Tests required:** Supertest real-DB owner, lifecycle, 428/412, duplicate-intent and serialization tests.

**Out of scope:** General Admin editor or full month media/date APIs.

**Review focus:** Transport consistency and no controller business logic.

---

<a id="i05-p04"></a>

### I05-P04 — Project query integration and creation experience

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I05-P03](I05-calendar-project-twelve-months.md#i05-p03) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I04](I04-template-catalog-and-admin-templates.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Start and reopen owned calendars through typed HTTP.

**Scope:** Feature query/mutation layer, title/year/recipient/template/preset creation form and safe retry/navigation.

**Expected areas/files/modules:** Frontend CalendarProjects feature and app composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use backend outcome/version; invalidate actor-scoped lists, no unchecked payload cast.

**Acceptance criteria:**

- [ ] Create uses an available Template baseline.
- [ ] Invalid fields and unavailable Template preserve input.
- [ ] Same-intent retries do not duplicate Project.

**Tests required:** Testing Library creation/query/conflict tests; synthetic browser create/reopen.

**Out of scope:** Client-authoritative ownership or pricing.

**Review focus:** State preservation and idempotent UX.

---

<a id="i05-p05"></a>

### I05-P05 — Twelve-Month navigation and lifecycle experience

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I05-P03](I05-calendar-project-twelve-months.md#i05-p03) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I04](I04-template-catalog-and-admin-templates.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Make the saved full year individually reviewable.

**Scope:** Month selection/read-only initial summaries, archive/restore and eligible deletion confirmation.

**Expected areas/files/modules:** CalendarProjects navigation and owner lifecycle UI. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Detailed photos/captions/dates edit in I07; use shared Dialog and immutable backend version.

**Acceptance criteria:**

- [ ] Exactly twelve Months are individually reachable.
- [ ] Archived state is visibly read-only.
- [ ] Deletion is offered only when eligible and handles server rejection.

**Tests required:** Component keyboard/navigation/Dialog tests and lifecycle browser checks.

**Out of scope:** Full Studio editor or freeze-on-order state.

**Review focus:** Readable lifecycle and no duplicate month editor.

---

<a id="i05-p06"></a>

### I05-P06 — Core Project invariant integration proof

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I05-P02](I05-calendar-project-twelve-months.md#i05-p02); [I05-P03](I05-calendar-project-twelve-months.md#i05-p03); [I05-P04](I05-calendar-project-twelve-months.md#i05-p04); [I05-P05](I05-calendar-project-twelve-months.md#i05-p05) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I04](I04-template-catalog-and-admin-templates.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Verify the core domain before child features attach.

**Scope:** Two-owner isolation, twelve atomic Months, stale writes, year advance, baseline survival and history-safe deletion.

**Expected areas/files/modules:** CalendarProjects DB/API integration and UI acceptance evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use actual transactions; distinguish schema fixture history from later I09 acceptance.

**Acceptance criteria:**

- [ ] INV-01/02/03/11/14 scenarios pass.
- [ ] Child/version contract is documented for I07.
- [ ] UI and API agree on archive/delete outcomes.

**Tests required:** T01–T04/T24 real-DB negatives and race tests plus static gates.

**Out of scope:** Order placement or AR feature work.

**Review focus:** Concurrency and historical integrity.

## Integration / Merge Order

P01 policy contracts precede P02 transaction implementation. P03 exposes reviewed use cases; P04 and P05 integrate typed owner experience. P06 proves isolation, twelve-count, baseline and lifecycle behavior.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Exactly twelve, owner isolation, captured Template survival, expected-version checks.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Create a private twelve-Month Project, reopen it, archive/restore, attempt another owner's ID, and show deletion eligibility and baseline survival via tests.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

All later child writes must share Project-root version/locking so snapshot capture cannot mix edits. Month content personalization belongs to I07, not a duplicate competing I05 editor.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
