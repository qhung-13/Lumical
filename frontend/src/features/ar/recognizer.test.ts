import { afterEach, describe, expect, it, vi } from 'vitest';
import { ownerARCopy } from '../../i18n/owner-ar-preview';
import { mindarRecognizer } from './recognizer';

// Bridge-level tests only; these do not establish real-device recognition.
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.replaceChildren(); });
describe('localized MindAR camera boundary', () => {
  it.each(['vi', 'en'] as const)('passes %s camera accessibility text into the isolated runtime', locale => {
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
    const host = document.createElement('div'); document.body.append(host);
    const receive = vi.fn(); const camera = ownerARCopy[locale].camera;
    const stop = mindarRecognizer.start(host, 'blob:private-target', receive, { locale, camera });
    try {
      const frame = host.querySelector('iframe')!;
      expect(frame.title).toBe(camera);
      const post = vi.spyOn(frame.contentWindow!, 'postMessage');
      window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source: frame.contentWindow,
        data: { scope: 'lumical-owner-ar', type: 'ready' } }));
      expect(post).toHaveBeenCalledWith({ scope: 'lumical-owner-ar', type: 'start', url: 'blob:private-target', locale, camera }, location.origin);
      expect(receive).not.toHaveBeenCalled();
    } finally { stop(); }
    expect(host.querySelector('iframe')).toBeNull();
  });
  it('reports unsupported camera contexts without creating an iframe', async () => {
    vi.stubGlobal('isSecureContext', false);
    const host = document.createElement('div'); const receive = vi.fn();
    const stop = mindarRecognizer.start(host, 'blob:private-target', receive, { locale: 'vi', camera: ownerARCopy.vi.camera });
    await Promise.resolve();
    expect(receive).toHaveBeenCalledWith({ type: 'error', kind: 'unsupported' });
    expect(host.querySelector('iframe')).toBeNull(); stop();
  });
});
