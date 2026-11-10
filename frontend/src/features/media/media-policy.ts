import type { MediaCategory } from '../../api/media';

export const mediaGuidance = {
  IMAGE: { accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', maxBytes: 10_000_000,
    formats: ['image/jpeg', 'image/png', 'image/webp'], extensions: ['jpg', 'jpeg', 'png', 'webp'] },
  VIDEO: { accept: '.mp4,.webm,video/mp4,video/webm', maxBytes: 100_000_000,
    maxDurationSeconds: 60, formats: ['video/mp4', 'video/webm'], extensions: ['mp4', 'webm'] },
  AUDIO: { accept: '.mp3,.mp4,.m4a,.ogg,.wav,.webm,audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm', maxBytes: 20_000_000,
    maxDurationSeconds: 60, formats: ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm'], extensions: ['mp3', 'mp4', 'm4a', 'ogg', 'wav', 'webm'] },
} as const;

export type FileValidation = 'INVALID_FORMAT' | 'TOO_LARGE' | 'TOO_LONG' | undefined;

export function validateMediaFile(file: File, category: MediaCategory): FileValidation {
  const guidance = mediaGuidance[category];
  if (file.size <= 0 || file.size > guidance.maxBytes) return 'TOO_LARGE';
  const extension = file.name.split('.').at(-1)?.toLowerCase() ?? '';
  if (!guidance.extensions.includes(extension as never)) return 'INVALID_FORMAT';
  if (file.type && file.type !== 'application/octet-stream' && !(guidance.formats as readonly string[]).includes(file.type)) return 'INVALID_FORMAT';
  return undefined;
}

export function readDeclaredDuration(file: File, category: MediaCategory): Promise<number | undefined> {
  if (category === 'IMAGE' || typeof URL.createObjectURL !== 'function') return Promise.resolve(undefined);
  return new Promise(resolve => {
    const element = document.createElement(category === 'VIDEO' ? 'video' : 'audio');
    let source: string;
    try { source = URL.createObjectURL(file); } catch { resolve(undefined); return; }
    let settled = false;
    const finish = (duration?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      URL.revokeObjectURL(source);
      element.removeAttribute('src');
      element.load();
      resolve(duration);
    };
    const timeout = setTimeout(() => finish(), 5000);
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      const duration = element.duration;
      finish(Number.isFinite(duration) && duration > 0 ? Math.ceil(duration * 1000) / 1000 : undefined);
    };
    element.onerror = () => finish();
    element.src = source;
  });
}
