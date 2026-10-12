# I00 — Repository / Project Foundation

## Summary

Establish new separate Next.js frontend + NestJS backend workspace, typed API/build/config and shared DS foundation.

Initial item status: **IN_PROGRESS**. The technical team-ready subset is merged in f1edca0 / merge 1e29053. The full ROADMAP I00 visual/language gate is unproven, so the implementation item remains IN_PROGRESS; P01–P03 alone are DONE. Future owner assignments express accountability, not historical authorship.

## Milestone

M0 — Foundation

## Priority

P0 — mandatory core or supporting foundation/hardening.

## Primary Owner

LEAD

## Reviewer

LEAD is final reviewer for every implementation MR. LEAD-owned work also requires an independent teammate review; see [Review Rules](README.md#review-rules).

## Supporting Members

MEMBER_2, MEMBER_4, MEMBER_3. Support means contract review, cross-feature integration or specialist evidence; primary ownership remains exactly one role per task.

## Dependencies

- Hard dependencies: R04 accepted; implementation-scope clarification where flagged below.
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: The I00 scope/acceptance clarification and outstanding foundation slice identified in Risks / Watch-outs.
- Blocks: [I01](I01-database-foundation.md), [I03](I03-early-ar-technology-spike.md) (direct roadmap consumers).
- Can run in parallel with: No later implementation item until the full [I00](I00-repository-project-foundation.md) gate is accepted; current independent foundation tasks can overlap.

The authoritative dependency row is **R04 accepted** in [ROADMAP §3](../docs/ROADMAP.md#3-milestones). Item hard gates govern integrated implementation/acceptance; limited contract-fixture preparation is allowed only where ROADMAP §5 explicitly permits it. Pxx prerequisites below govern implementation merge order; a preparation fixture is not a completed integration.

## Authority References

- [ROADMAP](../docs/ROADMAP.md)
- [README](../docs/README.md)
- [DESIGN_SYSTEM](../docs/DESIGN_SYSTEM.md)
- [ARCHITECTURE](../docs/ARCHITECTURE.md)
- [FRONTEND_STANDARDS](../docs/FRONTEND_STANDARDS.md)
- [BACKEND_STANDARDS](../docs/BACKEND_STANDARDS.md)
- [DEV_WORKFLOW](../docs/DEV_WORKFLOW.md)
- [TESTING_STRATEGY](../docs/TESTING_STRATEGY.md)

References retain authority ownership. Planned use cases must match the relevant C/BR/INV and API rows; this file introduces no new product rule or endpoint.

## Goal

Establish new separate Next.js frontend + NestJS backend workspace, typed API/build/config and shared DS foundation. Completion requires the entire authoritative acceptance gate, not only individually merged tasks.

## In Scope

- New repo/app skeletons.
- pinned supported versions/lockfile.
- documented env examples.
- CI.
- safe same-origin dev setup.
- VI/EN/theme shells.

The task breakdown defines the reviewable boundaries of these deliverables. Changes to dependencies/tooling/runtime mentioned here are future implementation work only.

## Out of Scope

- Behavior outside approved authority, feature implementation, production deploy.
- Any unapproved capability, OUT promotion, provider-secret leakage or production commercial deployment.

## Architecture / Business Constraints

Keep frontend and backend separate; no business features, database, auth or providers here. Implement only the shared DS acceptance slice required by ROADMAP, using approved tokens and interactions.

[Architecture](../docs/ARCHITECTURE.md) owns responsibilities; [Business Rules](../docs/BUSINESS_RULES.md) owns invariants; [Design System](../docs/DESIGN_SYSTEM.md) owns visual/interaction decisions. Domain/contract review precedes dependent integration; no new layer is required solely to fill a directory.

## Task Breakdown

<a id="i00-p01"></a>

### I00-P01 — Workspace, commands and onboarding baseline

- Owner: LEAD
- Reviewer: LEAD
- Status: DONE
- Depends on: Accepted R04 and the item gates. Inherited item hard gates: R04 accepted; implementation-scope clarification where flagged below.
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Record the reproducible technical baseline already merged.

**Scope:** Pinned workspace, source placeholders, env examples and root commands.

**Expected areas/files/modules:** Root workspace; frontend/backend setup documentation. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Historical DONE is supported by f1edca0 and 1e29053; ownership is future accountability, not an attribution of past authorship.

**Acceptance criteria:**

- [x] Pinned tools and root lockfile are present.
- [x] Setup docs and safe examples are tracked.
- [x] No later business modules are present.

**Tests required:** Existing typecheck/lint/test/build and frozen-install evidence from the I00 review; no fresh runs required for planning.

**Out of scope:** Database, product UI and providers.

**Review focus:** Reproducibility and boundary preservation.

---

<a id="i00-p02"></a>

### I00-P02 — Technical health and frontend test proof

- Owner: LEAD
- Reviewer: LEAD
- Status: DONE
- Depends on: [I00-P01](I00-repository-project-foundation.md#i00-p01) Inherited item hard gates: R04 accepted; implementation-scope clarification where flagged below.
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Retain the minimal cross-process integration proof.

**Scope:** Nest technical health, uncached server-only Next health proof and one component-test baseline.

**Expected areas/files/modules:** Backend health/config; frontend route/test areas. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** The existing /api/v1/health is an I00 proof, not the generic business API proxy; later contract health/live and health/ready must be reconciled in I01.

**Acceptance criteria:**

- [x] Backend health and frontend proxy are present.
- [x] Controlled 502 has no internal details.
- [x] Frontend and backend test baselines are present.

**Tests required:** Existing unit/e2e/component and smoke evidence; plan later operational contract alignment in I01.

**Out of scope:** Generic BFF or business endpoints.

**Review focus:** Server-only URL and no-store failure handling.

---

<a id="i00-p03"></a>

### I00-P03 — Docker and CI reproducibility baseline

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: DONE
- Depends on: [I00-P01](I00-repository-project-foundation.md#i00-p01); [I00-P02](I00-repository-project-foundation.md#i00-p02) Inherited item hard gates: R04 accepted; implementation-scope clarification where flagged below.
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Preserve the merged team quality gate.

**Scope:** Pinned images, configurable host ports, GitHub workflow and provider-neutral pnpm verify.

**Expected areas/files/modules:** Dockerfiles; Compose; GitHub workflow; root scripts. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** No runtime changes in this planning task; use isolated project names for any future smoke run.

**Acceptance criteria:**

- [x] Frozen installs are configured.
- [x] Both applications have separate images.
- [x] The merged CI invokes the shared quality contract.

**Tests required:** Use merged Docker/quality evidence; future edits require isolated smoke tests.

**Out of scope:** Deployment, unrelated Docker projects and pruning.

**Review focus:** No secrets or lockfile bypass.

---

<a id="i00-p04"></a>

### I00-P04 — Approved tokens and essential controls

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: BLOCKED
- Depends on: [I00-P01](I00-repository-project-foundation.md#i00-p01); AUTHORITY CLARIFICATION REQUIRED: [I00](I00-repository-project-foundation.md) acceptance scope Inherited item hard gates: R04 accepted; implementation-scope clarification where flagged below.
- Can run in parallel with: [I00-P06](I00-repository-project-foundation.md#i00-p06) once each task's prerequisites are accepted.

**Purpose:** Provide the shared visual basis needed by the roadmap slice.

**Scope:** Approved semantic themes/type/space roles and the Button/FormField/Input subset needed by fixtures.

**Expected areas/files/modules:** Frontend design-system foundations and primitives. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Read values from DESIGN_SYSTEM rather than copying a new authority into planning; build only the slice's needed controls.

**Acceptance criteria:**

- [ ] Both theme mappings follow approved roles.
- [ ] Labels/errors and focus are accessible.
- [ ] Long VI/EN labels wrap at 320px/200%.

**Tests required:** Vitest/Testing Library control states, keyboard and rendered contrast checks.

**Out of scope:** Complete DS inventory or product forms.

**Review focus:** Token reuse and native semantics.

---

<a id="i00-p05"></a>

### I00-P05 — Shared Dialog behavior

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: TODO
- Depends on: [I00-P04](I00-repository-project-foundation.md#i00-p04) Inherited item hard gates: R04 accepted; implementation-scope clarification where flagged below.
- Can run in parallel with: [I00-P06](I00-repository-project-foundation.md#i00-p06) once each task's prerequisites are accepted.

**Purpose:** Establish one safe interaction primitive for later features.

**Scope:** Named trigger/title, focus entry/trap/restore, Escape, inert background and safe destructive cancellation.

**Expected areas/files/modules:** Frontend design-system composites. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use one shared implementation; never confirm actions from backdrop or unrelated Enter.

**Acceptance criteria:**

- [ ] Focus stays in the dialog and returns to its trigger.
- [ ] Escape and safe Cancel work.
- [ ] Compact/zoom layouts preserve content and actions.

**Tests required:** Component keyboard/focus tests plus manual screen-reader check.

**Out of scope:** Feature-specific modal implementations.

**Review focus:** Focus safety and shared behavior.

---

<a id="i00-p06"></a>

### I00-P06 — VI/EN and theme shells

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: BLOCKED
- Depends on: [I00-P01](I00-repository-project-foundation.md#i00-p01); AUTHORITY CLARIFICATION REQUIRED: [I00](I00-repository-project-foundation.md) acceptance scope Inherited item hard gates: R04 accepted; implementation-scope clarification where flagged below.
- Can run in parallel with: [I00-P04](I00-repository-project-foundation.md#i00-p04); [I00-P05](I00-repository-project-foundation.md#i00-p05) once each task's prerequisites are accepted.

**Purpose:** Make required presentation preferences available from foundation.

**Scope:** Dictionary structure, explicit language/theme controls and nonsecret preferences for neutral public/Admin shells.

**Expected areas/files/modules:** Frontend i18n; app layouts; design-system theme consumption. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Begin independently with dictionary/control semantics; merge token-dependent rendering after P04. No authentication or Admin operations.

**Acceptance criteria:**

- [ ] Language is consistent across shell navigation.
- [ ] OS default and explicit theme choice work.
- [ ] Preferences contain no auth secrets.

**Tests required:** Component preference/navigation tests and VI/EN glyph/expansion checks.

**Out of scope:** Business screens or automatic UGC translation.

**Review focus:** Shared shell composition and safe preference storage.

---

<a id="i00-p07"></a>

### I00-P07 — Public, form/dialog and Admin DS slice acceptance

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: TODO
- Depends on: [I00-P04](I00-repository-project-foundation.md#i00-p04); [I00-P05](I00-repository-project-foundation.md#i00-p05); [I00-P06](I00-repository-project-foundation.md#i00-p06) Inherited item hard gates: R04 accepted; implementation-scope clarification where flagged below.
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Close the actual roadmap visual foundation gate.

**Scope:** Neutral DS fixture compositions and common-gate evidence; any fixes stay within the slice.

**Expected areas/files/modules:** Frontend DS examples/layout compositions and acceptance evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Fixtures are nonbusiness examples, not fake product modules or permissions. Add only the approved testing tools needed for this gate.

**Acceptance criteria:**

- [ ] All three representative compositions exist.
- [ ] Both languages/themes pass keyboard, contrast, 320px and 200% checks.
- [ ] LEAD records scope clarification and reviewed I00 acceptance.

**Tests required:** Playwright visual/axe baseline plus manual keyboard/screen-reader/reduced-motion evidence.

**Out of scope:** Product feature implementation or certification claims.

**Review focus:** Evidence completeness; do not infer full acceptance from merged technical scaffolding.

## Integration / Merge Order

P01–P03 are historical completed work, not requests to redo them. Resolve the [I00](I00-repository-project-foundation.md) acceptance-scope clarification first; then P04 and P06 can start independently, P05 follows P04, and P07 follows P04–P06. Obtain reviewed full-gate evidence before declaring [I00](I00-repository-project-foundation.md) DONE.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Both apps build/typecheck/lint; public/form/dialog/Admin DS slice passes common gate; no secrets or frontend DB import.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [ ] Required typecheck, lint, tests and build pass; affected API/DB/provider/device/UI checks pass at the correct layer.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.
- [ ] AUTHORITY CLARIFICATION REQUIRED is resolved by the proper authority owner and the full I00 gate is evidenced; merged technical scaffolding alone is insufficient.

## Demo Evidence

Use the merged setup/health/Docker evidence for the technical foundation; demonstrate the future DS public/form/dialog/Admin fixtures in both languages/themes, with keyboard, 320px and 200% zoom evidence.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

AUTHORITY CLARIFICATION REQUIRED: f1edca0 and merge 1e29053 prove the narrower team-ready foundation is merged, while ROADMAP I00 also requires VI/EN/theme shells and a public/form/dialog/Admin DS slice. Those areas contain placeholders. LEAD must obtain an explicit reconciliation of completion scope; do not silently move or waive the roadmap gate. Also reconcile I00 version-pinning statements in ADR-002/Backend Standards with the merged foundation's explicit DB/Prisma deferral to I01. No authority edit is authorized by this planning pack.

Authority ambiguity is reported as **AUTHORITY CLARIFICATION REQUIRED** and pauses only the affected decision. This planning task changes no authority, application, dependency or runtime file.
