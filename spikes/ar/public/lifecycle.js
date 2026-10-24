// MindAR stop can fail after a partial start. One failed cleanup step must not prevent the others.
export async function releaseARResources(running, tracks) {
  const failures = [];
  const attempt = async (step, action) => {
    try { await action(); } catch (error) { failures.push({ step, name: error?.name ?? typeof error }); }
  };
  if (running) {
    await attempt('animation', () => running.renderer.setAnimationLoop(null));
    await attempt('provider', () => running.mindar.stop());
    await attempt('renderer', () => running.renderer.dispose());
    await attempt('artifact-url', () => URL.revokeObjectURL(running.blobUrl));
  }
  for (const track of tracks) {
    if (track.readyState !== 'ended') await attempt('camera-track', () => track.stop());
  }
  return failures;
}
