# LumiCal V2 reference UI migration

The initial mapping and Batch 1 results below are historical. See the [revised high-fidelity checkpoints](I00-I06-High-Fidelity-Checkpoints.md) and [proposed visual Change Request](PROPOSED-Legacy-Visual-Change-Request.md) for the current branch.

## Baseline and scope

On 2026-11-16, local `dev`, `origin/dev` and GitHub's `refs/heads/dev` all resolved to `9d7a1274ff573c76a954b99748a1aacc15be45f3` (`#53`, I07-P02). The first-parent history includes I07-P01 (`#52`), I06 private media hardening (`#50`), I05 project hardening (`#41`) and I04 catalog acceptance closure (`#31`). Relevant earlier implementation commits include I00 `66a81aa` and I02 `83e4df5`.

The original checkout contained untracked `lumical.dbml` and the existing `backup local changes before dev sync` stash. The clean feature worktree is `.cache/ui-migration` on `feature/ui-i00-i06-reference-integration`. The root's local exclude already protects `Lumical_Old/`. This branch also adds explicit root Git and Docker exclusions. The pnpm member list is `frontend` and `backend`, the Dockerfiles use scoped `COPY` paths and CI uploads named test outputs. The reference path is outside the feature worktree. Nothing under it was executed or imported.

The review used Product Scope, Roadmap, Design System v2, Frontend Standards, Architecture, API Contract, Business Rules, Dev Workflow, I00/I02/I04–I07 plans and I05/I06 acceptance evidence. The most recent relevant tracked UI evidence located was the I05 hardening report and I06 acceptance review. Their milestone results are historical. Integration is confirmed from actual routes and code, independently of planning checkboxes.

## Reference inventory

- `Lumical_Old/source` is `postcraft-studio`, a Next.js 15.5.25 App Router application using React 19 and TypeScript. Page Server Components read Prisma directly while interactive components call the same app's Route Handlers. Tailwind CSS 4 and `src/app/globals.css` combine utilities, shared button/card/field styles and light/dark theme overrides. Framer Motion handles reveal, menu and dialog motion, Lucide supplies icons, and Three.js supports a separate 3D preview. `src/app/layout.tsx` sets metadata, local presentation providers and Google-font-backed build inputs.
- `SiteHeader` uses a utility strip, brand, desktop nav, mobile disclosure and account actions. `SiteFooter` groups product/help/about links, contact and newsletter. `LanguageProvider` and `ThemeToggle` use local storage. `PageTranslator` observes DOM mutations, and some controls retain inline Vietnamese. Both layouts use responsive utility classes and custom CSS, including a 768px global breakpoint and a large-screen 1024px split hero/catalog rail.
- `/` reads active designs, a calendar example and visible reviews. Its opening split hero combines copy, catalog/AR actions and `HeroViewfinder`. Later sections cover highlights, sample designs, AR, print specs, pricing, reviews, FAQ and repeated entry actions. `HeroViewfinder` uses animated CSS layers and hosted Cloudinary imagery/video. `ProductMockup`, `TemplateCover`, `CalendarCard` and `DesignSteps` contain useful calendar and instructional compositions.
- `/templates` redirects into `/tuy-chinh`. The actual catalog has URL search, product-line tabs, filters, sorting, numbered pages and `TemplateProductCard`. `/templates/[slug]` resolves renamed slugs and combines a cover/gallery, price, specs/tabs and a creation action. Template content and many images depend on the legacy database/seed catalog. The local public inventory is five logo/favicon images. App-level OG, Twitter and app icons also exist. Seed photos include Unsplash sources, and hosted media/embedded imagery rights were not established from the source. The owner's site authorization establishes the source review context. Third-party imagery, legacy marks and legacy font files were not copied. V2 already ships its approved local fonts.
- `/dang-nhap` and `/dang-ky` share `AuthForm` with labeled fields, a form-level alert, pending feedback and mode-switch links. Password reset/settings are separate. `ConfirmDialog` presents a promise-driven overlay with Framer Motion. `UploadField` contains file input, replace/remove controls, file/type guidance, local preprocessing, busy/error copy and image/video/audio preview. Its multipart upload is part of the old app flow.
- `/custom-calendar?template=…` uses a selected-design summary beside `NewProjectForm`. `/tai-khoan` groups project cards with orders and notifications. `/custom-calendar/[id]` is `StudioEditor` with cover/design and calendar preview, alongside flows for scanning, contribution, sharing and checkout. The legacy repository has no like-for-like private standalone upload page or V2 archive/restore lifecycle.
- `/admin/layout.tsx` gates the legacy workspace and provides `AdminNav` and an account menu. `TemplateManager` mixes a creation panel, images, visibility, deletion and cards. Other legacy admin surfaces include orders, print, customers, projects, wishes, posts and comments. Legacy backend, database, private assets and credential-bearing material were excluded from the review inputs and all changes.

