import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseARResources } from '../public/lifecycle.js';

test('a provider stop rejection after partial start cannot skip renderer disposal or track release', async () => {
  const steps = [];
  const track = { readyState: 'live', stop() { this.readyState = 'ended'; steps.push('track'); } };
  const running = {
    renderer: { setAnimationLoop(value) { assert.equal(value, null); steps.push('animation'); }, dispose() { steps.push('dispose'); } },
    mindar: { stop() { throw undefined; } }, blobUrl: 'blob:synthetic',
  };
  const failures = await releaseARResources(running, [track]);
  assert.deepEqual(steps, ['animation', 'dispose', 'track']);
  assert.deepEqual(failures, [{ step: 'provider', name: 'undefined' }]);
  assert.equal(track.readyState, 'ended');
});

test('animation and track failures do not prevent the remaining cleanup attempts', async () => {
  let stopped = false, disposed = false, secondTrackStopped = false;
  const failures = await releaseARResources({
    renderer: { setAnimationLoop() { throw null; }, dispose() { disposed = true; } },
    mindar: { async stop() { stopped = true; } }, blobUrl: 'blob:synthetic',
  }, [{ readyState: 'live', stop() { throw new Error('track failed'); } }, { readyState: 'live', stop() { secondTrackStopped = true; } }]);
  assert.ok(stopped && disposed && secondTrackStopped);
  assert.deepEqual(failures.map(f => f.step), ['animation', 'camera-track']);
});

test('tracks acquired before running was assigned are released, and ended tracks are left alone', async () => {
  let released = 0;
  await releaseARResources(null, [
    { readyState: 'live', stop() { released++; } },
    { readyState: 'ended', stop() { throw new Error('must not stop an ended track'); } },
  ]);
  assert.equal(released, 1);
});
