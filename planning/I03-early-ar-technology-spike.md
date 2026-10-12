# I03 — Early AR Technology Spike

## Summary

Prove viable web target recognition and provider boundary before downstream design commits.

Initial item status: **TODO**. No implementation evidence exists for this item in the current repository; tasks start TODO. Dependencies are gates, not claims of implemented artifacts.

## Milestone

M1 — Core Platform

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

MEMBER_3

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

LEAD, MEMBER_4. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: [I00](I00-repository-project-foundation.md)
- Soft/helpful dependencies: [I02](I02-identity-and-sessions.md) (optional authenticated spike harness only)
- Blocked by: [I00](I00-repository-project-foundation.md) until their acceptance artifacts are available.
- Blocks: [I07](I07-studio-personalization.md), [I08](I08-preview-and-readiness-and-target-preparation.md), [I12](I12-ar-signature-experience.md) (direct roadmap consumers).
- Can run in parallel with: [I01](I01-database-foundation.md) and [I02](I02-identity-and-sessions.md) after the [I00](I00-repository-project-foundation.md) gate; no final AR/Studio/snapshot implementation before the selected approach passes [I03](I03-early-ar-technology-spike.md).

The authoritative dependency row is **I00; I02 optional for authenticated spike harness** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [PRODUCT_SCOPE](../docs/PRODUCT_SCOPE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)
- [ADR-005-ar-provider-boundary](../docs/adr/ADR-005-ar-provider-boundary.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Prove viable web target recognition and provider boundary before downstream design commits. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Synthetic prepared target.
- genuine image+message reveal.
- mobile/HTTPS/privacy/licensing matrix.
- decision update to ADR-005 and adapter plan.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Final scanner UI, advanced effects, participant private media, hardcoded global target URLs.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

No AR SDK is selected. Use synthetic targets/content and actual mobile HTTPS recognition; recognition is never permission. Image plus meaningful message is a sufficient reveal; denied/unsupported cases need the same authorized fallback.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i03-p01"></a>

### I03-P01 — Candidate evaluation against ADR-005

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I00](I00-repository-project-foundation.md) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Identify feasible approaches without choosing one prematurely.

**Scope:** Candidate matrix for browser/device support, preparation, licensing/cost, network needs, frame transfer and complexity.

**Expected areas/files/modules:** Isolated spike evaluation artifacts; AR boundary design. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Evaluate against the authority criteria; do not invent procurement promises or numeric performance targets.

**Acceptance criteria:**

- [ ] Each considered candidate has evidence gaps listed.
- [ ] Camera processing and artifact redistribution are understood.
- [ ] No SDK is labeled selected before LEAD decision.

**Tests required:** Document verifiable evaluation sources and prototype questions; no mock acceptance.

**Out of scope:** Final AR UI or advanced effects.

**Review focus:** Supported environment, license and privacy risks.

---

<a id="i03-p02"></a>

