// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Execute the shipped scanner, not a duplicated implementation. The fake Controller
// and synthetic browser error events test lifecycle contracts, NOT real recognition.
const source = readFileSync(new URL('../../../public/ar-runtime/scanner.js', import.meta.url), 'utf8')
  .replace(/^import \{ Controller \} from .*;$/m, '');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function events() {
  const listeners = new Map<string, { callback: (event: Record<string, unknown> & { preventDefault: () => void }) => unknown; once?: boolean }[]>();
  return {
    addEventListener(type: string, callback: (event: Record<string, unknown> & { preventDefault: () => void }) => unknown, options?: { once?: boolean }) {
      listeners.set(type, [...(listeners.get(type) ?? []), { callback, once: options?.once }]);
    },
    emit(type: string, extra: Record<string, unknown> = {}) {
      const event = { preventDefault: vi.fn(), ...extra };
      const results = (listeners.get(type) ?? []).map(listener => {
        if (listener.once) listeners.set(type, listeners.get(type)!.filter(item => item !== listener));
        return listener.callback(event);
      });
      return { event, results };
    },
  };
}

function harness(options: { width?: number; height?: number; permissionPending?: boolean; targetsPending?: boolean; teardownThrows?: boolean } = {}) {
  const global = events();
  const permission = deferred<unknown>();
  const targets = deferred<{ dimensions: number[][] }>();
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  const stream = { getTracks: () => tracks };
  const videoEvents = events();
  let attached: unknown;
  const video = {
    ...videoEvents,
    videoWidth: options.width ?? 1280, videoHeight: options.height ?? 720,
    width: 0, height: 0,
    setAttribute: vi.fn(), pause: vi.fn(), play: vi.fn(async () => undefined),
    get srcObject() { return attached; },
    set srcObject(value) {
      attached = value;
      if (value) queueMicrotask(() => videoEvents.emit('loadedmetadata'));
    },
  };
  const snapshots: { stage: string; width: number; height: number; inputWidth?: number; inputHeight?: number }[] = [];
  const snapshot = (stage: string) => snapshots.push({ stage, width: video.width, height: video.height });
  const worker = { ...events(), terminate: vi.fn(), onmessage: vi.fn() };
  const nativeMessage = worker.onmessage;
  const stopProcessVideo = vi.fn(() => { if (options.teardownThrows) throw new Error('stop failed'); });
  const dispose = vi.fn(() => { if (options.teardownThrows) throw new Error('dispose failed'); });
  const dummyRun = vi.fn(async () => snapshot('dummyRun'));
  const processVideo = vi.fn(() => { snapshot('processVideo'); }); // pinned method returns void
  const construct = vi.fn();
  class Controller {
    worker = worker;
    stopProcessVideo = stopProcessVideo;
    dispose = dispose;
    dummyRun = dummyRun;
    processVideo = processVideo;
    addImageTargets = vi.fn(() => options.targetsPending ? targets.promise : Promise.resolve({ dimensions: [[100, 100]] }));
    constructor(input: { inputWidth: number; inputHeight: number }) {
      construct(input);
      snapshots.push({ stage: 'constructor', width: video.width, height: video.height, ...input });
    }
  }
  const parent = { postMessage: vi.fn() };
  runInNewContext(source, {
    Controller, document: { querySelector: () => video, documentElement: { lang: '' } },
    parent, location: { origin: 'https://scanner.test' }, isSecureContext: true,
    navigator: { mediaDevices: { getUserMedia: vi.fn(() => options.permissionPending ? permission.promise : Promise.resolve(stream)) } },
    addEventListener: global.addEventListener,
  }, { filename: 'scanner.js' });
  const message = (type: string) => global.emit('message', {
    source: parent, origin: 'https://scanner.test',
    data: { scope: 'lumical-owner-ar', type, url: 'blob:https://scanner.test/target', camera: 'Camera', locale: 'en' },
  }).results[0] as Promise<void>;
  const sent = () => parent.postMessage.mock.calls.map(([data]) => data);
  return { global, video, worker, nativeMessage, message, sent, tracks, stream, permission, targets,
    snapshots, construct, dummyRun, processVideo, stopProcessVideo, dispose };
}

function expectReleased(h: ReturnType<typeof harness>) {
  for (const track of h.tracks) expect(track.stop).toHaveBeenCalledOnce();
  expect(h.stopProcessVideo).toHaveBeenCalledOnce();
  expect(h.dispose).toHaveBeenCalledOnce();
  expect(h.worker.terminate).toHaveBeenCalledOnce();
  expect(h.video.pause).toHaveBeenCalledOnce();
  expect(h.video.srcObject).toBeNull();
}

