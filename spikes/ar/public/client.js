// AR spike client. MindAR calls follow its public docs but were NOT executed in the authoring sandbox
// (no network, no camera). The first real run on a phone is the test; adjust only this file if the API differs.
import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';
import { createRevealGuard, runGuardedReveal } from './reveal-guard.js';
import { classifyStartFailure } from './start-failure.js';
import { releaseARResources } from './lifecycle.js';

const KEY = 'spike.token';
const $ = (id) => document.getElementById(id);
const hash = new URLSearchParams(location.hash.slice(1)).get('t');
if (hash) {
  sessionStorage.setItem(KEY, hash);
  history.replaceState(null, '', location.pathname); // fragment exchanged once and removed
}
const token = sessionStorage.getItem(KEY);

// ---- evidence ---------------------------------------------------------------------------------
const evidence = { startedAt: new Date().toISOString(), events: [], origins: new Set() };
const tracks = [];
const t0 = performance.now();
function log(kind, detail = {}) {
  const e = { t: Math.round(performance.now() - t0), kind, ...detail };
  evidence.events.push(e);
  $('log').textContent += `${e.t}ms ${kind} ${Object.keys(detail).length ? JSON.stringify(detail) : ''}\n`;
}
function updateCameraSummary() {
  const live = tracks.filter((t) => t.readyState === 'live').length;
  const videos = [...document.querySelectorAll('video')].filter((v) => v.srcObject).length;
  $('camera-summary').textContent = `Camera tracks: ${tracks.length} created, ${live} live; video elements with a stream: ${videos}`;
  return { created: tracks.length, live, videosWithStream: videos };
}
document.addEventListener('securitypolicyviolation', (e) => log('csp:violation', { directive: e.violatedDirective, blocked: e.blockedURI }));
new PerformanceObserver((list) => {
  for (const r of list.getEntries()) {
    try {
      const u = new URL(r.name);
      if (u.protocol.startsWith('http') && u.origin !== location.origin) {
        evidence.origins.add(u.origin);
        log('network:off-origin', { origin: u.origin });
      }
    } catch { /* ignore */ }
  }
}).observe({ type: 'resource', buffered: true });

// The last error our getUserMedia wrapper saw. MindAR rejects start() with `undefined` on denial, so this is often the only
// place the real cause (NotAllowedError, NotFoundError...) is still visible.
let lastGetUserMediaError = null;

async function queryCameraPermission() {
  try { return (await navigator.permissions?.query({ name: 'camera' }))?.state ?? 'unknown'; } catch { return 'unknown'; }
}

const md = navigator.mediaDevices;
if (md?.getUserMedia) {
  const orig = md.getUserMedia.bind(md);
  md.getUserMedia = async (constraints) => {
    log('getUserMedia:request');
    try {
      const stream = await orig(constraints);
      for (const t of stream.getTracks()) {
        tracks.push(t);
        t.addEventListener('ended', () => { log('track:ended', { kind: t.kind }); updateCameraSummary(); });
        log('track:created', { kind: t.kind, readyState: t.readyState });
        updateCameraSummary();
      }
      return stream;
    } catch (err) {
      lastGetUserMediaError = err;
      log('getUserMedia:error', { name: err?.name });
      throw err;
    }
  };
}

// ---- session ----------------------------------------------------------------------------------
const auth = () => ({ Authorization: `Bearer ${token}` });
let session = null;
let running = null; // { mindar, renderer, blobUrl }

function setStatus(msg) {
  $('status').textContent = msg;
  log('status', { msg });
}

async function loadSession() {
  if (!token) return setStatus('No session link. Open the link printed by the server.');
  const res = await fetch('/api/spike/session', { headers: auth(), cache: 'no-store' });
  if (!res.ok) return setStatus('Session not available.');
  session = await res.json();
  if (session.combined) $('artifact-choice').hidden = false;
  setStatus(`Session scope ${session.scopeLabel}. Per-version artifact: ${session.version.status}.`);
  $('start').disabled = false;
}

function chosen() {
  const useCombined = session.combined && document.querySelector('input[name=artifact]:checked')?.value === 'combined';
  return useCombined ? session.combined : session.version;
}
const artifactLabel = (art) => {
  const base = art === session.combined ? 'combined A+B (test-only)' : `per-version ${session.scopeLabel}`;
  // Never present an artifact whose origin could not be proven as if it were verified.
  return art.provenance === 'manual-unverified' ? `${base}, manual-unverified` : base;
};
// The artifact is fixed when AR starts. Lock the choice while running so a late change cannot be mistaken for a test of it.
const setArtifactChoiceLocked = (locked) => document.querySelectorAll('input[name=artifact]').forEach((r) => { r.disabled = locked; });
document.querySelectorAll('input[name=artifact]').forEach((r) => r.addEventListener('change', () => {
  if (running) return;
  setStatus(`Artifact selected: ${artifactLabel(chosen())}. Press Start AR to use it.`);
}));

function renderReveal(c) {
  const box = $('reveal');
  box.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = c.title;
  const img = document.createElement('img');
  img.src = c.image.dataUri;
  img.alt = c.image.alt;
  const p = document.createElement('p');
  p.textContent = c.message; // text only, never markup
  box.append(h, img, p);
  box.hidden = false;
}

const revealGuard = createRevealGuard();

// A reveal response may arrive after the target was lost or AR stopped; the guard turns such a response into a no-op.
function onFound(index, artifactId) {
  log('target:found', { index });
  return runGuardedReveal(
    revealGuard,
    {
      fetchReveal: (signal) =>
        fetch('/api/spike/reveal', {
          method: 'POST',
          headers: { ...auth(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ artifactId, targetIndex: index }),
          cache: 'no-store',
          signal,
        }),
    },
    {
      onOk(c) {
        log('reveal:ok', { versionLabel: c.versionLabel, index });
        renderReveal(c);
        setStatus('Target recognized and revealed.');
      },
      onDenied(status) {
        log('reveal:denied', { status, index });
        $('reveal').hidden = true;
        setStatus('This target has nothing to show in this session.');
      },
      onStale(why) {
        log('reveal:stale-ignored', { index, why });
      },
      onError(err) {
        log('reveal:error', { name: err?.name });
        $('reveal').hidden = true;
        setStatus('The reveal request failed. Use “View without camera” for the same content.');
      },
    },
  );
}

async function start() {
  if (running) return;
  revealGuard.invalidate();
  lastGetUserMediaError = null;
  $('start').disabled = true;
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error('unsupported'), { name: 'UnsupportedError' });
    }
    const art = chosen();
    if (!art?.artifactId || art.status !== 'READY') throw Object.assign(new Error('prep'), { name: 'PreparationUnavailable' });
    setStatus(`Fetching prepared target (${artifactLabel(art)})…`);
    const res = await fetch(`/api/spike/artifacts/${encodeURIComponent(art.artifactId)}`, { headers: auth(), cache: 'no-store' });
    if (!res.ok) throw Object.assign(new Error('prep'), { name: 'PreparationUnavailable' });
    const blobUrl = URL.createObjectURL(await res.blob()); // MindAR cannot send our auth header itself
    const mindar = new MindARThree({ container: $('container'), imageTargetSrc: blobUrl, uiLoading: 'no', uiScanning: 'no', uiError: 'no' });
    const { renderer, scene, camera } = mindar;
    running = { mindar, renderer, blobUrl };
    for (let i = 0; i < art.targetCount; i++) {
      const anchor = mindar.addAnchor(i);
      anchor.onTargetFound = () => onFound(i, art.artifactId);
      anchor.onTargetLost = () => {
        revealGuard.invalidate();
        log('target:lost', { index: i });
        $('reveal').hidden = true;
        if (running) setStatus('Target lost. Scanning…');
      };
    }
    setStatus('Loading the target and starting the camera… (the first start can take a few seconds)');
    setArtifactChoiceLocked(true);
    await mindar.start();
    renderer.setAnimationLoop(() => renderer.render(scene, camera));
    $('stop').disabled = false;
    setStatus(`Scanning with the ${artifactLabel(art)} artifact. Point the camera at the target.`);
    log('ar:started', { artifactId: art.artifactId, shortId: art.shortId, provenance: art.provenance, targetCount: art.targetCount, artifact: artifactLabel(art) });
    updateCameraSummary();
  } catch (err) {
    // `err` may be undefined (MindAR 1.2.5 on denial); never dereference it directly.
    const failure = classifyStartFailure({ error: err, lastGetUserMediaError, cameraPermission: await queryCameraPermission() });
    log('ar:error', { name: failure.name, source: failure.source, rejectedWith: failure.rejectedWith, message: String(err?.message ?? '').slice(0, 120) });
    await stop(true);
    setStatus(`${failure.text} Use “View without camera” for the same content.`);
    $('start').disabled = failure.disableStart;
  }
}

async function stop(silent = false) {
  revealGuard.invalidate();
  const r = running;
  running = null;
  const cleanupFailures = await releaseARResources(r, tracks);
  for (const failure of cleanupFailures) log('ar:stop-error', failure);
  if (r) {
    $('container').replaceChildren();
    $('reveal').hidden = true;
  }
  $('stop').disabled = true;
  $('start').disabled = !session;
  setArtifactChoiceLocked(false);
  await new Promise((ok) => setTimeout(ok, 300));
  const summary = updateCameraSummary();
  log('ar:stopped', summary);
  if (!silent) setStatus(summary.live === 0 ? 'AR stopped. No live camera tracks.' : 'AR stopped but a camera track is still live!');
}

$('start').addEventListener('click', start);
$('stop').addEventListener('click', () => stop(false));
$('copy').addEventListener('click', async () => {
  const payload = {
    ...evidence,
    origins: [...evidence.origins],
    userAgent: navigator.userAgent,
    platform: navigator.userAgentData?.platform ?? navigator.platform,
    secureContext: window.isSecureContext,
    camera: updateCameraSummary(),
    threeRevision: THREE.REVISION,
    note: 'Network proof still needs a DevTools/remote-inspector capture; this is a supplement.',
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setStatus('Evidence copied.');
  } catch {
    $('log').textContent += '\n' + JSON.stringify(payload, null, 2);
  }
});
loadSession().catch(() => setStatus('Session not available.'));
