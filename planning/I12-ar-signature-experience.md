# I12 — AR Signature Experience

## Summary

Integrate selected recognition approach with genuine authorized ordered target reveal.

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

LEAD, MEMBER_4, MEMBER_2. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

**I03 R1 handoff — review package:** [boundary revision](../spikes/ar/I03-acceptance-boundary-revision.md) transfers actual
product-device/runtime and independent execution requirements here, with V01–V12 source/owner/gate/reopen mapping.
The conditional MindAR decision content is ready; formal I03/revision approval is pending. I08/I11 and all existing
prerequisites remain. No I12 status is completed or whole ticket unlocked by this note.

- Hard dependencies: [I03](I03-early-ar-technology-spike.md); [I08](I08-preview-and-readiness-and-target-preparation.md); [I11](I11-recipient-sharing-and-fallback.md)
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: [I03](I03-early-ar-technology-spike.md); [I08](I08-preview-and-readiness-and-target-preparation.md); [I11](I11-recipient-sharing-and-fallback.md) until their acceptance artifacts are available.
- Blocks: [I15](I15-vi-en-theme-hardening.md), [I19](I19-final-e2e-security-demo-hardening.md) (direct roadmap consumers).
- Can run in parallel with: [I13](I13-admin-orders-demo-fulfillment.md) and eligible [I14](I14-account-views.md) work once their own gates are met; recognition, fallback and device evidence tasks overlap only after reviewed security/adapter contracts.

