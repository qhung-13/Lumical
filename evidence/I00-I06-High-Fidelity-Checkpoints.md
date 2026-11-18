# LumiCal V2 high-fidelity migration checkpoints

**Date** 2026-11-17. **Branch** `feature/ui-i00-i06-reference-integration` at `9d7a1274ff573c76a954b99748a1aacc15be45f3`, in `.cache/ui-migration`. The original worktree retained `dev`, `lumical.dbml`, and the existing stash. The [earlier audit](I00-I06-UI-Migration.md) is the historical inventory and mapping. This report records the revised implementation. Visual direction is [PENDING LEAD APPROVAL](PROPOSED-Legacy-Visual-Change-Request.md).

## A. Homepage and shared shell

- **Source** `SiteHeader`, `Logo`, `HeroViewfinder`, `SiteFooter`, `DesignSteps`, `FaqAccordion`, and `app/page.tsx`. Ported the warm dark utility strip, brand and preference row, desktop nav and compact disclosure, striped split hero, framed desk-calendar scene, highlights strip, asymmetric showcase, FAQ panel, blush closing action, and pink-rule footer. Links lead into the implemented product flow.
- **V2** `app/page.tsx`, `features/product-home/`, `design-system/layouts/public-shell*`, `design-system/layouts/legacy-brand*`, `features/templates/calendar-mockup*`, and `i18n/product.ts`. The actual published-design query and loading, empty, error, retry, locale, theme, session, and role paths remain in use. The responsive showcase fills its available slot with a single design. Foundation still lives under `/foundation/public`, `/foundation/form`, and `/foundation/admin`.
- **Comparison** The wordmark, dark strip, double header, title emphasis, dark stage, portrait calendar, and section rhythm match the visual reference. The public preview is a static labeled illustration. The lead owns the supplied site branding, and this branch converts its wordmark and inverse logo exports to WebP. The new local hero photo is synthetic and replaces the hosted family video and scanner imagery. Calendar mockups show illustrative paper, layout and dates.
- **Verification** Three focused Home/Foundation tests and 21 three-engine Home browser tests passed at the first checkpoint. The final comparison includes the previous V2, deployed legacy, and the revised Home at all four requested widths.

## B. Catalog and Template Detail

- **Source** `app/tuy-chinh/page.tsx`, `TemplateFilters`, `TemplateProductCard`, `ProductMockup`, `TemplateCover`, and `app/templates/[slug]/page.tsx`. Ported the warm breadcrumb band, filter rail, result bar, card ordering, framed calendar display, and terracotta price/action panel.
- **V2** `features/templates/template-screens.tsx`, `template-card.tsx`, `templates.module.css`, `calendar-mockup*`, and `i18n/templates.ts`. Search, filters, cursor loading and recovery, USD price, published state, and authenticated Template handoff still use the existing API calls and routes.
- **Comparison** V2 layout-category filtering and cursor pagination occupy the legacy rail and results area. V2 supplies two layout types and metadata but no public cover or gallery assets. Detail shows one explicitly labeled preview of the corresponding layout. Gallery thumbnails, legacy sorting, product lines, stock, print, and bundles are outside the current contract.
- **Verification** Seven Catalog/detail component and sixteen transport tests passed. The screenshots use representative published test records with prices from their API responses.

## C. Identity and Calendar Projects

- **Source** `AuthForm`, `app/dang-nhap/page.tsx`, `app/dang-ky/page.tsx`, `app/tai-khoan/page.tsx`, `NewProjectForm`, and the month board in `StudioEditor`. Ported the dark desktop identity panel and centered narrow form, account intro band and Project cards, compact calendar summary beside the create form, and the Month board plus selected-month panel.
- **V2** `features/identity/identity-screen.tsx`, `identity.module.css`, `i18n/identity.ts`, and `features/calendar-projects/{project-workspace,project-detail,projects.module.css}`. The session and return logic, validation, create intent, retry, lifecycle/version checks, keyboard navigation, and twelve-month reads keep their existing contracts. I07 editing continues through its existing Studio route.
- **Comparison** Deployed login, registration, and calendar creation redirected to the legacy Home. The account request timed out. The protected pages were compared to the supplied JSX/CSS, with V2 guest and signed-in fixtures. The account without a chosen Template now offers the Catalog action alongside uploads and sign-out. The unavailable-Template message remains specific to a selected Template that cannot be used.
- **Verification** Four identity and thirteen Project component tests passed. Playwright includes real navigation with API fixtures, create success and retry, lifecycle version conflict, native dialogs, and Month keyboard selection.

## D. Private Media

- **Source** `UploadField` in calendar editing. Ported its compact heading and bordered workspace, dashed file-picker surface, guidance, and progress/status treatments.
- **V2** `features/media/media-upload.tsx` and `media-upload.module.css`. Native chooser, cancellation, upload intent, provider transfer, retries, verification, and privately owned delivery contracts retain their current implementation. The status UI continues to depend on backend `READY`.
- **Comparison** The legacy upload component is embedded in its authenticated editor. V2 shows a standalone page with an owner entry point and a native input. The visual check uses the supplied component and a V2 browser fixture. Legacy file transformations and direct preview URLs are outside the migration.
- **Verification** Thirty-nine media component, session and transport tests passed. The browser suite includes the Pending-to-Ready journey and verifies that the provider URL is absent from rendered output.

## E. Admin Templates

