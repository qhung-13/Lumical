# I03-P03 — Device, browser and camera feasibility matrix

Synthetic data only. Failures and "nothing revealed" are valid results; do not omit them.

- **Date / tester:** 2026-10-19 · `tranvanduc21092k6-netizen` (MEMBER_4)
- **Ticket:** I03-P03 — *Device, browser and camera feasibility matrix* · Reviewer: LEAD
- **Harness commit:** `0654135` (`dev`, after PR #15 / `939f739` camera fixes and PR #14)
- **Branch:** `feature/I03-P03-device-camera-matrix`
- **Purpose (ticket):** *Make supported-device claims evidence-based.*

> **Scope boundary.** This file records what was actually executed. Every row is
> either **measured** (a number or an exact page message is given) or explicitly
> marked **NOT TESTED**. No combination is claimed as supported on the basis of
> desktop results alone — the ticket's *Implementation notes* forbid inferring
> viability from desktop only.

---

## Coverage against the ticket (start here)

### Purpose — *"Make supported-device claims evidence-based."*

Claimed combinations below are each tied to a measurement or marked **NOT
TESTED**. Nothing is upgraded to "supported" without a result behind it.

### Scope (8 items)

| # | Scope item | Where | Status |
| --- | --- | --- | --- |
| 1 | Real device / OS / browser versions | §2, §3 | 🟡 **partial** — 2 desktop browsers measured; **no real device on this commit** |
| 2 | HTTPS camera behavior | §9 | ⬜ **NOT TESTED** — localhost is a secure context, so no HTTPS/tunnel run happened here |
| 3 | Lighting and distance | §9 | ⬜ **NOT TESTED** — synthetic camera has no lighting/distance |
| 4 | Orientation | §9 | ⬜ **NOT TESTED** — synthetic camera has no orientation |
| 5 | Camera permission denial | §5 | ✅ **tested — FAILS** (blocker, root cause isolated in §5) |
| 6 | Camera exit / cleanup | §4 | ✅ **PASS** on Chrome 155 + Firefox 158 |
| 7 | Basic performance observations | §4, §9 | 🟡 **partial** — main-thread round-trip 0–1 ms during scan; no device FPS |
| 8 | Repeat recognition scans | §6 | ✅ **measured** (desktop synthetic camera, caveats in §6) |

### Acceptance Criteria (3)

| AC | Status | Section |
| --- | --- | --- |
| *Actual supported combinations are documented.* | 🟡 partial — Chrome 155 / Firefox 158 documented as `partial`; mobile rows explicitly NOT TESTED | §3, §10 |
| *Camera start, denial and exit is tested.* | 🟡 tested; **denial FAILS** | §4, §5 |
| *Repeatability and unsupported cases have honest outcomes.* | 🟡 **partial** — desktop outcomes recorded honestly (§5, §6); the mobile unsupported cases are still untested (§9), so this is not closed | §5, §6, §9 |

### Tests / Evidence (2 required)

| Required | Status | Section |
| --- | --- | --- |
| *Real mobile HTTPS/camera tests* | ⬜ **NOT DONE** — the remaining work for this ticket | §9 |
| *Manual accessibility checks for start, exit and fallback* | 🟡 **partial** — executed as **automated** DOM + keyboard interaction checks, **18 / 18 pass**; no manual or screen-reader pass yet | §7, §8 |

### Out of scope — not claimed anywhere in this file

- *Production hosting rollout* — no deployment was performed.
- *Universal browser/device support claims* — no row says "works on X" without a
  measurement; untested combinations are written **NOT TESTED**.

### Review focus — *"Real device evidence and correct camera-track cleanup"*

- **Camera-track cleanup:** ✅ measured end to end in §4 (`1 created, 1 live` →
  Stop → `1 created, 0 live`, 0 tracks) on two browsers.
- **Real device evidence:** ⬜ **not available yet** — §9 and the unfilled
  mobile block in §10 state this plainly rather than substituting desktop
  results.

---

## 1. How to reproduce (harness steps)

```bash
# 1. start the spike server (isolated folder, not in pnpm-workspace.yaml)
cd /home/duc/Documents/Lumical-AR-spike/spikes/ar
npm ci --ignore-scripts
HOST=0.0.0.0 SPIKE_ENABLE_COMBINED=1 node src/server.mjs        # :8787

# 2. the evidence scripts — see evidence/i03-p03-scripts/README.md
DISPLAY=:0 node evidence/i03-p03-scripts/p03-permission.mjs   # camera start + permission denial
DISPLAY=:0 node evidence/i03-p03-scripts/p03-stop-diag.mjs    # camera exit / track cleanup
DISPLAY=:0 node evidence/i03-p03-scripts/p03-a11y.mjs         # accessibility of start / exit / fallback
node evidence/i03-p03-scripts/p03-firefox.mjs                 # same lifecycle on Firefox
DISPLAY=:0 node evidence/i03-p03-scripts/p03-trials.mjs       # repeat recognition trials
```

**Camera-feed rig (§6 only).** Recognition is driven by feeding a prepared PNG as
Chrome's fake camera source, so that "repeat scan" can be counted without a phone:

```bash
node evidence/i03-p03-scripts/make-always.mjs <target.png> /tmp/a-always.y4m
google-chrome --use-fake-device-for-media-stream \
              --use-file-for-fake-video-capture=/tmp/a-always.y4m
```

Method pitfalls discovered while building this rig (stable-element hang,
resolution-dependent results, snap Firefox, stale artifact ids) are recorded in
[`evidence/i03-p03-scripts/README.md`](i03-p03-scripts/README.md) so the next
tester does not repeat them.

This rig is a **desktop approximation**, not device evidence. Its numbers are
labelled as such in §6 and must not be quoted as phone results.

---

## 2. Environment actually tested

| Item | Value |
| --- | --- |
| OS | Ubuntu 26.04.1 LTS · x86_64 |
| CPU/GPU | x86_64 · NVIDIA RTX 4060 Laptop (Mesa/Vulkan NVK AD107) |
| Node.js | v24.21.0 (engines: `>=22.2`) |
| Desktop browser 1 | Google Chrome **155.0.8059.84** |
| Desktop browser 2 | Mozilla Firefox **158.0** (puppeteer-managed build; system Firefox is a snap and cannot be driven) |
| Mobile device | **Redmi Note 13 · Android · HyperOS · Chrome** — **NOT RE-TESTED on this commit** (§9) |
| mind-ar | 1.2.5 |
| three | 0.160.0 |
| @tensorflow/tfjs | 4.22.0 |
| pngjs | 7.0.0 |
| Install | `npm ci --ignore-scripts` · 0 vulnerabilities |
| Isolation | not in `pnpm-workspace.yaml`; touches neither `frontend/` nor `backend/` nor `docs/` |

---

## 3. Browser × capability matrix (measured)

| Browser | Version | Page loads | Start enabled | Camera stream live | Scanning status shown | Stop → 0 live tracks | Permission denial | Target recognition | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chrome (desktop) | 155.0.8059.84 | ✅ | ✅ | ✅ `1 created, 1 live` | ✅ | ✅ `1 created, 0 live` | 🔴 **crashes** (§5) | ✅ (§6) | **partial** |
| Firefox (desktop) | 158.0 | ✅ | ✅ | ✅ `1 created, 1 live` | ✅ | ✅ `1 created, 0 live` | 🔴 **crashes** (§5) | not measured | **partial** |
| Chrome (Redmi Note 13) | — | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | **NOT TESTED (§9)** |
| Mi Browser (Redmi Note 13) | — | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | **NOT TESTED (§9)** |

Legend: ✅ measured and passing · 🔴 measured and failing · ⬜ not executed.

**`partial` means:** camera start, scanning, exit/cleanup and fallback work, but
the permission-denial path is broken, so that combination cannot be reported as
fully supported.

---

## 4. Camera lifecycle — start / exit / cleanup (Review focus)

The ticket's *Review focus* is **real device evidence and correct camera-track
cleanup**. Cleanup was measured on both desktop browsers:

| Step | Measured observation | Result |
| --- | --- | --- |
| Start | `track:created {"kind":"video","readyState":"live"}` | ✅ |
| Start | `#camera-summary` = `Camera tracks: 1 created, 1 live; video elements with a stream: 1` | ✅ |
| Start | status = `Scanning with the per-version A artifact. Point the camera at the target.` | ✅ |
| **Stop** | status = `AR stopped. No live camera tracks.` | ✅ |
| **Stop** | `#camera-summary` = `Camera tracks: 1 created, 0 live; video elements with a stream: 0` | ✅ |
| **Stop** | video element: `{tracks:0, live:0, readyState:"n/a"}` | ✅ |
| Stop (Firefox) | identical status + `0 live` | ✅ |
| Main-thread responsiveness during scan | `evaluate()` round-trip **0–1 ms** (not blocked) | ✅ |

**Verdict: camera-track cleanup PASS on Chrome 155 and Firefox 158.**

> **Testing note (method, not a product defect).** Puppeteer's `page.click('#stop')`
> hangs here, while `element.click()` via `page.evaluate()` returns in 1 ms.
> The cause is the harness: the evidence `<pre>` prepends log lines continuously,
> so the Stop button's bounding box never satisfies puppeteer's two-frame
> "stable element" check. Cleanup itself is verified by direct DOM click and by
> the track counts above. Recorded so the next tester does not misread it as a
> hang.

---

## 5. Camera permission denial — **FAIL (blocker)**

Measured on **Chrome 155 and Firefox 158** with permission explicitly denied
(`BrowserContext.overridePermissions(origin, [])`).

| Stage | Measured value | Expected | Result |
| --- | --- | --- | --- |
| `navigator.mediaDevices.getUserMedia` | `NotAllowedError: Permission denied` | `NotAllowedError` | ✅ browser behaves correctly |
| `MindARThree.start()` (mind-ar 1.2.5) | rejects with **`undefined`** | rejects with the `Error` | 🔴 **upstream bug** |
| `client.js:191` `err.name` | `TypeError: Cannot read properties of undefined (reading 'name')` | log the error | 🔴 **crash** |
| `#status` afterwards | stuck at `Loading the target and starting the camera… (the first start can take a few seconds)` | `Camera permission was denied. Use "View without camera" for the same content.` | 🔴 **no user feedback** |
| Evidence `<pre>` | no `getUserMedia:error` / `ar:error` entry recorded | denial recorded | 🔴 **no evidence captured** |
| `#fallback-link` `View without camera` | present, visible, focusable, `href=/fallback` | reachable | ✅ |

**Root cause, isolated step by step:**

```
browser getUserMedia  → NotAllowedError: Permission denied        ✅ correct
MindAR 1.2.5 start()  → reject(undefined)                          ❌ upstream
client.js:191         → err.name where err === undefined → TypeError ❌ consequence
```

Verified by importing `MindARThree` directly and awaiting `start()` under the same
denied permission: the rejection value is `undefined` (`type:"undefined"`,
`isNullish:true`, `isErr:false`). The client code at line 191 (line 153 in the
original `166b7f9`) is not defensive, so the `catch` block throws before
`setStatus(...)` at line 199 can run — which is why the status never changes.

**Impact on this ticket's acceptance criteria:**

- *"[ ] Camera start, denial and exit is tested."* → **denial outcome is a FAIL**,
  not a pass: the tester and an end user both get no message.
- *"[ ] Repeatability and unsupported cases have honest outcomes."* → this IS the
  honest outcome; it is recorded here rather than hidden.

**Not fixed here.** The correction belongs to I03-P02's client code, and
`planning/README.md` tells a blocked member *"do not start dependent code"* —
so this is recorded as evidence, not patched from this ticket.

---

## 6. Repeat recognition scans (scope: *repeat recognition scans*)

### 6a. Cycling rig — target appears / disappears (Chrome 155)

Video: target visible 3 s → absent 3 s → visible 3 s, looping, observed 40 s.

| Metric | Value |
| --- | --- |
| `target:found` | **6** |
| `target:lost` | **5** |
| `reveal:ok` | **6** (always `versionLabel:"A"`) |
| `reveal:denied` | **0** |
| JS errors | **0** |
| Missed present-windows | **0 observed** (detections tracked the video phase) |

Status transitions observed verbatim: `Target recognized and revealed.` →
`Target lost. Scanning…` → `Target recognized and revealed.` (repeated).

### 6b. Per-trial rate — target always in frame, 12 s per trial, 5 independent trials

| Target | Camera frame | Result | Honest reading |
| --- | --- | --- | --- |
| version A (session A, per-version) | 512×512 | **4/5 = 80%** | detects, not guaranteed |
| version B (session B, per-version) | 512×512 | **0/5 = 0%** | see note |
| version B (session B, per-version) | **1024×1024 (native)** | **3/5 = 60%** | detects at native size |

**Note on the 0/5 result — it is a rig artefact, not an artifact defect.** The
only variable changed between 0/5 and 3/5 was the frame size fed to the fake
camera; the same `version-b.png`, same artifact and same session produced
`reveal:ok` + card `Synthetic version B` when the frame was not downscaled.
Reporting `version B fails` from the 512 px run would have been a false finding,
so the native-resolution run is the one that counts.

**Measured conclusion:** recognition is **probabilistic, not deterministic**, and
degrades at lower camera resolution; version B is more sensitive than version A
in this rig. An honest statement for the matrix is therefore *"recognition
repeatedly observed, rate varies with camera resolution"* — **not** *"reliably
recognizes"*.

> These are **desktop fake-camera numbers**. They do **not** satisfy
> *Real mobile HTTPS/camera tests*; see §9.

---

## 7. Accessibility — *automated DOM + keyboard interaction checks*

**These are automated, not manual.** `p03-a11y.mjs` drives Puppeteer over the
DOM and keyboard (Chrome 155): **18 / 18 pass.**

> The ticket's required test is *"manual accessibility checks for start, exit
> and fallback"*. What is recorded here is machine-verified structure and
> keyboard behaviour — **not** a manual pass and **not** a screen-reader pass.
> That is why the Tests row above stays `partial` rather than `done`.

| Check | Observed |
| --- | --- |
| `<html lang>` | `en` |
| `#status` semantics | `role="status"` + `aria-live="polite"` |
| `#reveal` live region | `aria-live="polite"` |
| camera region labelled | `#container` `aria-label="Camera view"` |
| evidence log keyboard-reachable | `#log` `tabindex="0"` |
| radio inputs have `<label>` | both `true` |
| buttons declare `type` | `["button","button","button"]` |
| fallback link text | `View without camera` (describes purpose, no camera jargon) |
| document title | `LumiCal AR spike (I03-P02)` |
| Tab order reaches Start | `input[radio] → button#start` |
| focus indicator visible | `outline: auto 1px` |
| Enter activates Start | status changed to `Scanning with the per-version A artifact…` |
| state change announced | via `aria-live=polite` |
| Stop enabled while running | yes |
| fallback link focusable + visible | yes |
| `#reveal` hidden until content exists | `hidden: true` |
| artifact fieldset hidden when unavailable | (`artifact-choice` toggles by session) |

---

## 8. Fallback (camera-free) — *fallback content*

| Check | Observed | Result |
| --- | --- | --- |
| `GET /fallback` | HTTP 200, title `Camera-free view (I03-P02)` | ✅ |
| camera API used by fallback page | `getUserMedia` / `mediaDevices` occurrences in `/fallback` + `/fallback.js`: **0** | ✅ |
| `GET /api/spike/content` (session A) | `{"title":"Synthetic version A", …, alt:"Synthetic teal card with the letter A"}` | ✅ |
| `GET /api/spike/content` (session B) | `{"title":"Synthetic version B", …}` | ✅ |
| no token | HTTP **404** | ✅ fail-closed |
| wrong token | HTTP **404** | ✅ fail-closed |

---

## 9. What is NOT covered here (must be done on the real device)

The ticket requires *Real mobile HTTPS/camera tests*. **None of the following
were executed on a phone for this commit**, so no claim is made about them:

| Item | Status | Why |
| --- | --- | --- |
| Redmi Note 13 + Android + Chrome — full 7-case table (light / distance / orientation) | ⬜ **NOT TESTED** | phone run pending |
| Mi Browser on Redmi Note 13 | ⬜ **NOT TESTED** | known to restrict camera; not attempted |
| HTTPS via tunnel → camera permission prompt on device | ⬜ **NOT TESTED** | phone run pending |
| OS camera indicator off after Stop | ⬜ **NOT TESTED** | desktop has no OS indicator |
| Device performance / frame observations | ⬜ **NOT TESTED** | needs device |
| DevTools/inspector network capture confirming no frame-like payloads leave the device | ⬜ **NOT TESTED** | needs a device or remote inspector |
| Previous phone run (pre-fix build) | ⏱ **superseded** | Case 1 passed on the old build (HTTPS + camera + MindAR + version-bound reveal), but camera display was black — that build is obsolete after `939f739` |

---

## 10. Filled device blocks

### Block — Chrome 155 on Ubuntu 26.04.1 (desktop, **synthetic camera**)

- Date / tester: 2026-10-19 · MEMBER_4
- Device model / OS version: x86_64 workstation · Ubuntu 26.04.1 LTS
- Browser + exact version: Google Chrome 155.0.8059.84
- HTTPS host used: **not used** — `http://127.0.0.1:8787` (localhost is a secure context)
- mind-ar / three versions: `mind-ar@1.2.5` · `three@0.160.0`
- Artifact ids used: A `ar-c9a3a21cc733aafb9c70…33d3` · B `ar-fc4c9e01218a4587…6bff4` · combined `ar-15fcb25d141f3689…e14943`, manifest commit `0654135`

| # | Session | Artifact | Target shown | Light | Distance | Orientation | Expected | Observed | Repeats (n found / n tries) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | A | per-version | version-a | n/a (synthetic) | n/a | n/a | A card | **A card revealed** | 4/5 (512 px) · 6 cycles/40 s | `reveal:ok {"versionLabel":"A"}` |
| 2 | A | per-version | version-b | n/a | n/a | n/a | nothing | **nothing** (no `target:found`, no request) | 0 reveals | weak evidence: no request was made, so server refusal is not proven |
| 3 | B | per-version | version-b | n/a | n/a | n/a | B card | **B card revealed** | 3/5 (1024 px) · 0/5 (512 px) | resolution-sensitive |
| 4 | B | per-version | version-a | n/a | n/a | n/a | nothing | **nothing** | 0 reveals | same weak-evidence caveat as row 2 |
| 5 | A | combined (test-only) | version-b | n/a | n/a | n/a | recognized, server refuses | **NOT TESTED** — recognition did not occur in the rig | — | requires a longer / native-resolution run; left blank rather than guessed |
| 6 | A | per-version | unknown | n/a | n/a | n/a | nothing | **nothing** | 0 reveals | `unknown.png` never matched |
| 7 | B | combined (test-only) | version-a | n/a | n/a | n/a | recognized, server refuses | **NOT TESTED** | — | see row 5 |

**Camera / lifecycle (desktop)**

- Permission prompt shown: not applicable (headless-permission override)
- **Deny result: `NotAllowedError` produced by the browser, then `client.js:191` TypeError; status stuck at `Loading the target and starting the camera…`; no message, no evidence entry (§5)**
- After Stop: **`1 created, 0 live`**; OS camera indicator: not applicable on desktop
- Off-origin requests or CSP violations in the evidence log: **none observed** (0 CSP violations, 0 page errors across all runs)
- DevTools/inspector network capture done: **no** — not executed

**Unsupported-device / runtime-failure case**

- Firefox 158 denied-permission outcome identical to Chrome: **yes** (same TypeError, same stuck status)
- fallback content identical: **yes** (§8)

**Preparation**

- Re-compile of version A byte-identical: **MATCH**
- Artifact unavailable / fault injection: covered by the behavioural suite — `UNAVAILABLE` → HTTP 503 `{"code":"UNAVAILABLE"}`, camera-free content still HTTP 200, server stays healthy; restore → `READY`, sha256 matches manifest *(measured on the pre-merge harness commit; re-run on `0654135` is pending — §9)*

**Overall honest verdict for this browser: `partial`**
— camera start, scanning status, track cleanup, accessibility and fallback all
pass; **permission denial fails**, so Chrome 155 cannot be listed as fully supported.

### Block — Firefox 158 on Ubuntu 26.04.1 (desktop, **synthetic camera**)

- Browser + exact version: Mozilla Firefox 158.0 (puppeteer build), `media.navigator.streams.fake=true`
- Lifecycle: load ✅ · secure context ✅ · `getUserMedia` ✅ · start ✅ `1 created, 1 live` · scanning status ✅ · stop ✅ `1 created, 0 live` · page errors **0**
- Permission denial: 🔴 same `err is undefined` TypeError, no user message (§5)
- Target recognition: **NOT TESTED** (fake camera stream is synthetic, not the prepared PNG)

**Overall honest verdict for this browser: `partial`** (same reason as Chrome: denial broken).

### Block — Redmi Note 13 (mobile) — **NOT FILLED**

Not executed against commit `0654135`. The previous phone run used an obsolete
build. Leave this block unfilled until the run happens; an unfilled block is the
honest state.

---

## Overall honest verdict

**`partial` for this commit.** Every desktop row in §3 has a measurement behind
it and the scripts reproduce them on another machine. Still open: the **mobile
half of the matrix** (§9), the **camera permission denial failure** (§5), and a
**manual / screen-reader accessibility pass** (§7 is automated only). No
combination is claimed as supported beyond what §3 and §10 measured.