Chromium reached the live Home at 1440px and 375px. The split hero, artwork, terracotta action, utility/header/footer organization and major section order agree with the supplied source. Public routing differs. The deployed `/templates` stayed at `/templates` and rendered the catalog, while public requests to `/dang-nhap` and `/dang-ky` ended at Home. The source declares the catalog redirect and auth pages described above. Authenticated production and Admin views were audited from source only. [Deployed legacy Home](https://lichthietkelumical.com/)

## V2 baseline inventory

- `frontend/src/app` composes thin Next.js App Router pages for the Foundation fixtures, public catalog/detail, login/register, account, owner project detail, guided Studio, private upload and three Admin Templates destinations. The root layout bootstraps the safe session and server-rendered locale/theme before the client providers restore browser presentation and session state.
- `frontend/src/features` owns identity, public and Admin Templates, Calendar Projects/Studio and Media. Existing V2 list/detail, role and lifecycle behavior remains backed by generated OpenAPI contracts and the same-origin `frontend/src/api` clients. The feature components keep scoped pending, empty, error, retry and permission handling. `frontend/src/i18n` has VI/EN copy for each user-facing surface.
- `frontend/src/design-system` supplies local font packages, semantic token CSS, Button/Input, FormField/FileField, native Dialog, shared preference controls and public/Foundation layouts. Before this batch `frontend/public` contained only its placeholder file and public Templates rendered CSS-based layout illustrations. Existing coverage includes route/component and transport tests, three-engine Playwright, Windows Foundation visual baselines, and disposable PostgreSQL/API journeys.

## Migration matrix

| Reference component | V2 target route | Reuse strategy | API integration | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| I00 `SiteHeader`, compact menu and account area | Shared public shell on `/`, `/templates`, `/templates/[id]`, signed-in account, projects and upload | ADAPT | Existing session provider and route guards | Implemented, Batch 1 | Active links, compact disclosure, VI/EN and theme controls. Media for authenticated owners and Templates Admin for active Admins. |
| I00 split hero, sample designs and start flow | `/` | ADAPT | `useTemplateList` through the same-origin active-public Templates endpoint | Implemented, Batch 1 | Single catalog CTA, clearly labeled synthetic hero, then real published designs and a brief starting guide. |
| I00 `SiteFooter`, locale/theme switches, buttons, layout | Public shell and `/foundation/public` | ADAPT | Existing cookie-backed preference provider | Implemented, Batch 1 | Footer scope follows available routes. Shared V2 controls, captions, density and compact/medium/wide thresholds. Foundation examples retain a separate navigation group. |
| I00 legacy logo, type, motion and palette | Public shell and Home | DECISION REQUIRED | Presentation only | Lead review if adopted | Approved V2 typography, tokens and motion contract apply. See compatibility table. |
| I01 Prisma-backed legacy page reads | All V2 UI backed by NestJS | DISCARD | V2 PostgreSQL/Prisma owner modules and generated contracts | Preserve boundary | I01 has no user-facing route. |
| I02 `AuthForm` and alternating entry routes | `/login`, `/register` | RECREATE | Existing typed auth requests, idempotent register, session bootstrap, field/error states and safe return allowlist | Batch 3 | Adapt visual hierarchy, preserve expiry/retry and existing form/mode switch. Batch 1 links use existing paths. |
| I02 account drop-down/logout | `/account`, identity surfaces | ADAPT | `SessionManager`, CSRF, actor cache invalidation | Batch 1 links, Batch 3 presentation | Existing owner-account logout and backend authorization stay authoritative. Honor unknown and changed sessions. |
| I03 AR demo teaser, `/artivive`, scanner | I03 engineering spike only | DISCARD | Provider-neutral architecture, future I07/I08/I12 gates | Outside migration | No user-facing AR promise or production dependency introduced. |
| I04 `/tuy-chinh`, `TemplateFilters`, `TemplateSort` | `/templates` | ADAPT | Category, bilingual search and cursor paging via `templateListOptions` | Batch 2 | Preserve query semantics, retry/error/empty states and keyboard operation. Legacy product-line/sort pricing facets lack a matching contract. |
| I04 `TemplateProductCard`, `ProductMockup`, `TemplateCover` | `/`, `/templates`, `/templates/[id]` | ADAPT | Active published name/description/category/layout USD price and curated presets | Shared V2 card in Batch 1, presentation in Batch 2 | V2 has two layout types, twelve Months and labeled layout illustrations. No artwork field in public DTO. |
| I04 detail gallery, specs, CTA | `/templates/[id]` | RECREATE | Published detail endpoint, `/account?templateId=…`, allowlisted `/login?next=…` | Batch 2 | Restore useful visual hierarchy using verified V2 fields. Preserve unavailable/404 states and sign-in with selection. |
| I04 `AdminNav`, `TemplateManager` | `/admin/templates`, `/admin/templates/new`, `/admin/templates/[templateId]` | ADAPT | Typed Admin Templates API, idempotency, preconditions, audited operator reason and role guard | Batch 5 | Preserve draft revision, publish and availability workflows. Legacy visibility toggle and deletion are discarded. |
| I05 `/custom-calendar`, `NewProjectForm` | `/account?templateId=…` | ADAPT | Existing draft and idempotent project creation with captured template revision and twelve Months | Batch 3 | Preserve year, recipient, title and selected preset, retry and unavailable-template recovery. |
| I05 `/tai-khoan` project cards | `/account` | ADAPT | Actor-scoped cursor-paged own Projects and account reads | Batch 3 | Prioritize Project names, year, state and open action. Orders, notifications and recipient links follow later milestones. |
| I05 `StudioEditor`, `Calendar3DPreview` | `/projects/[id]` and existing `/projects/[id]/studio` | RECREATE | Project and ordered Months reads, backend lifecycle eligibility, root ETag and `If-Match` | Batch 3 detail only | Twelve-Month navigation and archive/restore/delete remain V2 interactions. Use existing confirmation/focus, stale-revision review and retained drafts. I07 editor stays within its own sequence. |
| I06 `UploadField` | `/media/upload` | RECREATE | Existing intent, signed provider upload, trusted finalization, polling and retry | Batch 4 | Adapt file selection, progress, retry and failure hierarchy around backend `READY`. |
| I06 media thumbnails/preview and Studio handoff | Owned media receipt and future I07 attachment | ADAPT | Existing same-origin private media delivery and owned Ready asset identity | Batch 4 planning, I07 attachment separate | No owner-wide library contract. Provider originals, public URL disclosure and the legacy media management UI are discarded. |
| Legacy newsletter, reviews, blog, recovery/settings, fulfillment, sharing, QR and social routes | Future milestones where applicable | DISCARD | Outside I00–I06 migration | Deferred | Public navigation only advertises implemented routes. |

The migration adapts the legacy composition using V2 controls, the session provider and existing template presentation. The legacy presentation components depend on utility styles, backend relationships or packages outside the V2 frontend.

## Design System compatibility and decisions

| Topic | Compatible or adapted | Conflict requiring a lead decision |
| --- | --- | --- |
| Hierarchy and composition | Split hero, visible calendar product, designs after the introduction, short starting guide and grouped utility links scaled to V2 breakpoints and public spacing. | **DECISION REQUIRED** for legacy 768/1024 breakpoint overrides or condensed card rhythm. Those changes would alter approved medium/wide reflow and touch target behavior. |
| Palette and surfaces | Warm paper and terracotta carried through semantic canvas, surface, brand, border and focus roles. | **DECISION REQUIRED** for legacy `#c0392b`, gold-filled parallel CTAs, dark-palette overrides, striped panels or chunky shadows. Those treatments change the V2 brand accents and require rendered contrast and hierarchy review. |
| Typography and marks | Self-hosted V2 Baloo 2 and Be Vietnam Pro, including VI glyphs, and the V2 wordmark. | **DECISION REQUIRED** for switching `font-heading` to Playfair or adding a legacy graphic mark/heading script. The legacy CSS references `--font-playfair` while its root imports Baloo 2. A script phrase is optional decoration under V2. Brand and asset provenance review applies before importing marks. |
| Interaction | Native link/button semantics, visible focus, labeled preferences, skip link and active route. Existing V2 Dialog for future destructive operations. | **DECISION REQUIRED** for legacy reveal loops, glow or scanning-themed navigation. These affect reduced motion and imply unsupported actions on Home. |
| Artwork | Original labeled synthetic calendar illustration and the existing labeled V2 layout previews. | **DECISION REQUIRED** for actual cover art in the catalog. Product/API authority would need a compatible verified public artwork source and provenance. |

## Review batches

| Batch | Scope and dependency | Main risk and review boundary |
| --- | --- | --- |
| 1 | Home, public shell/navigation, preview strip, Foundation relocation, repository exclusions | Verify state branches, roles, local asset, translations, keyboard and existing journeys. Review before subsequent batches. |
| 2 | Catalog/detail via existing I04 public contract, after Batch 1 | Avoid price/artwork claims absent from the contract. Review search/cursor behavior, unavailable detail and template handoff. |
| 3 | Identity and owner Projects, after Batch 1 and aligned with Batch 2 handoff | Review safe returns, validation, drafts, actor isolation, lifecycle confirms, version conflicts and all 12 Month links. |
| 4 | Media presentation via current I06 intent and delivery | Review retry/readiness and private delivery with synthetic fixtures. I07 attachment stays gated by its own sequence. |
| 5 | Admin Templates screens and transaction feedback | Review permissions, audited reason, revision conflicts, availability and narrow-screen data layouts. |

## Existing risks and gaps

- Legacy hosted artwork and historical pricing are outside the V2 public DTO. I05 hardening evidence raised D01 around staged Project projection and D02 around older creation intents without safe result snapshots. I07-P01 has since added versioned child contracts. Existing reported data/backfill decisions should be resolved against current API authority before any contract expansion.
- `safeReturnTo` currently accepts account and validated project detail destinations. The existing unauthenticated `/media/upload` guard sends the user through the account flow. Batch 1 surfaces upload only after an authenticated session is confirmed. There is no anonymous upload entry or owner-wide media library.
- I07-P02 guided shell and I07-P01 versioned writes are in the baseline. Future media selection and editing require the approved owned-Ready boundary and I07 task sequence. Home directs visitors to the catalog and existing creation flow.

## Batch 1 implementation

| Files | Change |
| --- | --- |
| `frontend/src/app/page.tsx`, `frontend/src/features/product-home/`, `frontend/src/i18n/product.ts` | Product Home route, locale-aware metadata, bilingual hero and creation guide, and a published-design section using `useTemplateList({ limit: 3 })`. Loading, empty and retry states appear beside the stable Catalog links. |
| `frontend/public/calendar-sample.webp` | Local, static synthetic product image, labeled in both languages. Resized to 1080 × 810 and encoded at approximately 96 KB. |
| `frontend/src/design-system/layouts/public-shell*`, `frontend/src/design-system/primitives/{action-link,button,controls.module.css}` | Shared navigation, compact disclosure with keyboard focus return, role-aware destinations, active route and existing theme/language controls. The primary Catalog action uses native link semantics and shared Button styling. |
| `frontend/src/features/templates/{template-card,template-screens,templates.module.css}` | Reused public Template cards and labeled illustration, valid Home heading hierarchy, visible card focus. Catalog query and detail handoff behavior use their existing paths and contracts. |
| `frontend/src/app/foundation/public/page.tsx`, `frontend/src/design-system/layouts/foundation-shell.tsx`, both READMEs | The former public fixture moved from `/` to `/foundation/public`, including the health link. Form and Admin fixtures and their routes remain available. |
| `frontend/e2e/`, `frontend/playwright.config.ts`, targeted component tests | Home responsive/navigation coverage, live catalog assertion, relocated Foundation baseline test paths and route mocks for existing tests that exercise the shared shell. |
| `.gitignore`, `.dockerignore` | Explicit legacy source exclusion for staging and root Docker build context. |

The shared shell shows Home, Templates and My calendars. Guests see login and registration. An authenticated active member also sees private uploads. An authenticated active Admin sees Manage templates. Account logout and server route authorization use the existing identity flows. Publishing states, session and CSRF transport, generated types, project creation/lifecycle and the I07 shell are preserved.

The built-in image generation tool produced the synthetic hero image using the following prompt.

> Use case: product-mockup. Create a photoreal editorial image for the LumiCal homepage, a landscape 4:3 crop. Show one upright small landscape desk photo calendar in a slim natural oak slot stand on cream linen, photographed straight on at a slight three-quarter angle. The ivory calendar has an inset snapshot of a Vietnamese family from behind, walking together on a beach in warm soft daylight, with a restrained small calendar grid below the photo, with no prominent lettering. A spare printed photograph lies on the linen in the lower left, mostly visible. Muted terracotta, walnut and warm paper tones, subtle real texture, soft sunlight and elegant shadows, uncomplicated light neutral background. Center the calendar with margins suitable for a website crop. No logos, watermark, extra text, graphics, interface, AR, phones or overlays. The calendar should read immediately at 300px wide.

## Local screenshot evidence

| View | Desktop | Mobile |
| --- | --- | --- |
| Deployed reference Home | [1440px](../../ui-evidence/reference-1440.png) | [375px](../../ui-evidence/reference-375.png) |
| Verified V2 `dev` before the migration | [1440px](../../ui-evidence/before-1440.png) | [375px](../../ui-evidence/before-375.png) |
| Product Home, EN/Light, synthetic test design response | [1440px](../../ui-evidence/home-en-light-1440.png) | [375px](../../ui-evidence/home-en-light-375.png) |
| Product Home, VI/Dark, synthetic test design response | [1440px](../../ui-evidence/home-vi-dark-1440.png) | [375px](../../ui-evidence/home-vi-dark-375.png) |
| Product Home, real API with disposable PostgreSQL fixtures | [1440px](../../ui-evidence/home-live-1440.png) | — |

The screenshot capture waits for the deployed reference's entry opacity and the local font render. The Product Home images were visually reviewed alongside the source and before screenshots. The browser suite also checks 320px, 600px, 768px, 960px and 1280px. Screenshots and the [binary-capable source diff](../../ui-evidence/batch-1.patch) are local review artifacts outside the feature worktree.

## Validation

Windows, Node 24.21.0 and pnpm 11.22.0. Browser runs used the installed Playwright browsers. Tests with mocked API responses use synthetic fixtures. The live I04 harness used its own NestJS instance and disposable PostgreSQL seeded by the test script.

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm install --offline --frozen-lockfile` | PASS | Installed the locked V2 dependencies in the isolated worktree from the local store. |
| `pnpm --dir frontend typecheck` and `pnpm --dir frontend lint` | PASS | Both exited 0 after the final test edits. |
| `pnpm --dir frontend build` | PASS | Next.js production compilation and route generation, including `/` and `/foundation/public`. |
| `pnpm --dir frontend test src/features/product-home/product-home.test.tsx src/app/page.test.tsx src/features/templates/template-screens.test.tsx` | PASS | 10 focused tests covering preview load/empty/retry and Foundation/Catalog integration. |
| `pnpm --dir frontend test --maxWorkers=1 --testTimeout=20000` | PASS | 179 tests in 23 files, including identity, catalog, projects, media and Studio. The serial run used a larger local timeout after concurrent runs hit the default Windows timing budget. |
| `pnpm --dir backend build` and `pnpm contract:check` | PASS | Reviewed backend OpenAPI matches generated runtime output and frontend types match the reviewed artifact. |
| `pnpm --dir frontend test:e2e e2e/product-home.spec.ts --workers=1 --timeout=90000` | PASS | 21 cases across Chromium, Firefox and WebKit. Seven responsive widths, VI/EN, light/dark, keyboard and `aria-current`, 200% text resize, axe, and guest, owner and Admin navigation. |
| `pnpm --dir frontend test:visual --workers=1 --timeout=90000` | PASS | Four Windows Foundation visual cases, including the relocated public fixture, form/dialog and Admin. Existing snapshot files still match. |
| `pnpm --dir frontend exec playwright test --project=chromium e2e/foundation.spec.ts e2e/project-creation.spec.ts e2e/project-lifecycle.spec.ts e2e/media-upload.spec.ts e2e/studio.spec.ts --workers=1 --timeout=90000` | PASS | 31 Chromium regression cases, including auth template handoff, Foundation controls, twelve-Month keyboard navigation, lifecycle, private media and the guided Studio shell. |
| `node backend/scripts/test-template-admin.mjs` with `LUMICAL_I04_LIVE_UI=1` | PASS for real Home journey and 13 backend groups. FAIL for the existing Admin browser journey. | The new test saw the same-origin `?limit=3` response from NestJS over PostgreSQL and reached the catalog/detail by record ID. The separate Admin test saw “Template created as inactive” and timed out waiting for the detail URL. The harness exited 1 and removed its disposable database. |
| `pnpm --dir frontend test:e2e --workers=2` | FAIL / stopped early | Timeouts occurred in the initial broad parallel run. The scoped serial runs listed above completed. |
| Native browser toolbar zoom and manual screen-reader session | NOT RUN | Browser text resizing to 200%, keyboard actions and axe were executed. |
| `git diff --check` and `git apply --check --whitespace=error .cache/ui-evidence/batch-1.patch` | PASS | The full patch, including untracked files and the WebP, applies to the verified `dev` checkout. The feature index is empty. The legacy path is excluded by Git and Docker and absent from frontend build traces. |

Contract checks used a writable workspace `TEMP`/`TMP` and a temporary Node loader to skip the machine-local Console Ninja injection in installed NestJS. The live run also used that loader. Initial typecheck caught a missing Button ref type and unsupported Playwright role options. Both were corrected before the passing checks. Two Project router mocks now supply `usePathname` for the shared navigation.

## Suggested PR

**Title** `feat(frontend): introduce LumiCal Product Home and shared navigation`

**Description** Introduce a bilingual, themed product homepage based on the legacy split-hero composition. Load up to three published designs through the existing V2 Templates client and reuse its labeled layout cards. Link guests and authenticated users to the routes available to them. Move the public Foundation fixture alongside the form and Admin examples. Exclude the local legacy reference from Git and the Docker build context.

**Review checklist**

- [ ] Confirm the hero sample, hierarchy and VI/EN copy convey the current calendar offering.
- [ ] Check compact keyboard navigation, visible focus, text resizing and preferences on Home and through the Catalog.
- [ ] Verify guest, owner and Admin navigation separately, including the existing template selection and sign-in handoff.
- [ ] Verify the three Foundation routes and the health proof, with baseline screenshot coverage kept on the moved public fixture.
- [ ] Review the app and screenshot evidence with the Design System decisions above. Actual public Template artwork and legacy visual identity are separate review items.
- [ ] Confirm the diff excludes legacy source and generated/private data and preserves the API contract.
