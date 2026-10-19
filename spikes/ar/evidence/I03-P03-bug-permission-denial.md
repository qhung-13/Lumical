# Bug report — camera permission denial crashes the page (no user message)

| | |
|---|---|
| **From** | `tranvanduc21092k6-netizen` (MEMBER_4) — I03-P03 |
| **To** | `Tofu501` (MEMBER_3, owner of I03-P02) + LEAD |
| **Date** | 2026-10-19 |
| **Commit tested** | `0654135` (`dev`, includes PR #15 / `939f739`) |
| **Severity** | 🔴 **Blocker** — makes acceptance criterion *"Camera start, denial and exit is tested"* unachievable |
| **Status** | Open — **not** fixed by `939f739` (that commit fixed 4 other findings; this one remains) |

---

## 1. Summary

When the user **denies camera permission**, the page crashes inside `start()`'s
`catch` block. The status line freezes at *Loading the target and starting the
camera…*, **no error message is ever shown**, and **no entry is written to the
evidence log** — so a tester gets zero evidence of the denial.

An end user would see a page that appears to do nothing.

---

## 2. Reproduction (2 commands)

```bash
cd /home/duc/Documents/Lumical-AR-spike/spikes/ar
HOST=0.0.0.0 SPIKE_ENABLE_COMBINED=1 node src/server.mjs
```

Then run the denial probe (Chrome, permission explicitly denied):

```js
const ctx = browser.defaultBrowserContext();
await ctx.overridePermissions('http://127.0.0.1:8787', []);   // [] = DENY
page.goto('http://127.0.0.1:8787/#t=devtokenA123456789');
page.evaluate(() => document.getElementById('start').click());
// → observe status + console
```

**Reproduces on Chrome 155 AND Firefox 158** — it is not browser-specific.

---

## 3. Observed vs expected

| Stage | Observed | Expected |
|---|---|---|
| `navigator.mediaDevices.getUserMedia` | `NotAllowedError: Permission denied` ✅ | `NotAllowedError` — **browser is correct** |
| `MindARThree.start()` (mind-ar 1.2.5) | rejects with **`undefined`** ❌ | reject with the `Error` |
| `client.js:191` | `TypeError: Cannot read properties of undefined (reading 'name')` ❌ | log + show message |
| `#status` after Start | **stuck** at `Loading the target and starting the camera… (the first start can take a few seconds)` | `Camera permission was denied. Use "View without camera" for the same content.` |
| Evidence `<pre>` | **no** `getUserMedia:error` / `ar:error` line | denial must be recorded |
| `#fallback-link` | present, visible, focusable | ✅ OK |

Exact stack trace:

```
TypeError: Cannot read properties of undefined (reading 'name')
    at start (http://127.0.0.1:8787/client.js:191:33)
```

---

## 4. Root cause (isolated)

Three stages, each verified separately:

```
① browser getUserMedia  → NotAllowedError: Permission denied        ✅ correct
② MindAR 1.2.5 start()  → reject(undefined)                         ❌ UPSTREAM BUG
③ client.js:191         → err.name where err === undefined → TypeError ❌ consequence
```

Proof for ② — importing `MindARThree` directly and awaiting `start()` under the
same denied permission:

```json
{
  "gum": "NotAllowedError: Permission denied",
  "hasMindARThree": "function",
  "mindarStart": { "type": "undefined", "isNullish": true, "isErr": false, "string": "undefined" }
}
```

So `await mindar.start()` is the only `await` between line 184 and the `catch`,
and it is what delivers `undefined`.

Because the `catch` body throws at line 191, control never reaches
`setStatus(...)` at line 199 — that is exactly why the status never changes.

**This is pre-existing**, not introduced by `939f739`: the same non-defensive
`log('ar:error', { name: err.name, … })` was at line 153 in the original
`166b7f9`. It was never noticed because every automated run granted permission.

---

## 5. Suggested fix (client-side, fail-safe)

```diff
   } catch (err) {
-    log('ar:error', { name: err.name, message: String(err.message).slice(0, 120) });
+    const name = err?.name ?? 'UnknownError';
+    log('ar:error', { name, message: String(err?.message ?? err).slice(0, 120) });
     await stop(true);
     const text = {
       NotAllowedError: 'Camera permission was denied.',
       NotFoundError: 'No camera was found.',
       UnsupportedError: 'AR is not supported here (needs HTTPS and camera access).',
       PreparationUnavailable: 'The prepared target is unavailable.',
-    }[err.name] ?? 'AR failed to start.';
+    }[name] ?? 'AR failed to start.';
     setStatus(`${text} Use “View without camera” for the same content.`);
-    $('start').disabled = err.name === 'UnsupportedError';
+    $('start').disabled = name === 'UnsupportedError';
   }
```

Also worth adding an explicit guard right after `mindar.start()`:

```js
if (!running) throw Object.assign(new Error('ar start'), { name: 'UnsupportedError' });
```

The `undefined` rejection from mind-ar 1.2.5 should be reported **upstream** as
well; the client guard is what makes the page fail safe regardless of upstream
behaviour.

> Not applied here — `planning/README.md` instructs blocked members not to start
> dependent code. Fix is MEMBER_3's / LEAD's call.

---

## 6. Why this blocks I03-P03

I03-P03 acceptance criteria:

- *"[ ] Camera start, denial and exit is tested."*

  - **start** ✅ measured (§4 of the evidence file)
  - **exit** ✅ measured (`1 created, 0 live`, 0 tracks)
  - **denial** 🔴 **this bug** — cannot be marked done while the page crashes

- *"[ ] Repeatability and unsupported cases have honest outcomes."*

  This report **is** the honest outcome: recorded as a failure rather than
  omitted or rounded up.

---

## 7. Verified-fixed findings from the earlier report (for the record)

The four findings in `BUG-REPORT-camera-display.md` were confirmed fixed by
`939f739` and re-verified on `0654135`:

| # | Finding | Re-verified on `0654135` |
|---|---|---|
| 1 | `#container` missing `z-index` → camera black | ✅ `z-index: 0`, camera renders (100 % coloured pixels) |
| 2 | `"Camera tracks: none yet"` never updated | ✅ `1 created, 1 live` during run, `0 live` after Stop |
| 3 | artifact radio had no listener | ✅ `change` listener + `setArtifactChoiceLocked` |
| 4 | no loading/scanning status | ✅ `Scanning with the per-version A artifact. Point the camera at the target.` |

Plus **5 unit tests currently red on `dev`** (stray short-hash artifact files +
4 README wording tests) — listed in §9a of
`evidence/I03-P03-device-browser-camera-matrix.md`.
