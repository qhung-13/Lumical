// Leave room after the 15 s Admin inspection and before the 30 s gateway deadline.
export const MEDIA_RESPONSE_DEADLINE_MS = 25_000;

export async function beforeMediaDeadline<T>(
  disconnect: AbortSignal,
  onTimeout: () => Error,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const deadline = new AbortController();
  const signal = AbortSignal.any([disconnect, deadline.signal]);
  signal.throwIfAborted();
  const timer = setTimeout(
    () => deadline.abort(onTimeout()),
    MEDIA_RESPONSE_DEADLINE_MS,
  );
  let onAbort!: () => void;
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([work(signal), cancelled]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
