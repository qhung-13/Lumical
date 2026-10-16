# I13-P05 — UI evidence: Admin Order Detail + fulfilment transition dialog

Task: `I13-P05` *Fulfillment and inspection interaction* (Owner MEMBER_4 · Reviewer LEAD · Milestone M4 · P0).
Source prompt: `my-mind-vanduc/STITCH_PROMPTS.md` → **PROMPT 2 (I13-P05)** — personal notes are local-only, this folder is the committed evidence.

Status of this evidence: **design mockup / contract fixture only** (ROADMAP §5 permits contract-fixture preparation before the hard gates). No application code, no `frontend/src/app/admin` route, no API call is added by this change.

## Files

| File | Shows |
| --- | --- |
| `admin-order-detail.html` | Self-contained mockup (tokens inlined, Google Fonts Baloo 2 + Be Vietnam Pro), 3 frames side by side |
| `01-frame-a-order-detail.png` | Frame A — order detail page |
| `02-frame-b-confirm-dialog.png` | Frame B — “Advance to Preparing?” confirmation dialog |
| `03-frame-b-conflict.png` | Frame B′ — expired/conflict state (form content preserved) |
| `admin-orders-demo.html` | Interactive single-file demo: **I13-P04** orders list + **I13-P05** detail/transition dialog, with an EN/VI language switch |
| `demo-01-settings-en.png` | Settings dialog — language picker (English selected) |
| `demo-02-orders-vi.png` | Orders list rendered in Vietnamese (`14 thg 10 2026` date format) |
| `demo-03-conflict-vi.png` | Conflict dialog rendered in Vietnamese (Reason preserved) |

Regenerate screenshots (Chrome headless, then crop the 3 frames from the gallery strip):

```sh
google-chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --screenshot=/tmp/all.png --window-size=4780,1600 --virtual-time-budget=10000 \
  "file://$PWD/admin-order-detail.html"
```

## What the frames demonstrate (ticket scope → UI)

| `I13-P05` scope line | Frame |
| --- | --- |
| Allowed transition controls + purpose-bound inspection | A — detail page, single “Advance to Preparing” action, no mark-paid control |
| Reason input + shared confirmation/focus pattern, **no optimistic completion** | B — required Reason, read-only “Current: Waiting”, buttons say “Advance” |
| Stale-state recovery + expiry feedback, **preserve recoverable UI state** | B′ — conflict banner, Reason text kept, only `[Refresh]` as the recovery action |

Rules referenced (not changed): `BR-FUL-001..003`, `BR-ADM-001/002`, `INV-09`, `API_CONTRACT` §17 (`GET /admin/orders/{id}`, `PUT /admin/orders/{id}/fulfillment` with `If-Match` + `Idempotency-Key`, `POST /admin/orders/{id}/inspection`), `ARCHITECTURE` §18 audit, `DATABASE` §18/§19, `DESIGN_SYSTEM` §3–§4 tokens and §10 component gates.

## Interactive demo (`admin-orders-demo.html`)

A self-contained, dependency-free HTML file (no build step, no `frontend/` import) so a reviewer can **click through** both tickets instead of reading static frames. Same design-system source: `docs/DESIGN_SYSTEM.md` light theme, Baloo 2 + Be Vietnam Pro, focus ring `2px #A43225 / offset 2px`, ≥44×44 targets.

| Part of the demo | Maps to |
| --- | --- |
| Orders **list** screen — AdminShell, PageHeader, toolbar (search + payment/fulfilment/sort filters), operational table, pagination, empty state | `I13-P04` / PROMPT 1 |
| Orders **detail** screen — breadcrumb, Payment/DataList vs Fulfilment stepper + audit history, buyer email only, `[Advance to Preparing]` … spatially separated `[Close order]` | `I13-P05` / Frame A |
| **Advance dialog** — required Reason (inline error when empty), read-only `Current: Waiting`, `[Cancel] [Advance]`, focus trap + `Esc`, background `inert` | Frame B |
| **Conflict state** — banner (icon + word), Reason text preserved, buttons become `[Cancel] [Refresh]` | Frame B′ |
| **Settings dialog** — EN/VI language picker (radio cards, choice persisted in `localStorage`) | i18n demo only; no product requirement |

Interactions to try: `View` → detail · `Advance to Preparing` → dialog · empty Reason → inline error · filled Reason + `Advance` → conflict state · `Esc` / `Cancel` → close. Deep links: `#list`, `#detail`, `#dialog`, `#conflict`, `#settings`; force a language with `?lang=vi` or `?lang=en`.

```sh
google-chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --screenshot=/tmp/demo-vi.png --window-size=1440,1150 --virtual-time-budget=9000 \
  "file://$PWD/admin-orders-demo.html?lang=vi#conflict"
```

Evidence-only: the file is static HTML in `docs/`, so this change adds **no** route, component, dependency or API call to the application, and it does not weaken the `I13-P01 → I13-P02 → I13-P04/P05` hard gates.

## Boundary notes

- **Backend boundary (I13-P01/P02):** the mockup only *illustrates* the responses those tasks must implement. Stepper steps map to `FulfillmentStatus { WAITING_FOR_PAYMENT, PREPARING, DEMO_COMPLETE, STOPPED }`; “Audit history” maps to `fulfillment_events (previous_status, next_status, reason, actor_id, created_at)`; frame B′ is the UI reading of HTTP `412` stale-version.
- **No PII beyond email** on the page (no phone, home address, payment card data) — `BR-ADM-001/002`.
- **No payment-completion toggle, no chart/KPI** anywhere on the screen.
- Two deliberate interpretation calls, recorded for the reviewer:
  1. The prompt’s example audit line (`09:15 · Preparing …`) contradicts its own `Current: Waiting`; values were aligned to the current state while keeping the required `HH:MM · state · reason: … · by …` format.
  2. No step is *completed* in this dataset, so the success-green step treatment exists in CSS but is not rendered; the current step uses brand emphasis + the word label `Current`.
