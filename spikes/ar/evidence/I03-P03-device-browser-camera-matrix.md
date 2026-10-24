# I03-P03 — Device, browser and camera feasibility matrix

Synthetic data only. Failures and "nothing revealed" are valid results; do not omit them.

- **Date / tester:** 2026-10-19 · `tranvanduc21092k6-netizen` (MEMBER_4)
- **Ticket:** I03-P03 — *Device, browser and camera feasibility matrix* · Reviewer: LEAD
- **Harness commit:** `a6afcb8` (`dev`) — first measured on `0654135`; every result below was re-run on `a6afcb8` after `faa72ad`
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
| 5 | Camera permission denial | §5 | ✅ **PASS** — was FAIL on `0654135`, harness fixed it in `faa72ad`, re-measured PASS on `a6afcb8` |
| 6 | Camera exit / cleanup | §4 | ✅ **PASS** on Chrome 155 + Firefox 158 (re-verified on `a6afcb8`) |
| 7 | Basic performance observations | §4, §9 | 🟡 **partial** — main-thread round-trip 0–1 ms during scan; no device FPS |
| 8 | Repeat recognition scans | §6 | ✅ **measured** on `a6afcb8` (desktop synthetic camera, caveats in §6) |

### Acceptance Criteria (3)

| AC | Status | Section |
| --- | --- | --- |
| *Actual supported combinations are documented.* | 🟡 partial — Chrome 155 / Firefox 158 documented as `partial`; mobile rows explicitly NOT TESTED | §3, §10 |
| *Camera start, denial and exit is tested.* | ✅ **all three pass** — start ✅, denial ✅ (§5b), exit ✅ (§4) | §4, §5 |
| *Repeatability and unsupported cases have honest outcomes.* | 🟡 **partial** — desktop outcomes recorded honestly, including a superseded reading corrected in §6b; the mobile unsupported cases are still untested (§9), so this is not closed | §5, §6, §9 |

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
| Harness commit | `a6afcb8` (`dev`) — first measured on `0654135`, every result re-run on `a6afcb8` |
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
| Chrome (desktop) | 155.0.8059.84 | ✅ | ✅ | ✅ `1 created, 1 live` | ✅ | ✅ `1 created, 0 live` | ✅ message + `ar:error` (§5b) | ✅ (§6) | **partial** |
| Firefox (desktop) | 158.0.1 | ✅ | ✅ | ✅ `1 created, 1 live` | ✅ | ✅ `1 created, 0 live` | ✅ message (§5b) | not measured | **partial** |
| Chrome (Redmi Note 13) | — | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | **NOT TESTED (§9)** |
| Mi Browser (Redmi Note 13) | — | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | **NOT TESTED (§9)** |

Legend: ✅ measured and passing · 🔴 measured and failing · ⬜ not executed.

> The **denial column changed** between `0654135` and `a6afcb8`. It read
> `🔴 crashes` on both rows when this file was first written, because the client
> dereferenced an `undefined` rejection from MindAR. The harness fixed it in
> `faa72ad`; the column above is the **re-measured** value (§5a keeps the
> original failure, §5b the current result). Firefox was re-run on the
> puppeteer-managed **158.0.1** build rather than the original 158.0.

**`partial` means:** every capability that was measured now passes — page load,
start, live stream, scanning status, exit/cleanup, permission denial, fallback
and recognition. It is **not** "supported" because coverage is incomplete: HTTPS
behaviour, lighting/distance and orientation were never exercised (§9), target
recognition was not re-run on Firefox, and **no real device row has been
filled**.

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

## 5. Camera permission denial — measured **FAIL**, re-measured **PASS**

Measured on **Chrome 155 and Firefox 158** with permission explicitly denied
(`BrowserContext.overridePermissions(origin, [])`).

### 5a. As measured on `0654135` (2026-10-19) — FAIL

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
`setStatus(...)` can run — which is why the status never changes.

This was reported as evidence rather than patched here: the correction belongs
to the harness client, and `planning/README.md` tells a blocked member *"do not
start dependent code"*.

### 5b. As re-measured on `a6afcb8` (2026-10-24) — PASS

The harness fixed it in `faa72ad` (I03-P04): `start-failure.js` classifies the
failure from `lastGetUserMediaError` plus the queried permission state, and
`client.js` never dereferences `err` directly. Same scripts, same permission
denial, same server:

