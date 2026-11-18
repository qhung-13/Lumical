# UI migration PR preparation

Prepared on 2026-11-18 for `feature/ui-i00-i06-reference-integration`, targeting `dev`.

## Repository and baseline

The main checkout at `D:\Project\Lumical` now contains the committed UI migration on the feature branch. The former implementation worktree at `.cache/ui-migration` is detached at its saved integration commit and retains its ignored dependencies, screenshots, and test artifacts.

| Reference | Verified commit |
| --- | --- |
| Local `dev`, preserved from the start of this task | `9d7a1274ff573c76a954b99748a1aacc15be45f3` |
| Fetched `origin/dev`, including I07-P03 from PR #54 | `150bd0c205590fa79cc6cd941ccc7b436ff1fda0` |
| UI implementation commit | `d03322f7b133d0951b84541eea81ac0b910a3a5f` |
| Feature merge with the current remote baseline | `4953ea088d3e0d7cb81350a4bc201ae936d36428` |

The remote was fetched with `git fetch --prune origin`. The feature-only merge preserves both parents. The branch includes all commits from the verified remote baseline.

The merge reported conflicts in `frontend/src/features/media/media-upload.tsx` and `media-upload.module.css`. The resolution keeps I07-P03's `StudioImageUpload`, image-only inline mode, Ready-image callback, and shared panel. The standalone page wraps that panel in the accepted layout. The inline panel keeps the existing large radius. `frontend/src/features/calendar-projects/studio*`, `month-editor*`, `frontend/src/api`, the backend, and approved authority documents match `origin/dev`.

The saved stash remains `3e941268be11ea81073fdf7fdd4ae6615ad1cd51`. The original `lumical.dbml` SHA-256 remains `0AADC1E15A678793B252CC4464CEA424DE395C75E38509D7B66E5207DA76537A`. Git and Docker exclude `Lumical_Old`. Git excludes `.cache`, dependency directories, test outputs, and build outputs. The legacy reference was read-only throughout this task.

## Validation on the integrated branch

These checks ran from the main checkout after the feature-only merge, against integration commit `4953ea0`. The earlier checkpoint report describes the November 17 prototype checks and is retained as historical evidence.

| Check | Fresh result |
| --- | --- |
| `pnpm --dir frontend typecheck` | PASS. |
| `pnpm --dir frontend lint` | PASS. |
| `pnpm --dir frontend build` | PASS on the first invocation, including all migrated routes and the current Studio route. |
| `pnpm --dir frontend test --maxWorkers=1 --testTimeout=20000` | PASS: 191 tests in 24 files, including the current Month editor and Studio tests. |
| `pnpm --dir frontend test:e2e --workers=3 --timeout=90000` | 135 PASS, 3 Firefox timeouts. Chromium and WebKit each passed all 46 cases. Initial log and three failure traces are preserved locally. |
| `pnpm --dir frontend exec playwright test --project=firefox --workers=1 --timeout=90000` | PASS: all 46 cases, including the three earlier timeouts, in 3.1 minutes. Application and tests were unchanged. |
| `pnpm --dir frontend test:visual --workers=1 --timeout=90000` | PASS: all 4 Windows Foundation visual cases, with the checked-in baselines unchanged. |
| `pnpm --dir backend build`, then `pnpm contract:check` | PASS: reviewed backend OpenAPI and generated frontend types match. |
| Changed-path and sensitive-pattern audit | PASS for all 53 implementation paths against `origin/dev`; no excluded directories, local DBML, environment files, private keys, credential URLs, recognized provider/token secrets, or legacy runtime imports. |
| Preserved-state comparison | PASS: local `dev`, stash list, DBML checksum, and reference directory timestamp match the initial snapshot. |
| Production artifact audit | PASS: no `Lumical_Old` reference in the contents of 20 Next.js file-trace manifests. |
| Review links | PASS: all 24 local links across the migration audit, checkpoint report, and this handoff resolve in the main checkout. |
| `git diff --check` and `git diff --check origin/dev...HEAD` | PASS; no unresolved index entries. |

The contract exporter used the existing ignored local Node loader to suppress this machine's Console Ninja injection in NestJS. This changes no application source or dependency. The checked-in API contracts and generated types are unchanged.

