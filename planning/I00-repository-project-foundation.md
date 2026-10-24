# I00 — Repository / Project Foundation

## Summary

Establish new separate Next.js frontend + NestJS backend workspace, typed API/build/config and shared DS foundation.

Current item status: **IN_REVIEW**. P01–P03 remain historical DONE work. P04–P07 are implemented and pass the available automated acceptance layer; screen-reader, actual browser-toolbar zoom and human acceptance remain outstanding. No DONE claim is made for those tasks or the parent.

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

- Hard dependencies: R04 accepted. The explicit LEAD request resolves implementation scope; see the decision below.
- Soft/helpful dependencies: None beyond the hard gates.
- Blocked by: No implementation-scope decision. Full acceptance awaits the named manual evidence and reviewer sign-off below.
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
- Status: IN_REVIEW
- Depends on: [I00-P01](I00-repository-project-foundation.md#i00-p01) Inherited item hard gates: R04 accepted; full scope explicitly authorized by LEAD.
- Can run in parallel with: [I00-P06](I00-repository-project-foundation.md#i00-p06) once each task's prerequisites are accepted.

**Purpose:** Provide the shared visual basis needed by the roadmap slice.

**Scope:** Approved semantic themes/type/space roles and the Button/FormField/Input subset needed by fixtures.

**Expected areas/files/modules:** Frontend design-system foundations and primitives. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Read values from DESIGN_SYSTEM rather than copying a new authority into planning; build only the slice's needed controls.

**Acceptance criteria:**

- [x] Both theme mappings follow approved roles.
- [x] Labels/errors and focus are accessible.
- [x] Long VI/EN labels wrap at 320px/200%.

**Tests required:** Vitest/Testing Library control states, keyboard and rendered contrast checks.

**Out of scope:** Complete DS inventory or product forms.

**Review focus:** Token reuse and native semantics.

---

<a id="i00-p05"></a>

### I00-P05 — Shared Dialog behavior

- Owner: MEMBER_2
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I00-P04](I00-repository-project-foundation.md#i00-p04) Inherited item hard gates: R04 accepted; full scope explicitly authorized by LEAD.
- Can run in parallel with: [I00-P06](I00-repository-project-foundation.md#i00-p06) once each task's prerequisites are accepted.

**Purpose:** Establish one safe interaction primitive for later features.

**Scope:** Named trigger/title, focus entry/trap/restore, Escape, inert background and safe destructive cancellation.

**Expected areas/files/modules:** Frontend design-system composites. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Use one shared implementation; never confirm actions from backdrop or unrelated Enter.

**Acceptance criteria:**

- [x] Focus stays in the dialog and returns to its trigger.
- [x] Escape and safe Cancel work.
- [ ] Compact/zoom layouts preserve content and actions.

**Tests required:** Component keyboard/focus tests plus manual screen-reader check. Automated entry/trap/restore, disabled/hidden control exclusion, Escape/Cancel and destructive safety pass; screen-reader evidence remains pending.

**Out of scope:** Feature-specific modal implementations.

**Review focus:** Focus safety and shared behavior.

---

<a id="i00-p06"></a>

### I00-P06 — VI/EN and theme shells

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I00-P01](I00-repository-project-foundation.md#i00-p01) Inherited item hard gates: R04 accepted; full scope explicitly authorized by LEAD.
- Can run in parallel with: [I00-P04](I00-repository-project-foundation.md#i00-p04); [I00-P05](I00-repository-project-foundation.md#i00-p05) once each task's prerequisites are accepted.

**Purpose:** Make required presentation preferences available from foundation.

**Scope:** Dictionary structure, explicit language/theme controls and nonsecret preferences for neutral public/Admin shells.

**Expected areas/files/modules:** Frontend i18n; app layouts; design-system theme consumption. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Begin independently with dictionary/control semantics; merge token-dependent rendering after P04. No authentication or Admin operations.

**Acceptance criteria:**

- [x] Language is consistent across shell navigation.
- [x] OS default and explicit theme choice work.
- [x] Preferences contain no auth secrets.

**Tests required:** Component preference/navigation tests and VI/EN glyph/expansion checks.

**Out of scope:** Business screens or automatic UGC translation.

**Review focus:** Shared shell composition and safe preference storage.

---

<a id="i00-p07"></a>

### I00-P07 — Public, form/dialog and Admin DS slice acceptance

- Owner: MEMBER_4
- Reviewer: LEAD
- Status: IN_REVIEW
- Depends on: [I00-P04](I00-repository-project-foundation.md#i00-p04); [I00-P05](I00-repository-project-foundation.md#i00-p05); [I00-P06](I00-repository-project-foundation.md#i00-p06) Inherited item hard gates: R04 accepted; full scope explicitly authorized by LEAD.
- Can run in parallel with: No independent task within this item is named; eligible external tracks remain listed in Dependencies.

**Purpose:** Close the actual roadmap visual foundation gate.

**Scope:** Neutral DS fixture compositions and common-gate evidence; any fixes stay within the slice.

**Expected areas/files/modules:** Frontend DS examples/layout compositions and acceptance evidence. These are implementation areas, not a prescription of new filenames.

**Implementation notes:** Fixtures are nonbusiness examples, not fake product modules or permissions. Add only the approved testing tools needed for this gate.

**Acceptance criteria:**

- [x] All three representative compositions exist.
- [ ] Both languages/themes pass keyboard, contrast, 320px and 200% checks.
- [ ] LEAD records scope clarification and reviewed I00 acceptance.

**Tests required:** Playwright visual/axe baseline plus manual keyboard/screen-reader/reduced-motion evidence.

**Out of scope:** Product feature implementation or certification claims.

**Review focus:** Evidence completeness; do not infer full acceptance from merged technical scaffolding.

## Integration / Merge Order

P01–P03 remain historical completed work. LEAD explicitly authorized the full scope. P04 and independent P06 foundations were integrated, P05 consumes P04, and P07 composes all three. Obtain the remaining manual evidence and reviewed full-gate acceptance before declaring [I00](I00-repository-project-foundation.md) DONE.

A Pxx normally maps to one small MR. Tests for its behavior belong in that MR; acceptance tasks add cross-slice evidence rather than postponing all tests. If a slice grows beyond independent review, refine it in planning with one owner per new task, preserving parent gates and authority.

## Ixx Acceptance Criteria

- [ ] Both apps build/typecheck/lint; public/form/dialog/Admin DS slice passes common gate; no secrets or frontend DB import.
- [ ] All in-scope Pxx acceptance criteria and integration scenarios are satisfied and evidenced.
- [x] Required typecheck, lint, tests and build pass; affected API/DB/UI checks pass at their available layers. No provider/device behavior was added.
- [ ] No unapproved scope, secret, dependency-boundary or historical-data change; LEAD and an independent reviewer approve where required.
- [x] The explicit LEAD decision resolves implementation scope without waiving or deferring the visual/language gate.
- [ ] Required manual common-gate evidence and LEAD/independent review are recorded.

## Demo Evidence

The neutral compositions are `/`, `/foundation/form` and `/foundation/admin`. Automated browser evidence covers VI/EN, Light/Dark, keyboard, contrast, all approved viewport widths and 200% text resizing. Actual browser-toolbar zoom and screen-reader evidence remain separate pending manual actions.

Use safe synthetic content and redacted evidence. Fake adapters accelerate deterministic tests; genuine provider/device acceptance cannot be replaced by mock success or an unlabeled recording.

## Risks / Watch-outs

The previous acceptance-scope blocker is resolved by the explicit LEAD implementation request:

> The full ROADMAP I00 visual/language gate remains part of I00 and is explicitly authorized for implementation; it is not waived or deferred.

This decision authorizes implementation within frozen authority; it changes no authority semantics. P01–P03 are retained unchanged. I01/I02 persistence, API and security logic remain unchanged. Manual common-gate evidence and reviewer acceptance remain required.

## Execution evidence — 2026-10-17

Branch: `feature/I00-complete-foundation`; starting HEAD: `95ebc97e64db02827eacdf3243da63f796ac3607`. The working tree was clean before this work. No commit or push was performed.

### Implementation and decisions

- P04: one CSS mapping of all 28 approved semantic color pairs, required type/space/layout/control roles, self-hosted Baloo 2 and Be Vietnam Pro Latin/Vietnamese subsets, shared native Button/Input and labeled FormField. Existing I02 forms consume them. Native disabled/loading semantics and password/API behavior are preserved.
- P05: shared native modal Dialog with named trigger/title/description, intentional Cancel focus, Tab/Shift+Tab containment, focus restoration, Escape policy, native inert background, explicit Cancel and guarded destructive Enter. Hidden, disabled and negative-tab-order descendants are excluded. Backdrop interaction never confirms.
- P06: shared VI/EN dictionaries and explicit preferences; server-rendered root language/theme, live OS appearance through CSS and enum-only presentation cookies. Initial System rendering needs no hydration-time theme switch. Public/Admin and identity presentation use the same preference boundary; user-authored example text is not translated.
- P07: neutral public, form/Dialog and responsive Admin table/list examples; no Admin permissions, account operations, product services or persistence added. Playwright/axe baseline and reviewed-capture workflow extend the existing quality gate; CI retains its prior checks and adds the needed browser runtimes and Windows visual job.
- Pinned additions: Fontsource Baloo 2/Be Vietnam Pro 5.3.0 (OFL-1.1); Playwright 1.64.1 (Apache-2.0); axe Playwright 4.14.0 (MPL-2.0); user-event 14.6.8 (MIT). They supply authority-required fonts and missing browser/accessibility testing, without adding a UI framework. Only the root lockfile was updated through normal pnpm resolution.

### Verification actually executed

Node 24.21.0 and pnpm 11.22.0 were selected for all checks.
The following table records the initial implementation run. The final review
rerun and current counts are recorded separately below.

| Command | Result |
| --- | --- |
| `pnpm --dir frontend add --save-exact @fontsource/be-vietnam-pro@5.3.0 @fontsource/baloo-2@5.3.0` | PASS |
| `pnpm --dir frontend add --save-dev --save-exact @playwright/test@1.64.1 @axe-core/playwright@4.14.0 @testing-library/user-event@14.6.8` | PASS |
| `pnpm --dir frontend exec playwright install chromium firefox webkit` | PASS; local Windows runtimes installed |
| `pnpm install --frozen-lockfile` | PASS; no lockfile bypass |
| `pnpm peers check` | PASS |
| `pnpm typecheck` | PASS; both applications |
| `pnpm lint` | PASS; both applications and added tests/config |
| `pnpm test` | PASS; 40 backend, 19 frontend and four backend health e2e tests |
| `pnpm build` | PASS; both applications |
| `pnpm test:ui` | PASS; 27 cases across Chromium/Firefox/WebKit |
| `pnpm test:visual --update-snapshots` | PASS; initial 32 Windows/Chromium captures, then only inspected skip-link/table corrections |
| `pnpm test:visual` | PASS; four cases compare 32 captures without updating them |
| `pnpm verify` | PASS; includes typecheck/lint/unit/build, generated contracts, gateway, browser suite and 18 I01 + 23 I02 real PostgreSQL groups |
| `pnpm test:docker` | PASS; fresh startup ordering, images/fonts, gateway/client isolation, sessions/SSR, database outage and owned-resource cleanup |
| `pnpm --dir backend test --runInBand --detectOpenHandles` | PASS; 40 tests, normal exit, no reported open handles |
| `git diff --check` | PASS; final documentation/source whitespace check |

Development checks exposed a Dialog JSDOM focus-cycle issue, ambiguous preference label lookup, WebKit's default omission of implicit links/buttons from Tab navigation, transient contrast during a theme color transition, a Firefox reload/navigation race and a screenshot filename-template error. These were corrected while retaining the accessibility assertions. The first aggregate run stopped because Docker Desktop was not running; it was started, then the aggregate passed against disposable PostgreSQL. Parallel Jest runs emitted a worker-shutdown warning; the unsuppressed serial open-handle diagnostic passed and exited normally. Console Ninja instrumentation was visible locally; no causal attribution or test suppression is claimed. Hosted CI is NOT RUN.

### Available acceptance evidence

- Component tests cover native keyboard activation, disabled/loading behavior, stable label/help/error associations and unmodified Unicode input, safe Dialog behavior, preference navigation/storage and exact authority color mappings. The existing I02 tests retain their assertions with the shared provider wrapper.
- The browser matrix visits all three compositions in VI/EN × Light/Dark at 320, 375, 600, 768, 960, 1280 and 1440 CSS px, checks no horizontal loss, and repeats reflow at 200% root text size. Open/error Dialog/form states are checked at compact size and 200% text size.
- Axe WCAG 2/2.1/2.2 A/AA-tagged checks report zero violations in exercised states. Rendered action text contrast is at least 4.5:1 through normal/hover/pressed states; tested control boundaries/focus are at least 3:1. Keyboard tests verify visible 2px focus, skip link, validation focus, actual native modal containment, safe Cancel/Escape, restoration and blocked background focus. Reduced-motion checks pass.
- OS appearance responds live; explicit preferences survive reload/navigation and initial rendering without JavaScript. Storage tests allow only language/theme enum cookies and no localStorage data. Actual self-hosted font loading and Vietnamese text are checked.
- Thirty-two intentional visual baselines cover public/form/Admin and open Dialog states at 320/1280px in both languages/themes. All 32 were inspected during the final review for glyphs, wrapping, material, density and actions. Baselines are Windows-specific; the CI visual job pins Windows Server 2025. Independent human visual acceptance is pending.
- Frozen authority and all backend source/migrations/contracts retain their starting bytes. No frontend Prisma/database import, auth secret persistence, migration, later business feature or historical source reuse was introduced.

### Required manual actions before DONE

- [ ] In a real browser, set toolbar zoom to 200% and check all three compositions plus an open Dialog in VI/EN and Light/Dark: no lost content/actions, usable internal scrolling, and visible reachable focus. Automated 200% text resizing does not claim this browser-toolbar evidence.
- [ ] With NVDA (Chrome/Firefox) or VoiceOver (Safari), check both languages/themes: names and descriptions, required/error relationships, loading announcements, Dialog title/consequence/Cancel entry, inert background, Escape/Cancel and restored trigger. Record browser/OS/assistive-technology versions and actual observations; no screen-reader run has been performed here.
- [ ] LEAD and the required independent teammate inspect the supplied captures/common gate and record acceptance. Existing P01–P03 completion is not reopened.

All four new task implementations and the parent remain **IN_REVIEW** until applicable manual/common-gate and reviewer evidence is complete. No criterion is waived, no certification is claimed, and no later feature was implemented to fill a fixture.

### Final pre-commit review — 2026-10-17

The review started from the existing uncommitted I00 slice on the same branch and
HEAD above. It included all modified tracked files, untracked source/configuration,
the lockfile and every one of the 32 PNG baselines. It did not commit or push.

Concrete findings corrected within I00:

- **Medium — Dialog keyboard/lifecycle:** the broad Enter guard prevented textarea
  newlines and link activation; outer Dialog handlers intercepted nested Dialog
  keys; Tab treated every radio option as a stop and could include collapsed
  details content. Descendant-handled keys, modal ownership, native radio grouping
  and collapsed content are now respected. A queued close event cannot reset the
  expanded state or steal focus after immediate reopening. New unit/browser
  regressions cover these cases, Strict Mode/rerender and disabled actions.
- **Medium — loading announcements:** changing the accessible name inside an
  `aria-busy` button did not provide a dependable live announcement. Loading now
  requires a caller-localized label and has a persistent status region outside the
  busy button. Identity's redundant busy form ancestor was removed so it cannot
  defer that announcement. Authentication handlers and transport are unchanged;
  actual assistive-technology confirmation remains a manual gate.
- **Low — fixture dead ends:** outline/ghost actions now acknowledge activation
  with localized, persistent demonstration feedback; tests verify both work
  independently without mutation requests.
- **Low — duplicate preference reads:** identity pages passed ignored preference
  props through an extra server helper. They now consume only the existing root
  presentation provider; the unused helper/props were removed.
- **Low — fonts:** subset-only CSS entry points lacked Unicode ranges and eagerly
  downloaded unused Vietnamese weights on English pages. Standard weight entry
  points now retain Fontsource ranges. A fresh Chromium homepage probe measured
  EN 96,320 font bytes (previously 126,376) and VI 155,468 bytes, including needed
  Latin/extended/Vietnamese glyph subsets. All requests are same-origin. The
  browser matrix checks self-hosting, actual rendered-language font loading and
  absence of unused Vietnamese heading/bold weights on English compositions.
- **Low — CI/setup:** both CI browser jobs skip unused headed Chromium downloads
  with `--only-shell`; Firefox/WebKit and Linux system libraries remain required.
  Browser failure artifacts now exist for the main gate too, visual CI pins
  `windows-2025`, and the root installation section explicitly names browser
  prerequisites before `pnpm verify`. No quality gate was removed or weakened.

The font correction caused small, stable glyph-rendering differences in 28
baselines. Before updating, all 28 diagnostic diffs were inspected: dimensions,
wrapping, surfaces and control positions were unchanged. Only then were changed
baselines updated. Their SHA-256 hashes exactly matched the previously inspected
actual captures; the four English Dialog baselines stayed unchanged. A normal
comparison subsequently passed all 32 captures. Soft screenshot assertions collect
all differences in a case while still failing it on any mismatch; tolerance and
retry settings were not relaxed. The baseline set is 2,737,744 bytes.

Final review verification (same pinned Node/pnpm):

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm peers check` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS; 22 frontend, 40 backend, four backend health e2e tests |
| `pnpm build` | PASS; both applications |
| `pnpm contract:check` | PASS |
| `pnpm test:proxy` | PASS |
| `pnpm test:ui` | PASS; 36 cases across Chromium/Firefox/WebKit, also repeated by verify |
| `pnpm test:visual` | PASS; four cases, 32 captures, without updates |
| `pnpm test:db` | PASS; 18 I01 and 23 I02 real PostgreSQL groups |
| `pnpm verify` | PASS; all constituent gates |
| `pnpm test:docker` | PASS; fresh startup, production images, gateway/session/SSR isolation, outage and owned-resource cleanup |
| `pnpm --dir backend test --runInBand --detectOpenHandles` | PASS; 40 tests, normal exit, no reported handles |
| `pnpm --dir frontend test src/design-system/composites/dialog.test.tsx src/design-system/primitives/controls.test.tsx` | PASS; seven focused regressions |
| `pnpm --dir frontend exec playwright install --only-shell chromium firefox webkit` | PASS; pinned CI runtime selection also inspected with `--dry-run` |
| `git diff --check` | PASS |

Initial regression tests failed for the original multiline/nested-modal defects,
then passed after correction. The initial visual comparison failed for the
inspected font change, then passed after its reviewed baseline update. The first
database attempt could not reach a stopped Docker daemon; Docker Desktop was
started and both standalone and aggregate database gates passed. Parallel Jest
still emitted its worker-shutdown warning; the unsuppressed serial diagnostic
passed normally. No causal attribution to local IDE instrumentation is made.

Frozen authorities, backend code/migrations/OpenAPI, frontend auth API/session
infrastructure and the historical P01–P03 planning blocks remain unchanged.
`core.autocrlf=true` explains the LF-to-CRLF warnings; there is no accidental
whole-file diff churn and `.gitattributes` remains unchanged. Reports/traces/caches
are ignored; only intentional baseline PNGs belong in the commit. Hosted CI,
screen-reader use, actual browser-toolbar 200% zoom and LEAD/independent teammate
acceptance are **not performed** by this review. The manual checklist above and
all five IN_REVIEW statuses remain in force.
