import { beforeMediaDeadline, MEDIA_RESPONSE_DEADLINE_MS } from './media-request-deadline';

describe('media response deadline', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('allows a controlled result from a slow provider before the Nest deadline', async () => {
    const caller = new AbortController();
    const providerUnavailable = new Error('PROVIDER_UNAVAILABLE');
    const response = beforeMediaDeadline(caller.signal, () => new Error('deadline'),
      () => new Promise((_resolve, reject) => setTimeout(() => reject(providerUnavailable), 15_000)));
    const assertion = expect(response).rejects.toBe(providerUnavailable);
    await jest.advanceTimersByTimeAsync(15_000);
    await assertion;
  });

  it('returns a controlled timeout and cancels upstream work by the deadline', async () => {
    const caller = new AbortController();
    const controlled = new Error('controlled 503');
    const abort = jest.fn();
    const response = beforeMediaDeadline(caller.signal, () => controlled, (signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => { abort(); reject(signal.reason); });
    }));
    const assertion = expect(response).rejects.toBe(controlled);
    await jest.advanceTimersByTimeAsync(MEDIA_RESPONSE_DEADLINE_MS);
    await assertion;
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('propagates a disconnect when headers are ready: %s', async (headersReady) => {
    const caller = new AbortController();
    const aborted = jest.fn();
    const response = beforeMediaDeadline(caller.signal, () => new Error('deadline'), async (signal) => {
      signal.addEventListener('abort', aborted);
      return headersReady ? 'headers' : new Promise<string>(() => undefined);
    });
    if (headersReady) {
      await expect(response).resolves.toBe('headers');
      await jest.advanceTimersByTimeAsync(MEDIA_RESPONSE_DEADLINE_MS);
      expect(aborted).not.toHaveBeenCalled();
    }
    caller.abort();
    if (!headersReady) await expect(response).rejects.toBe(caller.signal.reason);
    expect(aborted).toHaveBeenCalledTimes(1);
  });
});
