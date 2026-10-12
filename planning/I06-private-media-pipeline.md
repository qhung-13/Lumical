# I06 — Private Media Pipeline

## Summary

Backend-authorized Cloudinary adapter intake/finalization, scoped delivery and retention.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M2 — Calendar Creation

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

MEMBER_3

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

LEAD, MEMBER_2, MEMBER_4. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I02](I02-identity-and-sessions.md); [I01](I01-database-foundation.md)
- Soft/helpful dependencies: [I05](I05-calendar-project-twelve-months.md) (hard gate for Project attachment, not independent asset intake)
- Blocked by: [I02](I02-identity-and-sessions.md); [I01](I01-database-foundation.md) until their acceptance artifacts are available.
- Blocks: [I07](I07-studio-personalization.md), [I11](I11-recipient-sharing-and-fallback.md) (direct roadmap consumers).
- Can run in parallel with: [I04](I04-template-catalog-and-admin-templates.md) and [I05](I05-calendar-project-twelve-months.md) after identity/contracts; Project attachment waits for [I05](I05-calendar-project-twelve-months.md). Final ordered/recipient delivery is integrated at [I09](I09-order-snapshot-and-checkout.md)/[I11](I11-recipient-sharing-and-fallback.md)/[I13](I13-admin-orders-demo-fulfillment.md).

The authoritative dependency row is **I02, I01; Project attachment follows I05** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

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

Backend-authorized Cloudinary adapter intake/finalization, scoped delivery and retention. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Media port/adapter.
- Pending/Ready states.
- private stream proxy.
- immutable keys/pinning tests.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Public upload library, arbitrary remote fetch, storage-dependent business rules.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

Private immutable MediaStorage behind Cloudinary; backend authorizes uploads and verifies facts. Images ≤10MB, video ≤60s/100MB, audio ≤60s/20MB; Pending/Ready/Unavailable. Each GET/HEAD/range checks current access; no public delivery URL or shared Next image cache.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i06-p01"></a>