The initial parallel browser run timed out in Firefox's Admin create, Admin publish/conflict, and EN/dark Foundation accessibility cases. The saved traces and log include an `AxeBuilder.finishRun` failure, Firefox context/session protocol errors, and a context teardown timeout. They are retained under `.cache/ui-evidence/pr-preparation/first-browser-failures/`; the initial run log is `browser.log`. The serial rerun passed all 46 Firefox cases with the same 90-second test budget. It is recorded separately in `firefox-serial.log` and does not erase the initial failures. Together with Chromium and WebKit, all 138 browser cases have passing coverage. Reliability of the default parallel Firefox run remains a CI follow-up.

Local command logs are stored under `.cache/ui-evidence/pr-preparation/`. These files stay outside the commit. The application source validated by this run is recorded in integration commit `4953ea0`.

The final documentation commit adds this handoff and repairs local screenshot links in the two historical reports after the checkout move. It makes no application changes.

## PR description

**Suggested title** `feat(frontend): migrate LumiCal legacy UI for I00-I06`

**Target branch** `dev`

This PR contains Passes A–E of the I00–I06 migration: Home/navigation, Catalog/Detail, identity/Projects, private Media, and Admin Templates. These routes adopt the original site's visual hierarchy and presentation. The public homepage now has the branded header, framed calendar hero, published Template showcase, creation guide, FAQ, and grouped footer. The Catalog and Detail screens use the reference's filter rail, calendar framing, and price/action panels. Identity, account/Projects, private uploads, and Admin Templates use the corresponding legacy layouts.

The presentation uses the existing V2 typed clients, session and role checks, Template publication and price data, selected-Template handoff, Project idempotency and revision handling, and private-media readiness. The feature integrates the current I07-P03 Month editor from `dev`, including its inline Ready-image upload. Foundation fixtures remain available at `/foundation/public`, `/foundation/form`, and `/foundation/admin`.

### Changed modules

| Area | Review scope |
| --- | --- |
| Product Home and shared shell | Thin Home route, bilingual product copy, navigation, header/footer, compact menu, locale/theme controls, local branding and sample image. |
| Templates | Catalog rail, public cards, layout illustrations, Detail hierarchy and creation handoff. |
| Identity and Projects | Split login/register view, account intro and Project cards, create form and twelve-Month presentation. |
| Private Media | Standalone chooser and progress/status layout, composed with the current Studio upload panel. |
| Admin Templates | Dark navigation rail, card presentation, form preview and existing audited operations. |
| Foundation and validation | Dedicated public fixture, route-aware test mocks, Home browser tests and real API discovery test. |
| Repository exclusions and evidence | Legacy Git/Docker exclusion, migration audit, checkpoint report, proposed visual Change Request, and this PR preparation record. |

### Visual review and known limits

The [Visual Change Request](PROPOSED-Legacy-Visual-Change-Request.md) remains **PENDING LEAD APPROVAL**. The implementation is provisionally accepted for PR preparation. The approved Design System document retains its current baseline.

The public Templates contract provides layout metadata without cover artwork, so previews show labeled illustrations. The hero uses a locally generated synthetic photo and the supplied first-party logo exports. Protected legacy pages were compared with their supplied source because the deployed routes redirected or timed out.

The [visual comparison index](../.cache/ui-evidence/high-fidelity/compare.html) and the [Home before/reference/after image](../.cache/ui-evidence/high-fidelity/home-before-reference-after.jpg) are local review artifacts. The [checkpoint report](I00-I06-High-Fidelity-Checkpoints.md) records the component mapping and asset provenance. Local screenshot assets require attachment by the lead when opening the PR.

CI results are pending the lead's push and PR creation. Fresh local checks passed typecheck, lint, production build, 191 frontend tests, four Foundation visual cases, and OpenAPI/type agreement. Chromium and WebKit passed 46 cases each; Firefox passed all 46 in a serial rerun after three timeouts in the initial parallel run. The validation table above records both runs. Parallel Firefox reliability, manual screen-reader acceptance, and native browser toolbar zoom remain open review checks.

### Review checklist

- [ ] Review the palette, typography, breakpoints, motion, and branding in the pending visual Change Request.
- [ ] Inspect Home, Catalog/Detail, identity, Projects, upload, and Admin in VI/EN and light/dark at 320px, 375px, 768px, and 1440px.
- [ ] Verify Template selection through login and Project creation, archive/restore/delete recovery, and account transitions.
- [ ] Check I07-P03's Month caption/image editing and inline upload against the current `dev` behavior.
- [ ] Check Admin audit reasons, publication preconditions, retry, and stale-version recovery.
- [ ] Attach the selected local visual evidence, complete manual accessibility acceptance, and verify CI before merging.
- [ ] Confirm default parallel Firefox reliability in CI, referring to the retained local failure traces if timeouts recur.
