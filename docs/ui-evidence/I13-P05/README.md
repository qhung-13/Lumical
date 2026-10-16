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

## Boundary notes

- **Backend boundary (I13-P01/P02):** the mockup only *illustrates* the responses those tasks must implement. Stepper steps map to `FulfillmentStatus { WAITING_FOR_PAYMENT, PREPARING, DEMO_COMPLETE, STOPPED }`; “Audit history” maps to `fulfillment_events (previous_status, next_status, reason, actor_id, created_at)`; frame B′ is the UI reading of HTTP `412` stale-version.
- **No PII beyond email** on the page (no phone, home address, payment card data) — `BR-ADM-001/002`.
- **No payment-completion toggle, no chart/KPI** anywhere on the screen.
- Two deliberate interpretation calls, recorded for the reviewer:
  1. The prompt’s example audit line (`09:15 · Preparing …`) contradicts its own `Current: Waiting`; values were aligned to the current state while keeping the required `HH:MM · state · reason: … · by …` format.
  2. No step is *completed* in this dataset, so the success-green step treatment exists in CSS but is not rendered; the current step uses brand emphasis + the word label `Current`.