### I06-P01 — MediaStorage port and private adapter contract

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I01](I01-database-foundation.md); [I02](I02-identity-and-sessions.md) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I01](I01-database-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Separate provider mechanics from ownership/readiness.

**Scope:** Upload intent, inspect/finalize, immutable fetch/range/delete ports; category limits and adapter error mapping.

**Expected areas/files/modules:** Backend Media application ports/domain and Cloudinary infrastructure contract. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** LEAD reviews trusted metadata, signing, URL allowlists and access-first stream boundary before implementation.

**Acceptance criteria:**

- [ ] Domain contains no provider SDK types.
- [ ] Port can report unavailable without false Ready.
- [ ] Private owner and future version contexts are explicit.

**Tests required:** Pure category/readiness policy tests and contract-fake cases.

**Out of scope:** Generic public library or arbitrary remote URL ingestion.

**Review focus:** Provider isolation and privacy.

---

<a id="i06-p02"></a>

### I06-P02 — Authorized upload intents and Cloudinary intake

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I06-P01](I06-private-media-pipeline.md#i06-p01) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I01](I01-database-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Create one bounded private upload per owner intent.

**Scope:** Pending assets, non-overwriting provider keys, short-lived upload fields and idempotent initiation.

**Expected areas/files/modules:** Media upload use cases/adapter and REST interface. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Returned bounded upload signatures are allowed; provider account keys and delivery signatures stay backend-only.

**Acceptance criteria:**

- [ ] Intent belongs to active uploader.
- [ ] Repeated intent reuses one Pending asset.
- [ ] Public upload cannot overwrite an existing Ready object.

**Tests required:** API ownership/intent/limit tests and configured private upload smoke.

**Out of scope:** Open anonymous uploads or persistent public URLs.

**Review focus:** Signed scope and immutable content keys.

---

<a id="i06-p03"></a>

### I06-P03 — Trusted finalization and readiness

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I06-P02](I06-private-media-pipeline.md#i06-p02) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I01](I01-database-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Accept only independently verified safe media facts.

**Scope:** Provider metadata/ownership/type/bytes/duration verification, idempotent finalization and Pending/Ready/Unavailable transitions.

**Expected areas/files/modules:** Media application/infrastructure and readiness API. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Client uploadCompleted/size/duration fields are hints only; reject unsupported/unsafe content before Ready.

**Acceptance criteria:**

- [ ] Malformed/oversize/over-duration items never become Ready.
- [ ] Repeated/concurrent finalization yields one item.
- [ ] Provider uncertainty remains Pending or controlled unavailable.

**Tests required:** T23 real-DB concurrency plus adapter metadata/limit/owner mismatch tests.

**Out of scope:** Client-asserted readiness or business attachment.

**Review focus:** Independent evidence and duplicate handling.

---

<a id="i06-p04"></a>

### I06-P04 — Private owner stream and range delivery

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I06-P01](I06-private-media-pipeline.md#i06-p01); [I06-P03](I06-private-media-pipeline.md#i06-p03) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I01](I01-database-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Keep delivery authorization on the backend for every new request.

**Scope:** Owner media status/content GET/HEAD/range, verified content type/no-sniff and private no-store handling.

**Expected areas/files/modules:** Media interface and immutable content delivery adapter. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Implement reusable scoped delivery for future Order/recipient/Admin grants without inventing those grants now.

**Acceptance criteria:**

- [ ] Cross-owner content returns safe denial.
- [ ] Range/HEAD cannot bypass access.
- [ ] Neither DTO nor image optimizer exposes a public provider delivery path.

**Tests required:** Supertest stream/range/no-store/denial tests and anonymous provider access checks.

**Out of scope:** Caching private bytes publicly or new recipient access before I11.

**Review focus:** Revocation-compatible per-request delivery.

---

<a id="i06-p05"></a>

### I06-P05 — Upload and media-state experience

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I06-P02](I06-private-media-pipeline.md#i06-p02); [I06-P03](I06-private-media-pipeline.md#i06-p03); [I06-P04](I06-private-media-pipeline.md#i06-p04) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I01](I01-database-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Make safe intake recoverable for owners.

**Scope:** File chooser, declared guidance, bounded direct upload, progress/cancel/retry and backend-finalized state.

**Expected areas/files/modules:** Frontend Media feature and shared FileField composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Project attachment is excluded until I05/I07; retain input/state on provider failure, distinguish upload progress from Ready.

**Acceptance criteria:**

- [ ] Keyboard chooser and progress are labeled.
- [ ] Unavailable/Pending items cannot appear as Ready.
- [ ] Retry preserves the same logical upload intent when appropriate.

**Tests required:** Component upload-state/limit/retry tests and synthetic browser intake.

**Out of scope:** Whole owner media library or direct public delivery.

**Review focus:** Truthful state and accessible recovery.

---

<a id="i06-p06"></a>

### I06-P06 — Reference-aware deletion and orphan cleanup

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I06-P03](I06-private-media-pipeline.md#i06-p03); [I06-P04](I06-private-media-pipeline.md#i06-p04) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I01](I01-database-foundation.md)
- Can run in parallel with: [I06-P05](I06-private-media-pipeline.md#i06-p05) once each task's prerequisites are accepted.

**Purpose:** Remove access promptly while protecting future historical pins.

**Scope:** Unused asset deletion, retainedForHistory response, failed/unattached cleanup and bounded durable retry.

**Expected areas/files/modules:** Media cleanup use cases, repository reference checks and shared job runner. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Check all Project/Order refs plus jobs under coordinated locks; access revocation does not wait for provider deletion.

**Acceptance criteria:**

- [ ] Historical references prevent purge.
- [ ] Unreferenced failed uploads cease access.
- [ ] Provider cleanup failure retries without restoring access.

**Tests required:** T24/T26 real-DB reference/race tests and deletion failure fake.

**Out of scope:** Purging ordered media during normal edits or unbounded worker infrastructure.

**Review focus:** Retention and deletion race safety.

---

<a id="i06-p07"></a>

### I06-P07 — Private storage and media integration acceptance

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I06-P02](I06-private-media-pipeline.md#i06-p02); [I06-P03](I06-private-media-pipeline.md#i06-p03); [I06-P04](I06-private-media-pipeline.md#i06-p04); [I06-P05](I06-private-media-pipeline.md#i06-p05); [I06-P06](I06-private-media-pipeline.md#i06-p06) Inherited item hard gates: [I02](I02-identity-and-sessions.md); [I01](I01-database-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Prove the configured adapter satisfies privacy, not just mocks.

**Scope:** Real account anonymous-original/derivative checks, verified size/type/duration, range access and duplicate finalization evidence.

**Expected areas/files/modules:** Media provider/API/DB acceptance suite and safe evidence artifacts. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** MEMBER_3 owns adapter defects; LEAD approves security results before participant material is used.

**Acceptance criteria:**

- [ ] Anonymous originals and prepared derivatives are denied.
- [ ] Owned private stream and readiness work.
- [ ] T23/T24/T26 regressions and static gates pass.

**Tests required:** Genuine configured Cloudinary acceptance plus deterministic fake/real-DB negative suites.

**Out of scope:** Acceptance by signed URL alone or participant data.

**Review focus:** Account protection and evidence separation.

## Integration / Merge Order

P01 port/security review precedes P02/P03 adapter use cases. P04 delivery and P05 upload UI follow verified contracts; P06 retention follows P03/P04. P07 proves real configured private storage plus integration behavior.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Actual private originals/derivatives denied anonymously; verified limits, duplicate finalize and no public private-media URLs.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Upload synthetic media, show backend finalization and private preview/range, reject malformed/oversize/cross-owner access, and demonstrate anonymous original/derivative denial.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Cloudinary account protection must deny anonymous originals and derivatives before participant uploads. A provider upload success is not Ready evidence. Cleanup must check current/snapshot references and in-flight work before deleting bytes.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
