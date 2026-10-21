# I03-P03 — reproduction scripts

Evidence for **I03-P03 — Device, browser and camera feasibility matrix** is in
[`../I03-P03-device-browser-camera-matrix.md`](../I03-P03-device-browser-camera-matrix.md).
These are the scripts that produced it, committed so the numbers can be re-run
instead of taken on trust.

> They drive a **desktop** browser with a fake camera. They are **not** a
> substitute for the phone run required by *Real mobile HTTPS/camera tests*.

## Setup (copy-paste)

```bash
# 1. dependencies for these scripts only (this folder is self-contained)
cd spikes/ar/evidence/i03-p03-scripts
npm ci

# 2. start the spike server with FIXED tokens, so the scripts can log in
cd ../../
npm ci --ignore-scripts
SPIKE_TOKEN_A=devtokenA123456789 \
SPIKE_TOKEN_B=devtokenB123456789 \
HOST=0.0.0.0 SPIKE_ENABLE_COMBINED=1 \
node src/server.mjs                                  # :8787

# 3. run a script (from the scripts folder)
cd evidence/i03-p03-scripts
DISPLAY=:0 node p03-stop-diag.mjs
```

Without `SPIKE_TOKEN_A` / `SPIKE_TOKEN_B` the server mints a random token on
every start and prints it on boot — the scripts would then log in with the
wrong one and report `Session not available`.

## Configuration (`env.mjs`)

No script contains a machine-specific path, an absolute home directory or a
hard-coded browser location. All of it lives in
[`env.mjs`](env.mjs) and is read from the environment:

| Variable | Default | Meaning |
| --- | --- | --- |
| `SPIKE_ORIGIN` | `http://127.0.0.1:8787` | URL of the running spike server |
| `SPIKE_TOKEN_A` / `SPIKE_TOKEN_B` | `devtokenA…` / `devtokenB…` | session tokens; **must match the server's** |
| `CHROME_PATH` | auto-detected | Chrome/Chromium binary. Auto-detects `/usr/bin/google-chrome`, `/usr/bin/chromium`, the macOS app bundle and the Windows install |
| `FIREFOX_PATH` | *(unset)* | Firefox binary. Unset → puppeteer uses the build it manages itself |
| `P03_TARGETS` | *(unset)* | directory holding `version-a.png` / `version-b.png` / unknown.png |
| `P03_SCRATCH` | `$TMPDIR/i03-p03` | writable directory for generated `.y4m` videos and browser profiles |

Firefox only:

```bash
npx @puppeteer/browsers install firefox@stable   # puppeteer picks it up when FIREFOX_PATH is unset
```

## What each script does

| Script | Evidence section | What it measures |
| --- | --- | --- |
| `env.mjs` | — | shared configuration (see above) |
| `p03-stop-diag.mjs` | §4 | camera **exit / track cleanup** — the ticket's review focus |
| `p03-permission.mjs` | §5 | camera start when granted, and behaviour when **denied** |
| `p03-denial-stack.mjs` | §5 | captures the exact stack trace of the denial crash |
| `p03-mindar-reject.mjs` | §5 | isolates whether MindAR or the client rejects wrongly |
| `p03-a11y.mjs` | §7 | **automated** accessibility + keyboard interaction (18 checks) |
| `p03-firefox.mjs` | §3, §10 | same lifecycle on Firefox |
| `p03-firefox-deny.mjs` | §5 | Firefox permission-denial behaviour |
| `make-always.mjs` | §6b | builds a fake-camera video where the target never leaves frame |
| `p03-trials.mjs` | §6b | repeat recognition rate, 5 independent trials per target |
| `make-y4m.mjs` | §6a | builds the appear/disappear video (3 s / 3 s / 3 s) |
| `p03-repeat.mjs` | §6a | counts `target:found` / `target:lost` / `reveal:ok` over 40 s |
| `p03-video-diag.mjs` | §6 | samples the camera frame to confirm what the tracker actually sees |

## Typical run

```bash
# fake-camera inputs (need P03_TARGETS)
P03_TARGETS=/path/to/targets node make-y4m.mjs      # appear → disappear → reappear
P03_TARGETS=/path/to/targets node make-always.mjs /path/to/version-a.png

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
   build (see Configuration above).
5. **The UI's evidence element is `#log`, not `#evidence`**, and the camera-free
   link is `#fallback-link`, not `#fallback`. Querying the wrong id returns
   `null` silently and looks like "no evidence was recorded".

## Temporary / not committed

`node_modules/` (install with `npm ci`), target PNGs (`version-a.png`,
`version-b.png`, `unknown.png`) and the generated `*.y4m` files are inputs, not
repository content — regenerate them rather than committing megabytes.
