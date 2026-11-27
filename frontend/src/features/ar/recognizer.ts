export type ScannerEvent = { type: 'scanning' | 'lost' | 'invalid' } | { type: 'found'; index: number } | { type: 'error'; kind: 'denied' | 'unsupported' | 'failed' };
export interface Recognizer { start(host: HTMLElement, artifactUrl: string, receive: (event: ScannerEvent) => void, presentation: { camera: string; locale: 'vi' | 'en' }): () => void }
/** Genuine runtime boundary. Tests inject deterministic adapters, never claimed as device evidence. */
export const mindarRecognizer: Recognizer = {
  start(host, url, receive, presentation) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => { if (!closed) receive({ type: 'error', kind: 'unsupported' }); });
      let closed = false;
      return () => { closed = true; };
    }
    let closed = false;
    const frame = document.createElement('iframe');
    frame.src = '/ar-runtime/index.html'; frame.title = presentation.camera; frame.allow = 'camera';
    frame.style.cssText = 'width:100%;height:100%;border:0';
    const listener = (event: MessageEvent) => {
      if (closed || event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.scope !== 'lumical-owner-ar') return;
      const data = event.data;
      if (['scanning', 'found', 'error'].includes(data.type)) clearTimeout(timer);
      if (data.type === 'ready') frame.contentWindow?.postMessage({ scope: 'lumical-owner-ar', type: 'start', url, ...presentation }, location.origin);
      else if (data.type === 'found' && Number.isInteger(data.index)) receive({ type: 'found', index: data.index });
      else if (['scanning', 'lost', 'invalid'].includes(data.type)) receive({ type: data.type });
      else if (data.type === 'error') receive({ type: 'error', kind: ['denied', 'unsupported'].includes(data.kind) ? data.kind : 'failed' });
    };
    window.addEventListener('message', listener); host.append(frame);
    const timer = window.setTimeout(() => receive({ type: 'error', kind: 'failed' }), 60000);
    return () => {
      closed = true; clearTimeout(timer); window.removeEventListener('message', listener);
      frame.contentWindow?.postMessage({ scope: 'lumical-owner-ar', type: 'stop' }, location.origin);
      frame.remove();
    };
  },
};
