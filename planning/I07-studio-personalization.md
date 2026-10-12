# I07 — Studio Personalization

## Summary

Edit all Months, image/message, optional personal dates and one owner AR configuration.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M2 — Calendar Creation

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

MEMBER_2

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

LEAD, MEMBER_3, MEMBER_4. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I05](I05-calendar-project-twelve-months.md); [I06](I06-private-media-pipeline.md); [I03](I03-early-ar-technology-spike.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I05](I05-calendar-project-twelve-months.md); [I06](I06-private-media-pipeline.md); [I03](I03-early-ar-technology-spike.md) until their acceptance artifacts are available.
- Blocks: [I08](I08-preview-and-readiness-and-target-preparation.md) (direct roadmap consumers).
- Can run in parallel with: Contract-fixture presentation may be prepared after [I02](I02-identity-and-sessions.md)/contracts per ROADMAP §5, but live integration and technology-specific authoring wait for all hard gates. Independent reviewed UI slices can overlap.

The authoritative dependency row is **I05, I06, I03 selected approach** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [DATABASE](../docs/DATABASE.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [DESIGN_SYSTEM](../docs/DESIGN_SYSTEM.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Edit all Months, image/message, optional personal dates and one owner AR configuration. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Guided forms/tools.
- media attachment.
- leap-date/event editing and AR authoring.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Twelve unique uploads requirement, holidays, event media, multi-target/advanced AR.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

All twelve Months individually editable; 0–4 owned Ready images per Month, image reuse allowed, optional caption ≤300. Personal dates are real Gregorian dates in Project year, title 1–80/note ≤300; zero events valid. One designated AR reveal uses image/message OR short video/audio with readable text.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i07-p01"></a>

### I07-P01 — Month, date and AR-write application contracts

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I05](I05-calendar-project-twelve-months.md); [I06](I06-private-media-pipeline.md); [I03](I03-early-ar-technology-spike.md) Inherited item hard gates: [I05](I05-calendar-project-twelve-months.md); [I06](I06-private-media-pipeline.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Extend core Project invariants to all child mutations.

**Scope:** Versioned Month replacement, event CRUD, curated style edit and one AR config write/remove; ownership/readiness policies.

**Expected areas/files/modules:** CalendarProjects/AR application/domain/interfaces and OpenAPI-generated types. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use Project-root lock/version and same transaction context; AR preparation queues after commit and is completed in I08.

**Acceptance criteria:**

- [ ] Month/date/media limits are backend-authoritative.
- [ ] Every child change advances Project version.
- [ ] Cross-owner/stale/archived writes fail safely.

**Tests required:** Jest leap-date/content policies and real-DB/API owner/version/child race tests.

**Out of scope:** Actual target preparation before I08 or event media.

**Review focus:** Core invariant reuse and version coordination.

---

<a id="i07-p02"></a>

### I07-P02 — Guided Studio shell and Month selection

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I07-P01](I07-studio-personalization.md#i07-p01) Inherited item hard gates: [I05](I05-calendar-project-twelve-months.md); [I06](I06-private-media-pipeline.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Compose a understandable editing workspace.

**Scope:** Workspace header, all twelve Month choices, contextual tools, save indicator and compact layout.

**Expected areas/files/modules:** Frontend CalendarProjects Studio feature and shared layout composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Keep route files composition-only; avoid an all-client app and free positioning.

**Acceptance criteria:**

- [ ] All twelve Months are keyboard-reachable.
- [ ] Preview/tool reading order is coherent.
- [ ] Unsaved state is visible without implying persistence.

**Tests required:** Component keyboard/state tests and 320px/200% layouts.

**Out of scope:** Free-form design editor or print-fidelity promise.

**Review focus:** Guided hierarchy and local draft state.

---

<a id="i07-p03"></a>

### I07-P03 — Month images and caption editor

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I07-P01](I07-studio-personalization.md#i07-p01); [I07-P02](I07-studio-personalization.md#i07-p02) Inherited item hard gates: [I05](I05-calendar-project-twelve-months.md); [I06](I06-private-media-pipeline.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: [I07-P05](I07-studio-personalization.md#i07-p05) once each task's prerequisites are accepted.

**Purpose:** Personalize Month content without imposing twelve uploads.

**Scope:** Ready media selection/upload composition, 0–4 ordered images, accessible text/crop choices and optional short caption.

**Expected areas/files/modules:** Studio Month editor and Media feature public integration surface. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Reuse approved presets/crop fields from contract; owned Ready images only; empty Month save is valid.

**Acceptance criteria:**

- [ ] Zero-content save works.
- [ ] Image reuse across Months works.
- [ ] Limits and non-Ready states have clear repair feedback.

**Tests required:** Testing Library edit/save/retry/limit cases plus API integration.

**Out of scope:** Unique-photo-per-Month requirement or unrestricted graphics tools.

**Review focus:** Honest media/readiness state.

---

<a id="i07-p04"></a>

### I07-P04 — Personal Special Date editor

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I07-P01](I07-studio-personalization.md#i07-p01); [I07-P02](I07-studio-personalization.md#i07-p02) Inherited item hard gates: [I05](I05-calendar-project-twelve-months.md); [I06](I06-private-media-pipeline.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: [I07-P05](I07-studio-personalization.md#i07-p05) once each task's prerequisites are accepted.

**Purpose:** Deliver the P0 meaningful-date capability without making it an Order gate.

**Scope:** Accessible date/title/note forms, same-day distinct events and edit/delete confirmation.

**Expected areas/files/modules:** Studio Special Dates feature and generated query mutations. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Treat date as civil Project-year date, never timezone-shift it; event media/system holidays absent.

**Acceptance criteria:**

- [ ] Leap validity and year limits are explained.
- [ ] Multiple different events on one date work.
- [ ] Delete changes current Project only.

**Tests required:** Component date/error tests and real API leap/year/version negatives; T19 capability evidence.

**Out of scope:** Holiday management or event media.

**Review focus:** Civil-date correctness and optional content.

---

<a id="i07-p05"></a>

### I07-P05 — One owner AR reveal authoring experience

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I07-P01](I07-studio-personalization.md#i07-p01); [I07-P02](I07-studio-personalization.md#i07-p02) Inherited item hard gates: [I05](I05-calendar-project-twelve-months.md); [I06](I06-private-media-pipeline.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: [I07-P03](I07-studio-personalization.md#i07-p03); [I07-P04](I07-studio-personalization.md#i07-p04) once each task's prerequisites are accepted.

**Purpose:** Configure the selected approach through provider-neutral fields.

**Scope:** Designated Month, owned Ready reveal asset and required readable image-message/video-caption/audio-transcript text.

**Expected areas/files/modules:** Frontend AR authoring feature; current Project AR contract. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** I03 selection is mandatory; display PREPARING/UNAVAILABLE honestly and wait for I08 genuine target readiness.

**Acceptance criteria:**

- [ ] Image plus meaningful message is accepted.
- [ ] Wrong/unready assets are rejected.
- [ ] Current config removal does not promise historical deletion.

**Tests required:** Component reveal alternatives/validation and API version/ownership tests; T20.

**Out of scope:** Scanner, recipient publication or fake target-ready flag.

**Review focus:** Readable alternatives and no SDK business leakage.

---

<a id="i07-p06"></a>

### I07-P06 — Curated styling, save and conflict recovery

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I07-P01](I07-studio-personalization.md#i07-p01); [I07-P02](I07-studio-personalization.md#i07-p02); [I07-P03](I07-studio-personalization.md#i07-p03); [I07-P04](I07-studio-personalization.md#i07-p04); [I07-P05](I07-studio-personalization.md#i07-p05) Inherited item hard gates: [I05](I05-calendar-project-twelve-months.md); [I06](I06-private-media-pipeline.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Own a real cross-editor save/recovery workflow.

**Scope:** Captured-preset controls, committed-version invalidation, unsaved navigation confirmation and explicit 412 review.

**Expected areas/files/modules:** Studio style/save orchestration and shared Dialog/error composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No arbitrary preset outside captured baseline; no optimistic persisted or payment/readiness state.

**Acceptance criteria:**

- [ ] Preset choices remain curated.
- [ ] Retry preserves local draft and intent.
- [ ] Stale version requires current-content review.

**Tests required:** Component draft/conflict/Dialog tests and concurrent owner editing integration.

**Out of scope:** Silent last-write-wins or new global state platform.

**Review focus:** Input preservation and version honesty.

---

<a id="i07-p07"></a>

### I07-P07 — Personalization integration and usability proof

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I07-P01](I07-studio-personalization.md#i07-p01); [I07-P02](I07-studio-personalization.md#i07-p02); [I07-P03](I07-studio-personalization.md#i07-p03); [I07-P04](I07-studio-personalization.md#i07-p04); [I07-P05](I07-studio-personalization.md#i07-p05); [I07-P06](I07-studio-personalization.md#i07-p06) Inherited item hard gates: [I05](I05-calendar-project-twelve-months.md); [I06](I06-private-media-pipeline.md); [I03](I03-early-ar-technology-spike.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Check the entire twelve-Month experience before preview/order work.

**Scope:** Synthetic end-to-end save/reopen, photo reuse, dates/AR config, archived denial and both language/theme states.

**Expected areas/files/modules:** Studio component/browser/API regression tests and review evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Feature owners fix defects in their owned tasks; common UI acceptance is part of each slice.

**Acceptance criteria:**

- [ ] All twelve edits/reopens preserve content.
- [ ] Optional events and image-message reveal behave correctly.
- [ ] Keyboard/320px/200% and safe failure cases pass.

**Tests required:** T01/T19/T20/T21 with DB/API and component/browser layers.

**Out of scope:** Order/payment/recipient acceptance.

**Review focus:** No draft/persisted state confusion.

## Integration / Merge Order

P01 reviewed child use cases/DTOs precede live editors. P02 shell supports P03/P04/P05; P06 save/conflict controls integrate those editors. P07 closes the whole personalization slice; no fake Ready artifact.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] All twelve editable; same photo reuse allowed; date optional; image/video/audio alternative and owned media checks.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Edit two distinct Months live, reach all twelve, reuse an image, add/edit a leap-valid Special Date and configure an image/message AR reveal while demonstrating save/conflict behavior.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Child edits must increment the same Project revision; stale writes cannot silently overwrite. Local unsaved draft must not be presented as persisted/reviewed/ordered content. Current AR config edits never alter historical artifacts.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
