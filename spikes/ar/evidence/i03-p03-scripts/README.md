# I03-P03 — reproduction scripts

Evidence for **I03-P03 — Device, browser and camera feasibility matrix** is in
[`../I03-P03-device-browser-camera-matrix.md`](../I03-P03-device-browser-camera-matrix.md).
These are the scripts that produced it, committed so the numbers can be re-run
instead of taken on trust.

> They drive a **desktop** browser with a fake camera. They are **not** a
> substitute for the phone run required by *Real mobile HTTPS/camera tests*.

## Start the server first

```bash
cd ../../          # spikes/ar
npm ci --ignore-scripts
HOST=0.0.0.0 SPIKE_ENABLE_COMBINED=1 node src/server.mjs     # :8787
```

## What each script does

| Script | Evidence section | What it measures |
| --- | --- | --- |
| `p03-stop-diag.mjs` | §4 | camera **exit / track cleanup** — the ticket's review focus |
| `p03-permission.mjs` | §5 | camera start when granted, and behaviour when **denied** |
| `p03-denial-stack.mjs` | §5 | captures the exact stack trace of the denial crash |
| `p03-mindar-reject.mjs` | §5 | isolates whether MindAR or the client rejects wrongly |
| `p03-a11y.mjs` | §7 | accessibility of start / exit / fallback (18 checks) |
| `p03-firefox.mjs` | §3, §10 | same lifecycle on Firefox |
| `p03-firefox-deny.mjs` | §5 | Firefox permission-denial behaviour |
| `make-always.mjs` | §6b | builds a fake-camera video where the target never leaves frame |
| `p03-trials.mjs` | §6b | repeat recognition rate, 5 independent trials per target |
| `make-y4m.mjs` | §6a | builds the appear/disappear video (3 s / 3 s / 3 s) |
| `p03-repeat.mjs` | §6a | counts `target:found` / `target:lost` / `reveal:ok` over 40 s |
| `p03-video-diag.mjs` | §6 | samples the camera frame to confirm what the tracker actually sees |

## Typical run

```bash
node make-always.mjs /path/to/version-a.png /tmp/a-always.y4m
DISPLAY=:0 node p03-trials.mjs
DISPLAY=:0 node p03-permission.mjs
DISPLAY=:0 node p03-a11y.mjs
```

`DISPLAY=:0` is needed because headless Chrome renders the camera canvas in
black — measured: `canvasPixels 0.0 %` headless vs `100.0 %` on the real GPU.
Driving them headless would silently produce false negatives.

## Known method pitfalls (recorded so they are not repeated)

1. **`puppeteer page.click('#stop')` hangs** while `evaluate(click)` returns in
   1 ms. The evidence `<pre>` prepends lines continuously, so the button never
   satisfies puppeteer's "stable for two frames" check. This is a **harness**
   artefact, not a product hang — cleanup is verified by DOM click + track counts.
2. **A down-scaled fake camera changes the answer.** Target B scored `0/5` at
   512×512 and `3/5` at its native 1024×1024 with everything else identical.
   Reporting `version B fails` from the 512 px run would have been a false
   finding against someone else's artifact.
3. **`p.click` on the artifact radio before `Start` is mandatory** — the choice
   is read once inside `start()`.
4. **System Firefox is a snap** and refuses to be driven
   (`Firefox is already running, but is not responding`). Use a puppeteer-managed
   build: `npx @puppeteer/browsers install firefox@stable`.

## Temporary / not committed

Target PNGs (`version-a.png`, `version-b.png`, `unknown.png`) and the generated
`*.y4m` files are inputs, not repository content — regenerate them from the
fixtures rather than committing multi-megabyte video.
