// Prevents a late /api/spike/reveal response from rendering after the target was lost, AR was stopped or a newer
// recognition started. Browser-safe ES module with no DOM access, so it is unit-tested in Node (test/stale-reveal.test.mjs).

export function createRevealGuard() {
  let generation = 0;
  let controller = null;
  return {
    /** Starts a new request: aborts the previous one and returns a handle that says whether it is still current. */
    begin() {
      controller?.abort();
      const own = new AbortController();
      controller = own;
      const mine = ++generation;
      return { signal: own.signal, isCurrent: () => mine === generation && !own.signal.aborted };
    },
    /** Call when the target is lost, AR is stopped or started again: every in-flight request becomes stale. */
    invalidate() {
      generation += 1;
      controller?.abort();
      controller = null;
    },
  };
}

/**
 * Runs one reveal request and calls exactly one handler. A stale request (aborted, or invalidated while the response
 * or its body was in flight) only ever reaches `onStale`; it can never reach `onOk` or `onDenied`.
 */
export async function runGuardedReveal(guard, { fetchReveal }, handlers) {
  const req = guard.begin();
  let res;
  try {
    res = await fetchReveal(req.signal);
  } catch (err) {
    if (req.signal.aborted || err?.name === 'AbortError') return handlers.onStale?.('aborted');
    return req.isCurrent() ? handlers.onError?.(err) : handlers.onStale?.('error-after-invalidate');
  }
  if (!req.isCurrent()) return handlers.onStale?.('after-response');
  if (!res.ok) return handlers.onDenied?.(res.status);
  let body;
  try {
    body = await res.json();
  } catch (err) {
    return req.isCurrent() ? handlers.onError?.(err) : handlers.onStale?.('after-body');
  }
  if (!req.isCurrent()) return handlers.onStale?.('after-body');
  return handlers.onOk?.(body);
}
