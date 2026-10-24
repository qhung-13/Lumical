# LumiCal frontend

See the [root README](../README.md) for pinned tools, environment files, Docker,
identity setup and the shared quality gate. Frontend data access remains typed
backend HTTP; no database or provider-secret access belongs here.

`src/design-system/` implements the required I00 slice of the approved
[Design System](../docs/DESIGN_SYSTEM.md): semantic tokens, essential controls,
FormField, native modal Dialog, presentation preferences and public/Admin shells.
Components consume the registry once; feature styles must not redefine colors.
Baloo 2 and Be Vietnam Pro are self-hosted, with Vietnamese subsets. Decorative
Dancing Script and the rest of the component inventory are unnecessary for this slice.
Fontsource's weight entry points retain Unicode ranges, so unused script/weight
subsets are not downloaded simply because both languages are supported.

The neutral examples are `/`, `/foundation/form` and `/foundation/admin`. The
Admin composition describes UI examples only and grants no permissions. The form
changes temporary component state, never business or persisted data. Existing
register/login/account behavior stays owned by I02.

Language and theme use only the enum cookies `lumical_locale` and `lumical_theme`.
Root HTML renders these preferences on the server. CSS `light-dark()` consumes a
single approved color mapping; `color-scheme: light dark` follows OS appearance
for System without a hydration-time theme replacement. Never store credentials,
private queries or user content in this preference boundary.

From the repository root:

```sh
pnpm dev:frontend
pnpm --dir frontend test
pnpm --dir frontend test:watch
pnpm --dir frontend exec playwright install --with-deps chromium firefox webkit
pnpm build
pnpm test:ui
pnpm test:visual
```

Component tests use Vitest, Testing Library and user-event. Their JSDOM Dialog
shim covers component events only; Playwright verifies native modal focus and
background blocking in Chromium, Firefox and WebKit. The UI suite runs on a
production frontend at reserved loopback port 3210 and fails if that port is in
use. It stubs only browser anonymous session bootstrap as a presentation fixture;
I02 PostgreSQL and Compose checks separately prove actual authentication.

UI acceptance covers VI/EN, both themes, live OS-theme changes, no-JavaScript
initial presentation, 320/375/600/768/960/1280/1440px reflow, 200% text resizing,
keyboard/focus/cancellation, real rendered contrast and axe. This is not a claim
of assistive-technology certification, physical-device testing or browser-toolbar
zoom. Remaining manual evidence and task statuses live in the I00 planning file.

Visual snapshots are Chromium/Windows baselines at 320 and 1280px, including open
Dialogs, both languages and both themes. Compare on Windows using `pnpm test:visual`;
the dedicated CI job pins `windows-2025`. OS updates can still affect rasterization;
the hosted comparison must pass before merge. To propose a deliberate visual
change, capture with `pnpm test:visual --update-snapshots`, inspect every affected
image and have the reviewer approve it against the authority. Never regenerate
baselines simply to hide a failing comparison. Reports/traces are ignored local
artifacts; the reviewed baseline PNGs in `e2e/__screenshots__/win32/` are intentional
source artifacts to include in the foundation commit.

CI uses `playwright install --only-shell` for Chromium because these projects run
headless; Firefox/WebKit and Linux system dependencies remain installed. Local
setup above also installs headed Chromium for optional interactive debugging.

Playwright/axe use Apache-2.0/MPL-2.0 respectively; user-event is MIT. Fontsource
font packages use OFL-1.1. These additions supply the testing baseline and approved
font files explicitly required by Frontend Standards and Testing Strategy;
no UI framework or additional business dependency was introduced.