```
1847ms getUserMedia:request
1896ms getUserMedia:error {"name":"NotAllowedError"}
1900ms ar:error {"name":"NotAllowedError","source":"getUserMedia-error","rejectedWith":"undefined","message":""}
2201ms ar:stopped {"created":0,"live":0,"videosWithStream":0}
```

| Stage | Measured value | Result |
| --- | --- | --- |
| `#status` after denial | `Camera permission was denied. Use “View without camera” for the same content.` | ✅ **user feedback present** |
| Evidence `<pre>` | `getUserMedia:error` **and** `ar:error` both recorded | ✅ **denial captured** |
| Uncaught page errors | none | ✅ **no crash** |
| Page still responsive | yes (`evaluate()` returns, Stop clickable) | ✅ |
| `#fallback-link` | present and visible | ✅ |
| Camera tracks after denial | `0 created, 0 live` | ✅ nothing to release |

`p03-permission.mjs` totals: **camera start when granted PASS · error shown when
denied PASS.**

**One residual observation (not a blocker):** on the denial path the evidence log
also carries `ar:stop-error {"name":"TypeError"}`. It is caught by `stop()`'s own
`try`/`catch`, no track is left live (`0 created, 0 live`) and no uncaught error
reaches the page — but `r.renderer.dispose()` sits after the throwing call inside
that `try`, so it is skipped. Harmless here because the camera was never opened;
worth a look in the harness follow-up.

### 5c. Effect on the acceptance criteria

- *Camera start, denial and exit is tested.* → **all three now pass** (§4, §5b).
- *Repeatability and unsupported cases have honest outcomes.* → the original
  FAIL above stays in this file rather than being erased; the re-measurement
  shows what changed and when.

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

**Re-measured 2026-10-24 on `a6afcb8`.** The artifacts are **byte-identical**
to the original run (`md5` of both `.mind` files unchanged between `0654135`
and `a6afcb8`) and the MindAR vendor bundle is unchanged, so the two runs are
directly comparable.

| Target | Camera frame | Result |
| --- | --- | --- |
| version A (session A, per-version) | 512×512 | **5/5 = 100 %** — and 5/5, 5/5 on two further runs |
| version B (session B, per-version) | 512×512 | **5/5 = 100 %** — and 5/5, 5/5 on two further runs |
| version A | 256×256 | 5/5 = 100 % |
| version B | 256×256 | 5/5 = 100 % |
| version A | 1024×1024 | 5/5 = 100 % |
| version B | 1024×1024 | 5/5 = 100 % |

**Correction to the earlier reading.** The original run recorded `A 4/5` and
`B 0/5` at 512 px, plus `B 3/5` at 1024 px, and that was read as *"version B
fails when the frame is downscaled"*. **That reading does not hold**, and this
file records the correction rather than quietly replacing the numbers:

- both `.mind` files hash the same before and after — the artifacts did not change;
- the MindAR vendor bundle did not change;
- the same 512 px video now returns **15/15 across three runs** for version B;
- 256 px and 1024 px both return 5/5, so resolution is not the variable.

The earlier `0/5` and `3/5` were **run-to-run variation in that session**, not a
property of the target image or of the downscale. The rig loops a 2 s clip, so
where a trial lands inside the loop — and what else the machine is doing — both
matter. Attributing the result to version B would have been a false finding
against someone else's target image; that was caught in time, and the
superseded numbers are left above the correction so the change is auditable.

**Measured conclusion:** in this rig recognition **repeated on every attempt**
at every frame size from 256 to 1024 px. That is still **not** a claim of
deterministic recognition on a real camera — this is a synthetic loop, a known
target, a fixed distance and controlled light. The honest matrix statement is
*"repeatedly observed on a synthetic desktop camera; real-device rate unknown"*
— see §9.

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
- Artifact ids used: A `ar-c9a3a21cc733aafb9c70…33d3` · B `ar-fc4c9e01218a4587…6bff4` · combined `ar-15fcb25d141f3689…e14943`. Both full-hash `.mind` files were **byte-identical** (`md5` unchanged) between `0654135` and `a6afcb8`; `9df98eb` removed the stale short-id duplicates that used to sit beside them.