### I03-P02 — Synthetic target and version-bound reveal prototypes

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I03-P01](I03-early-ar-technology-spike.md#i03-p01) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Test actual recognition and artifact preparation.

**Scope:** Small HTTPS prototypes with synthetic image/message, explicit start/stop and two synthetic authorized versions.

**Expected areas/files/modules:** Isolated AR spike harness and adapter feasibility examples. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** A scoped synthetic fixture can be used before I02; it does not prove final paid-recipient security.

**Acceptance criteria:**

- [ ] A prepared target genuinely resolves intended image/text.
- [ ] Unknown/wrong-version target reveals no unrelated fixture.
- [ ] Preparation artifacts have identifiable source versions.

**Tests required:** Repeat real scans, preparation failure and version-mismatch cases.

**Out of scope:** Participant media or fake production authentication.

**Review focus:** Genuine recognition and portable version boundary.

---

<a id="i03-p03"></a>

### I03-P03 — Device, browser and camera feasibility matrix

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I03-P02](I03-early-ar-technology-spike.md#i03-p02) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I03-P04](I03-early-ar-technology-spike.md#i03-p04) once each task's prerequisites are accepted.

**Purpose:** Make supported-device claims evidence-based.

**Scope:** Record device/OS/browser versions, light/distance/orientation, permission denial, exit, performance and repeat scans.

**Expected areas/files/modules:** Spike device test records and reproducible harness steps. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use available devices honestly; do not promise universal support or infer viability from desktop only.

**Acceptance criteria:**

- [ ] Actual supported combinations are documented.
- [ ] Camera start/denial/exit is tested.
- [ ] Repeatability and unsupported cases have honest outcomes.

**Tests required:** Real mobile HTTPS/camera tests; manual accessibility of start/exit/fallback.

**Out of scope:** Production hosting rollout.

**Review focus:** Device evidence and camera-track cleanup.

---

<a id="i03-p04"></a>

### I03-P04 — Privacy, fallback and provider-port feasibility

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I03-P02](I03-early-ar-technology-spike.md#i03-p02) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: [I03-P03](I03-early-ar-technology-spike.md#i03-p03) once each task's prerequisites are accepted.

**Purpose:** Reject approaches that break authorization or accessible fallback.

**Scope:** Frame/artifact processing review, ARPreparation/recognition mapping, synthetic access scope and same-content camera-free path.

**Expected areas/files/modules:** AR port/interface sketches and spike fallback/privacy evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No global target lookup; provider metadata stays adapter-bound; distinguish harness checks from final I12 proofs.

**Acceptance criteria:**

- [ ] No private unrelated target/content is exposed.
- [ ] Fallback preserves readable image/message.
- [ ] Proposed port preserves source version and immutable artifact semantics.

**Tests required:** Wrong-target/denied/unsupported cases and frame/network observations.

**Out of scope:** Final Sharing subsystem or public media endpoints.

**Review focus:** Privacy compatibility, not recognition alone.

---

<a id="i03-p05"></a>

### I03-P05 — Evidence-based technology recommendation and decision

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I03-P01](I03-early-ar-technology-spike.md#i03-p01); [I03-P02](I03-early-ar-technology-spike.md#i03-p02); [I03-P03](I03-early-ar-technology-spike.md#i03-p03); [I03-P04](I03-early-ar-technology-spike.md#i03-p04) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Own the final AR boundary/technology decision.

**Scope:** Review comparison and evidence, select or explicitly block an approach, coordinate the future reviewed ADR-005 technology update and adapter handoff.

**Expected areas/files/modules:** Decision record and future authority-change proposal. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** This planning task changes no ADR. Implementation-time selection follows DEV_WORKFLOW authority review and preserves P0 behavior.

**Acceptance criteria:**

- [ ] Recommendation cites real device/privacy/license evidence.
- [ ] Selected approach or concrete blocker is explicitly recorded.
- [ ] Downstream port/version/fallback implications are reviewed.

**Tests required:** Audit completeness of spike evidence and teammate review.

**Out of scope:** Unreviewed SDK selection or scope relaxation.

**Review focus:** P0 feasibility and authority-change discipline.

---

<a id="i03-p06"></a>

### I03-P06 — Selected spike reproduction and handoff

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I03-P05](I03-early-ar-technology-spike.md#i03-p05) Inherited item hard gates: [I00](I00-repository-project-foundation.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Give downstream implementers a repeatable proven baseline.

**Scope:** Reproduce accepted candidate with clean synthetic artifacts and document preparation/integration constraints.

**Expected areas/files/modules:** AR spike handoff and safe demonstration instructions. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No final recipient integration; preserve failed-device limits and license conditions.

**Acceptance criteria:**

- [ ] Another member reproduces target/reveal proof.
- [ ] Source-version binding and fallback remain correct.
- [ ] I07/I08/I12 receive explicit supported-approach constraints.

**Tests required:** Real selected-candidate repeat scan, fallback and wrong-target checks.

**Out of scope:** Product-ready scanner or acceptance by recording alone.

**Review focus:** Evidence survives handoff.

## Integration / Merge Order

P01 comparison precedes P02 prototypes. P03 and P04 evaluate P02 in parallel. P05 is LEAD's decision gate after all evidence; P06 reproduces the selected result. No technology-specific downstream work before the gate.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Target reliably resolves correct synthetic authorized content; unsupported/denied fallback; version binding; no cross-user reveal; team selects supported approach.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Show a genuinely recognized synthetic prepared image target and readable reveal on recorded supported devices over HTTPS; show denial/unsupported fallback, wrong-version rejection and privacy/license findings.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Unusable mobile support, licensing or camera/frame transfer may rule out a candidate. Failed recognition cannot be covered up with QR navigation, mocked scan, recordings or fallback. Report failed selection as a blocker for I07/I08/I12.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