The authoritative dependency row is **I03, I08, I11** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [BUSINESS_RULES](../docs/BUSINESS_RULES.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [API_CONTRACT](../docs/API_CONTRACT.md)
- [DATABASE](../docs/DATABASE.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [DESIGN_SYSTEM](../docs/DESIGN_SYSTEM.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)
- [ADR-005-ar-provider-boundary](../docs/adr/ADR-005-ar-provider-boundary.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Integrate selected recognition approach with genuine authorized ordered target reveal. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- Accessible camera/scanner states.
- ordered target/artifact mapping and same-content fallback.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Rich effects, simultaneous/multiple targets, required video-only reveal.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

Only accepted I03 recognizer and I08 immutable artifacts; authorization precedes target/reveal resolution. One genuine supported prepared ordered-version reveal, same authorized fallback. Explicit camera start/exit, captions/transcripts, no autoplay assumption or global private lookup.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i12-p01"></a>

### I12-P01 — Final AR integration and security review gate

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I03](I03-early-ar-technology-spike.md); [I08](I08-preview-and-readiness-and-target-preparation.md); [I11](I11-recipient-sharing-and-fallback.md) Inherited item hard gates: [I03](I03-early-ar-technology-spike.md); [I08](I08-preview-and-readiness-and-target-preparation.md); [I11](I11-recipient-sharing-and-fallback.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Own the architecture-sensitive move from spike to paid recipient integration.

**Scope:** Verify selected runtime/artifact contract, access-first resolution, camera/network/CSP/permission settings and bundle boundary.

**Expected areas/files/modules:** AR/Sharing integration design and scoped backend/frontend configuration. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No new SDK selection without I03 evidence and reviewed decision process; no deployment expansion.

**Acceptance criteria:**

- [ ] Selected approach matches accepted evidence.
- [ ] Recipient permission remains backend-owned.
- [ ] Private frame/artifact/media handling is reviewed before runtime wiring.
- [ ] V05/V12: actual scanning trace/storage evidence is assigned for I12-P05 and reviewed in I12-P06; applicable license/notice/redistribution obligations, zero mandatory paid AR cost, compatibility ownership and retest triggers are dispositioned before runtime use.

**Tests required:** Design/API threat-case review against T14–T17/T20 and ADR-005 criteria.

Source: original I03-P04/P05 privacy/license criteria and ADR-005; R1 V05/V12. LEAD owns review. Do not equate static/CSP
or denied-session observations with scanning privacy. Unsatisfied privacy, cost or material-license requirements reopen
selection (R3/R4/R7), rather than silently relax the product.

**Out of scope:** AR provider reselection by preference or expanded target count.

**Review focus:** Final provider boundary and security approval.

---

<a id="i12-p02"></a>

### I12-P02 — Selected recognizer and ordered artifact integration

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I12-P01](I12-ar-signature-experience.md#i12-p01) Inherited item hard gates: [I03](I03-early-ar-technology-spike.md); [I08](I08-preview-and-readiness-and-target-preparation.md); [I11](I11-recipient-sharing-and-fallback.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Use genuine recognition within the current authorized ordered scope.

**Scope:** Load scoped immutable artifact, initialize recognizer lazily, resolve found target through backend and cancel stale requests.

**Expected areas/files/modules:** Frontend AR runtime adapter; backend AR recipient target/reveal interface. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Recognition is only evidence of a match; it is never an access grant.

**Acceptance criteria:**

- [ ] Current ordered artifact drives recognition.
- [ ] Unknown/wrong-version target reveals nothing unrelated.
- [ ] Private runtime/artifact paths respect no-store and session checks.
- [ ] V03: genuine correct/wrong/unknown/ambiguous/version-negative scenarios are exercised against actual scoped backend access; a no-match is distinguished from recognized-but-unauthorized refusal. Combined artifacts remain test-only.

**Tests required:** Adapter target/revoke/unavailable tests and real-device recognized-target check.

**Out of scope:** Public target-to-media mapping or multi-target effects.

**Review focus:** INV-08 and stable ordered binding.

---

<a id="i12-p03"></a>

### I12-P03 — Accessible scanner state and camera lifecycle

- Owner: MEMBER_3
- Reviewer: LEAD
- Status: TODO
- Depends on: [I12-P01](I12-ar-signature-experience.md#i12-p01) Inherited item hard gates: [I03](I03-early-ar-technology-spike.md); [I08](I08-preview-and-readiness-and-target-preparation.md); [I11](I11-recipient-sharing-and-fallback.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Make camera interaction explicit and recoverable.

**Scope:** Instructions/start/permission/init/scanning/found/not-found/reveal/unsupported, named exit/help and track cleanup.

**Expected areas/files/modules:** Frontend ARScannerUI feature and shared status/overlay composition. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use persistent text and reduced-motion alternative; do not hide required fallback in hover-only controls.

**Acceptance criteria:**

- [ ] Camera starts only after explicit action.
- [ ] Exit/unmount stops tracks.
- [ ] Denied/unsupported/no-match paths are explained.
- [ ] V04: actual Android/browser denied/retry, Start/Stop/navigation/unmount, track release and OS camera indicator are observed; record unsupported/runtime outcomes honestly. The Firefox desktop workaround result cannot be reused as mobile acceptance.

**Tests required:** Component state/camera lifecycle tests plus actual mobile permission/exit tests.

**Out of scope:** Final marketing redesign or decorative effects.

**Review focus:** Readable state and user camera control.

---

<a id="i12-p04"></a>

### I12-P04 — Authorized reveal and equivalent fallback integration

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I12-P02](I12-ar-signature-experience.md#i12-p02); [I12-P03](I12-ar-signature-experience.md#i12-p03) Inherited item hard gates: [I03](I03-early-ar-technology-spike.md); [I08](I08-preview-and-readiness-and-target-preparation.md); [I11](I11-recipient-sharing-and-fallback.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Complete the recipient experience across media and camera states.

**Scope:** Image/message, video/caption or audio/transcript rendering, media controls, same-content fallback and safe unavailable state.

**Expected areas/files/modules:** Recipient/AR feature composition with Media delivery. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No video-only gate or autoplay audio; keep unique meaning accessible without camera.

**Acceptance criteria:**

- [ ] Camera and fallback use the same authorized pinned content.
- [ ] Readable alternatives and controls are present.
- [ ] Revoked/unavailable state never substitutes another asset.
- [ ] V06/V07: manual Start/exit/fallback, keyboard/focus/status/readable alternatives, zoom/reflow and actual assistive-technology results are recorded separately from automation; artifact-unavailable fallback, missing-media errors and access revocation remain correct.

**Tests required:** T17/T20 component/media/keyboard tests and recipient browser flow.

**Out of scope:** Advanced music, recap or reactions.

**Review focus:** Accessible equivalence and privacy.

---

<a id="i12-p05"></a>

### I12-P05 — Supported-device genuine AR acceptance

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I12-P02](I12-ar-signature-experience.md#i12-p02); [I12-P03](I12-ar-signature-experience.md#i12-p03); [I12-P04](I12-ar-signature-experience.md#i12-p04) Inherited item hard gates: [I03](I03-early-ar-technology-spike.md); [I08](I08-preview-and-readiness-and-target-preparation.md); [I11](I11-recipient-sharing-and-fallback.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Retest the integrated selected approach on actual recipients/devices.

**Scope:** Recorded OS/browser/device, light/distance/orientation, repeat scan, denied/unsupported/no-target and performance observations.

**Expected areas/files/modules:** AR device acceptance records and repeatable synthetic demo target. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** MEMBER_3 owns runtime fixes; no recording/fake scan as acceptance.

**Acceptance criteria:**

- [ ] Prepared paid target genuinely reveals intended content.
- [ ] Supported limits and camera failure cases are recorded.
- [ ] Fallback and camera exit remain usable on tested devices.
- [ ] V01/V02: record current Android/device/exact browser matrix (including planned Redmi/Chrome and Mi Browser attempt where available), real product HTTPS flow, physical target, repeated scans, lighting/distance/orientation, attempts/results and practical performance; preserve NOT TESTED and failed rows, without invented pass thresholds.
- [ ] V05: capture/redact actual scanning/reveal/loss/Stop/fallback network origins, request payloads including same-origin, and browser/device storage; denied-camera traces alone do not satisfy this gate.
- [ ] V11: another named human, different from the primary runtime implementer, executes the product repeat-scan/reveal/negative/fallback/lifecycle scenarios on their own setup and fills actual environment/results/sign-offs in the linked reproduction record or equivalent referenced evidence.

**Tests required:** Testing Strategy §13 genuine HTTPS mobile tests and manual T21 checks.

Transferred sources: original I03-P02/P03/P04 mobile/privacy/manual tests and I03-P06 independent live execution, retained
in [R1 V01–V07/V11](../spikes/ar/I03-acceptance-boundary-revision.md#deferred-verification-register). MEMBER_4 owns device
evidence and independent reproduction coordination; MEMBER_3 fixes runtime/preparation integration; MEMBER_2 owns readable
fallback. The [blank P06 record](../spikes/ar/evidence/P06-reproduction-record.md) is a template, not a pass. LEAD reviews
with I12-P06; adverse results block I12 acceptance and invoke R1–R7 as applicable. No SDK reselection without reviewed evidence.

**Out of scope:** Universal device support promise or certification.

**Review focus:** Device evidence after final integration.

---

<a id="i12-p06"></a>

### I12-P06 — AR privacy, revocation and historical regression sign-off

- Owner: LEAD
- Reviewer: LEAD
- Status: TODO
- Depends on: [I12-P02](I12-ar-signature-experience.md#i12-p02); [I12-P03](I12-ar-signature-experience.md#i12-p03); [I12-P04](I12-ar-signature-experience.md#i12-p04); [I12-P05](I12-ar-signature-experience.md#i12-p05) Inherited item hard gates: [I03](I03-early-ar-technology-spike.md); [I08](I08-preview-and-readiness-and-target-preparation.md); [I11](I11-recipient-sharing-and-fallback.md)
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Approve core access/version invariants in the final signature experience.

R1 V03/V05/V07/V09/V11 acceptance: LEAD reviews real product wrong/unknown/version/recognized-but-unauthorized cases,
revoke/rotate/disable behavior, historical content after Project/media edits, genuine scanning network/payload/storage
evidence and the independent person's execution. Pair deterministic DB/API tests with genuine device observations;
Codex automation is not the human reproducer. Privacy/security/version/fallback failure blocks sign-off and reopens the
provider decision (R3/R5/R6); do not remove a frozen invariant to obtain a pass.

**Scope:** Wrong-owner target, unknown match, revoked/rotated/disabled access and Project/media replacement after Order.

**Expected areas/files/modules:** AR/Sharing real-DB/API/device regression evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** MEMBER_3/MEMBER_2 fix owned implementation; use genuine target checks alongside deterministic security tests.

**Acceptance criteria:**

- [ ] Wrong scoped targets expose nothing private.
- [ ] Later requests after revoke/disable fail for AR and fallback.
- [ ] Source edits do not remap prior ordered artifacts/media.

**Tests required:** T14–T17/T20/T24 plus DB/API race and actual ordered target rerun.

**Out of scope:** Fallback as replacement for genuine AR proof.

**Review focus:** INV-04/05/08/12 and final LEAD review.

## Integration / Merge Order

P01 LEAD boundary/permission review precedes P02 recognizer integration and P03 scanner UI. P04 accessible reveal/fallback integrates both; P05 real-device proof precedes P06 security/history sign-off.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Supported mobile prepared scan correct content; wrong-user target denied; denied/unsupported fallback; prior Order stable after edit.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.

## Demo Evidence

Scan a real prepared paid-version target on recorded supported devices, reveal intended image/message, deny wrong-owner/unknown target, show denied/unsupported fallback and prove source edits/revocation do not cross versions.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

Recognition can succeed for the wrong owner's target but must still reveal nothing private. Share rotation during scanning/streaming must deny new fetches. Source edits cannot remap an issued target; retest actual device/licensing/privacy constraints.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