- **Source** `app/admin/layout.tsx`, `AdminNav`, and `TemplateManager`. Ported the fixed-width dark rail, active Templates link, compact operation bar, card-grid rows with distinct inactive styling, and layout preview alongside the revision form when the panel fits it.
- **V2** `features/admin-template/admin-shell.tsx`, `admin-template.module.css`, `template-list-screen.tsx`, `template-new-screen.tsx`, `template-detail-screen.tsx`, and `revision-form.tsx`. List cells retain table roles and headings for assistive technology. The revision form preview uses the selected layout. Role checks, audited reasons, availability, publish confirmation, typed payloads, version handling, and retries use existing code.
- **Comparison** The deployed Admin route redirected to the legacy Home. The visual check uses the source layout and V2 screenshots with an Admin fixture. V2 exposes identifiers, availability, and revision metadata from the real contract. Cover upload and the legacy deletion toggle were omitted.
- **Verification** All eight mocked Admin cases passed in Chromium, Firefox, and WebKit in the initial integration run. They exercise filters, create and publish payloads, 412 recovery, audit reasons, keyboard focus, locale and reflow. The disposable PostgreSQL comparison below tested actual Admin mutations.

## Earlier Admin timeout

The isolated snapshot was exported from `dev` commit `9d7a127` and used the same installed locked dependencies and unchanged backend output. `node backend/scripts/test-template-admin.mjs` ran with `LUMICAL_I04_LIVE_UI=1`, Chromium, and a test-owned NestJS/PostgreSQL fixture. The baseline passed the Admin browser journey and 13 backend groups. The first migrated run stopped in Next.js startup and Playwright could not reach the server. The retry passed the real Home-to-detail journey, the full Admin browser journey, and all 13 backend groups. The prior detail-URL timeout did not recur in either completed run. Both fixture runs cleaned up their test database.

[Baseline log](../../ui-evidence/high-fidelity/admin-dev-baseline.log) · [Startup interruption](../../ui-evidence/high-fidelity/admin-migration.log) · [Migrated retry](../../ui-evidence/high-fidelity/admin-migration-retry.log)

## Visual evidence

[Open the side-by-side screenshot index](../../ui-evidence/high-fidelity/compare.html). Its 192 V2 captures cover twelve surfaces at 1440, 768, 375, and 320 CSS px in VI/EN and light/dark. The index pairs Home, Catalog, and Detail with 48 public legacy captures. Home also includes the previous V2 layout and a [one-design fixture](../../ui-evidence/high-fidelity/after/home-single-vi-light-1440.png). Capture filenames and access results are recorded in the local JSON manifests.

V2 screenshots use synthetic cases for guest, owner and Admin states. The deployed legacy screenshots show its published public content. The actual real-API availability and write behaviors were checked separately with disposable PostgreSQL. The [deployed legacy website](https://lichthietkelumical.com/) supplied the public visual comparison.

## Validation commands

| Command | Result |
| --- | --- |
| `pnpm --dir frontend typecheck` and `pnpm --dir frontend lint` | PASS. |
| `pnpm --dir frontend build` | PASS after retry. Two invocations paused at a Next.js security diagnostic after compilation. Retrying the same command completed production builds. The lockfile matches the baseline. |
| `pnpm --dir frontend test --maxWorkers=1 --testTimeout=20000` | PASS over 179 tests in 23 files. A prior concurrent run hit a Catalog test wait budget. The final serial run passed the assertions without edits to the tests. |
| `pnpm --dir frontend test:e2e --workers=3 --timeout=90000` | PASS over 138 tests across Chromium, Firefox, and WebKit. The initial run exposed 320px Detail overflow and was superseded by the passing full run. |
| `pnpm --dir frontend test:e2e e2e/foundation.spec.ts --grep 'catalog and detail reflow' --workers=3 --timeout=90000` | PASS over all 12 cases after the final adjustment to keep the illustrated stand inside its mobile frame. The refreshed Catalog/Detail screenshots showed the illustration label fully and reported zero overflow or axe violations. |
| `pnpm --dir frontend test:visual --workers=1 --timeout=90000` | PASS over four Windows Foundation visual cases. |
| `pnpm contract:check` | PASS for the generated OpenAPI artifact and frontend types. |
| `node backend/scripts/test-template-admin.mjs` with `LUMICAL_I04_LIVE_UI=1` | PASS for both completed disposable backend runs. The `dev` baseline passed one live browser case. The migrated retry passed two. See the separate timeout investigation above. |
| Manual assistive technology and native toolbar zoom | NOT RUN. The browser suite covered keyboard actions, 200% text resizing and axe. |

The contract and live harness used a local Node loader to suppress the machine's Console Ninja injection in NestJS. The screenshot run checked horizontal reflow and axe at 320px for every standard language and theme combination. The production build used the repository's locked Node dependencies.

`git diff --check` passed, and `git apply --check --whitespace=error` passed for the [source diff](../../ui-evidence/high-fidelity/i00-i06.patch) from the verified `dev` checkout. The legacy folder is excluded from Git and Docker and was absent from Next.js build traces. The feature worktree has an empty Git index. The backend, generated frontend types, I07 implementation, and approved authority documents are identical to the base commit.

## Image provenance

`frontend/public/lumical-legacy-logo.webp` and `frontend/public/lumical-legacy-mark-light.webp` are optimized exports of the supplied first-party logo files. `frontend/public/calendar-family-sample.webp` is a local image generated with the built-in image generation tool for the HeroViewfinder mockup. The tool used the following prompt.

> A candid family snapshot for the inset photograph in a paper calendar on a Vietnamese photo calendar website. Photoreal editorial photography, landscape 4:3. Three generations of a Vietnamese family dressed in warm earth tones sit around a long cream linen-covered wooden table in a leafy garden at golden hour, laughing, waving at the photographer and leaning in, dappled late-afternoon sunlight and dark garden foliage behind them. Mid-distance composition showing the entire family and the table, with extra breathing room at all edges for cropping. Warm natural film tones with dark forest greens. The photograph itself fills the entire image. No calendar, frame, phone, text, logos, or UI.