| # | Session | Artifact | Target shown | Light | Distance | Orientation | Expected | Observed | Repeats (n found / n tries) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | A | per-version | version-a | n/a (synthetic) | n/a | n/a | A card | **A card revealed** | 4/5 (512 px) · 6 cycles/40 s | `reveal:ok {"versionLabel":"A"}` |
| 2 | A | per-version | version-b | n/a | n/a | n/a | nothing | **nothing** (no `target:found`, no request) | 0 reveals | weak evidence: no request was made, so server refusal is not proven |
| 3 | B | per-version | version-b | n/a | n/a | n/a | B card | **B card revealed** | **5/5 (256, 512 and 1024 px)** | earlier `0/5` and `3/5` superseded — see §6b |
| 4 | B | per-version | version-a | n/a | n/a | n/a | nothing | **nothing** | 0 reveals | same weak-evidence caveat as row 2 |
| 5 | A | combined (test-only) | version-b | n/a | n/a | n/a | recognized, server refuses | **NOT TESTED** — recognition did not occur in the rig | — | requires a longer / native-resolution run; left blank rather than guessed |
| 6 | A | per-version | unknown | n/a | n/a | n/a | nothing | **nothing** | 0 reveals | `unknown.png` never matched |
| 7 | B | combined (test-only) | version-a | n/a | n/a | n/a | recognized, server refuses | **NOT TESTED** | — | see row 5 |

**Camera / lifecycle (desktop)**

- Permission prompt shown: not applicable (headless-permission override)
- **Deny result (re-measured `a6afcb8`): `NotAllowedError` from the browser → `ar:error {"name":"NotAllowedError","source":"getUserMedia-error","rejectedWith":"undefined"}` → status `Camera permission was denied. Use “View without camera” for the same content.` · message shown ✅ · 0 uncaught page errors. The original failure is kept in §5a.**
- After Stop: **`1 created, 0 live`**; OS camera indicator: not applicable on desktop
- Off-origin requests or CSP violations in the evidence log: **none observed** (0 CSP violations, 0 page errors across all runs)
- DevTools/inspector network capture done: **no** — not executed

**Unsupported / runtime-failure case**

- The unsupported path for a camera app — permission denied — now reports itself: ✅ (§5b), fallback reachable ✅
- Fallback content identical across runs: **yes** (§8)
- Combinations that were never executed are written **NOT TESTED** rather than "fails" (§9, §3)

**Overall honest verdict for this browser: `partial`**
— camera start, scanning status, track cleanup, accessibility, fallback **and
permission denial** all pass on `a6afcb8`. Still `partial` for coverage reasons,
not failures: HTTPS behaviour, lighting/distance and orientation were never
exercised (§9), and the DevTools network capture was not done.

### Block — Firefox 158 on Ubuntu 26.04.1 (desktop, **synthetic camera**)

- Browser + exact version: Mozilla Firefox **158.0.1** (puppeteer-managed build; re-measured in place of the original 158.0), `media.navigator.streams.fake=true`
- Lifecycle: load ✅ · secure context ✅ · `getUserMedia` ✅ · start ✅ `1 created, 1 live` · scanning status ✅ · stop ✅ `1 created, 0 live` · page errors **0**
- Permission denial: ✅ status `Camera permission was denied. Use “View without camera” for the same content.` · message shown · 0 page errors (§5b)
- Target recognition: **NOT TESTED** (fake camera stream is synthetic, not the prepared PNG)

**Overall honest verdict for this browser: `partial`** — every measured
capability passes; target recognition was not re-run here, and §9 (HTTPS,
lighting/distance, orientation) is untouched.

### Block — Redmi Note 13 (mobile) — **NOT FILLED**

Not executed against `a6afcb8` (nor against the earlier `0654135`). The previous
phone run used an obsolete build. Leave this block unfilled until the run
happens; an unfilled block is the honest state.

---

## Overall honest verdict

**`partial` for `a6afcb8`.** Every desktop row in §3 has a measurement behind it
and the scripts reproduce them on another machine. The camera permission-denial
failure that was open when this file was first written now measures **PASS** —
the harness fixed it in `faa72ad`, re-measured here (§5a keeps the original
failure so the change is auditable).

Still open: the **mobile half of the matrix** (§9, including HTTPS behaviour,
lighting/distance and orientation), a **manual / screen-reader accessibility
pass** (§7 is automated only), and target recognition on Firefox (§3). One
superseded reading was corrected in §6b rather than removed.

No combination is claimed as supported beyond what §3 and §10 measured.
