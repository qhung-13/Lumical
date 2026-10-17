# I03-P04 device observations (fill from real runs; copy one block per device class)

Do not pre-fill. Failures and surprises are results. Do not paste tokens, session links or personal data; replace the
fragment after `#t=` with `<redacted>`. This sheet complements `P02-device-run-template.md` (same device and run).

## Run header

- Date:
- Device / OS / browser (exact versions):
- Harness commit / deployment URL (https):
- Inspector used (Chrome `chrome://inspect`, Safari Web Inspector, desktop DevTools):
- Tester:

## A. Network trace during one full scan (open the inspector BEFORE pressing Start)

Record every request from page load to Stop. Group identical requests.

| # | Method | Origin | Path | Size | Initiator | Expected? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | GET | same | `/` | | | yes |
| 2 | GET | same | `/client.js`, `/styles.css` | | | yes |
| 3 | GET | same | `/vendor/three.module.js`, `/vendor/mindar/*` | | | yes |
| 4 | GET | same | `/api/spike/session` | | | yes |
| 5 | GET | same | `/api/spike/artifacts/<id>` | | | yes |
| 6 | POST | same | `/api/spike/reveal` (request body only `artifactId`, `targetIndex`) | | | yes |
| 7 | any | **other origin** | | | | **no: report** |
| 8 | any | same | anything else (WebSocket, beacon, image, `.wasm`, model files) | | | **no: report** |

- Total requests after Start that are not in rows 1-6:
- Any request whose body is larger than a few hundred bytes (possible frame data)? yes / no (if yes, describe):
- Off-origin origins listed by the page's own log / evidence JSON (`origins`):
- CSP violations reported by the page (`csp:violation` events):

## B. Storage and persistence after the scan

Inspect Application / Storage panels after Stop.

| Store | Entries created by the run | Notes |
| --- | --- | --- |
| `sessionStorage` | expect 1 (`spike.token`) | |
| `localStorage` | expect none | |
| IndexedDB | expect none | |
| Cache Storage / service workers | expect none | |
| Cookies | expect none | |

## C. Frame access

- Does the page (or the library) request canvas readback, capture streams or media recording that you can see in the inspector? (Performance/Sources breakpoints are optional.) yes / no / not checked:
- Camera tracks after Stop (page status or evidence JSON): live count =
- OS camera indicator off after Stop: yes / no

## D. Wrong target, denied and unsupported (privacy view)

| Case | What was shown | Anything private or unrelated visible? | Log lines to quote |
| --- | --- | --- | --- |
| Session A, scan `version-b.png` (per-version artifact) | | | |
| Session A, scan `unknown.png` | | | |
| Session A, combined artifact, scan `version-b.png` (recognized, server must refuse) | | | |
| Session B, scan `version-a.png` | | | |
| No token / invalid token | | | |
| Camera permission denied | | | |
| Unsupported browser or insecure context | | | |

## E. Camera-free page readability

| Check | Result |
| --- | --- |
| Image visible with alt text read by the screen reader (VoiceOver / TalkBack / NVDA) | |
| Message read in the expected order after the title | |
| Browser zoom / text size 200%: no clipped or overlapping text | |
| Portrait and landscape both readable | |
| Contrast in bright light acceptable (subjective note) | |
| Same title, image and message as the AR reveal for that session | |

## F. Overall honest verdict for this device

- Anything that contradicts the static review in `I03-P04-privacy-fallback-port-review.md` section 3?
- Open questions for LEAD:
