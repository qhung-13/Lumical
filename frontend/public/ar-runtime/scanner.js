// Isolated browser realm: removal releases the entire GPU/worker runtime. No frame transport.
// The pinned image Controller runs genuine MindAR matching; Compiler is never instantiated.
import { Controller } from './vendor/mindar-image.prod.js';
const video = document.querySelector('video');
let controller, stream, closed = false, started = false, found = false;
const send = (type, extra = {}) => parent.postMessage({ scope: 'lumical-owner-ar', type, ...extra }, location.origin);
function stop() {
  if (closed) return;
  closed = true;
  // Try every release even if one fails; surface teardown failures, never silently swallow them.
  const errors = [];
  const release = action => { try { action(); } catch (error) { errors.push(error); } };
  release(() => controller?.stopProcessVideo());
  release(() => stream?.getTracks().forEach(track => release(() => track.stop())));
  release(() => video.pause());
  release(() => { video.srcObject = null; });
  release(() => controller?.dispose());
  release(() => controller?.worker?.terminate());
  if (errors.length) throw new AggregateError(errors, 'Scanner teardown failed');
}
function fail(error) {
  if (closed) return;
  try {
    send('error', { kind: error?.name === 'NotAllowedError' ? 'denied' : error?.name === 'NotSupportedError' ? 'unsupported' : 'failed' });
  } finally { stop(); }
}
// MindAR processVideo() returns void and launches a detached async loop. This iframe
// contains only the scanner runtime, so its uncaught failures belong to this session.
function runtimeFailure(event) {
  if (!started || closed) return;
  event.preventDefault();
  fail(event.reason ?? event.error);
}
addEventListener('error', runtimeFailure);
addEventListener('unhandledrejection', runtimeFailure);
addEventListener('pagehide', stop);
addEventListener('message', async event => {
  if (event.source !== parent || event.origin !== location.origin || event.data?.scope !== 'lumical-owner-ar') return;
  if (event.data.type === 'stop') { stop(); return; }
  if (event.data.type !== 'start' || started || closed || typeof event.data.url !== 'string' || !event.data.url.startsWith(`blob:${location.origin}/`)) return;
  document.documentElement.lang = event.data.locale === 'vi' ? 'vi' : 'en';
  video.setAttribute('aria-label', event.data.camera);
  started = true;
  try {
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw { name: 'NotSupportedError' };
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment' } });
    if (closed) { stream.getTracks().forEach(track => track.stop()); return; }
    const metadata = new Promise(resolve => video.addEventListener('loadedmetadata', resolve, { once: true }));
    video.srcObject = stream; await metadata;
    if (closed) return;
    const width = video.videoWidth, height = video.videoHeight;
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) throw new Error('Invalid camera dimensions');
    // The pinned InputLoader uses element dimensions for drawImage/rotation, not videoWidth.
    video.width = width; video.height = height;
    await video.play();
    if (closed) return;
    controller = new Controller({ inputWidth: width, inputHeight: height, maxTrack: 1,
      onUpdate: update => {
        if (closed || update.type !== 'updateMatrix') return;
        if (update.targetIndex !== 0) { send('invalid'); return; }
        if (update.worldMatrix && !found) { found = true; send('found', { index: update.targetIndex }); }
        if (!update.worldMatrix && found) { found = false; send('lost'); }
      } });
    // Keep MindAR's onmessage handler intact (matchDone/trackUpdateDone); native
    // worker failures otherwise leave its awaited matching promises pending forever.
    controller.worker.addEventListener('error', runtimeFailure);
    controller.worker.addEventListener('messageerror', runtimeFailure);
    const result = await controller.addImageTargets(event.data.url);
    if (closed) return;
    if (result.dimensions.length !== 1) throw new Error('Not a designated single target');
    await controller.dummyRun(video);
    if (closed) return;
    controller.processVideo(video); send('scanning');
  } catch (error) {
    // An error after closure can be a teardown exception; leave it observable.
    if (closed) throw error;
    fail(error);
  }
});
send('ready');