describe('shipped scanner runtime lifecycle (not recognition evidence)', () => {
  it('sets positive intrinsic element dimensions before constructor, warmup and processing', async () => {
    const h = harness();
    await h.message('start');
    expect(h.snapshots).toEqual([
      { stage: 'constructor', width: 1280, height: 720, inputWidth: 1280, inputHeight: 720, maxTrack: 1, onUpdate: expect.any(Function) },
      { stage: 'dummyRun', width: 1280, height: 720 },
      { stage: 'processVideo', width: 1280, height: 720 },
    ]);
    expect(h.sent().map(event => event.type)).toEqual(['ready', 'scanning']);
    expect(h.worker.onmessage).toBe(h.nativeMessage);
    await h.message('stop');
  });

  it.each([{ width: 0 }, { height: 0 }, { width: -1 }, { height: NaN }, { width: Infinity }, { height: 1.5 }])('rejects invalid intrinsic dimensions %j', async options => {
    const h = harness(options);
    await h.message('start');
    expect(h.construct).not.toHaveBeenCalled();
    expect(h.dummyRun).not.toHaveBeenCalled();
    expect(h.processVideo).not.toHaveBeenCalled();
    expect(h.sent().at(-1)).toMatchObject({ type: 'error', kind: 'failed' });
    for (const track of h.tracks) expect(track.stop).toHaveBeenCalledOnce();
    expect(h.video.srcObject).toBeNull();
  });

  it.each(['stop', 'pagehide'])('releases camera and runtime on %s, idempotently', async type => {
    const h = harness();
    await h.message('start');
    if (type === 'stop') await h.message('stop');
    else h.global.emit('pagehide');
    await h.message('stop');
    h.global.emit('pagehide');
    expectReleased(h);
    expect(h.sent().filter(event => event.type === 'error')).toEqual([]);
  });

  it.each(['stop', 'pagehide'])('stops a late permission stream after %s without starting MindAR', async type => {
    const h = harness({ permissionPending: true });
    const start = h.message('start');
    if (type === 'stop') await h.message('stop');
    else h.global.emit('pagehide');
    h.permission.resolve(h.stream);
    await start;
    for (const track of h.tracks) expect(track.stop).toHaveBeenCalledOnce();
    expect(h.video.srcObject).toBeNull();
    expect(h.construct).not.toHaveBeenCalled();
    expect(h.sent().map(event => event.type)).toEqual(['ready']);
  });

  it('reports permission denial', async () => {
    const h = harness({ permissionPending: true });
    const start = h.message('start');
    h.permission.reject({ name: 'NotAllowedError' });
    await start;
    expect(h.sent().at(-1)).toMatchObject({ type: 'error', kind: 'denied' });
    expect(h.construct).not.toHaveBeenCalled();
  });

  it.each(['unhandledrejection', 'error'])('contains detached async/browser %s failures', async type => {
    const h = harness();
    await h.message('start');
    // Node has no browser unhandledrejection dispatch. Deliver the browser event
    // asynchronously, as it would arrive after the detached MindAR loop fails.
    const result = await Promise.resolve().then(() => h.global.emit(type, { reason: new Error('GPU failure'), error: new Error('GPU failure') }));
    expect(result.event.preventDefault).toHaveBeenCalledOnce();
    expect(h.sent().at(-1)).toMatchObject({ type: 'error', kind: 'failed' });
    expectReleased(h);
    h.global.emit(type);
    expect(h.sent().filter(event => event.type === 'error')).toHaveLength(1);
  });

  it.each(['error', 'messageerror'])('contains native worker %s without replacing MindAR messages', async type => {
    const h = harness();
    await h.message('start');
    h.worker.emit(type);
    expect(h.worker.onmessage).toBe(h.nativeMessage);
    expect(h.sent().at(-1)).toMatchObject({ type: 'error', kind: 'failed' });
    expectReleased(h);
  });

  it('handles worker failure while target setup is pending, never resumes scanning', async () => {
    const h = harness({ targetsPending: true });
    const start = h.message('start');
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(h.construct).toHaveBeenCalledOnce();
    h.worker.emit('error');
    h.targets.resolve({ dimensions: [[100, 100]] });
    await start;
    expectReleased(h);
    expect(h.processVideo).not.toHaveBeenCalled();
    expect(h.sent().map(event => event.type)).toEqual(['ready', 'error']);
  });

  it('attempts every release and exposes teardown exceptions rather than swallowing them', async () => {
    const h = harness({ teardownThrows: true });
    await h.message('start');
    await expect(h.message('stop')).rejects.toThrow('Scanner teardown failed');
    expectReleased(h);
    await h.message('stop');
  });

  it('keeps teardown failures observable even in the global error boundary', async () => {
    const h = harness({ teardownThrows: true });
    await h.message('start');
    expect(() => h.global.emit('unhandledrejection', { reason: new Error('detached') })).toThrow('Scanner teardown failed');
    expectReleased(h);
    expect(h.sent().filter(event => event.type === 'error')).toHaveLength(1);
  });
});
