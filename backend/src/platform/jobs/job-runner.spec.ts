import { DurableJobRunner } from './job-runner';

describe('bounded durable dispatcher', () => {
  it('bounds each pass and honors shutdown', async () => {
    const first = { runBatch: jest.fn().mockResolvedValue(15) };
    const second = { runBatch: jest.fn().mockResolvedValue(5) };
    const third = { runBatch: jest.fn() };
    const runner = new DurableJobRunner([first, second, third]);
    const signal = new AbortController().signal;
    expect(await runner.runOnce(signal)).toBe(20);
    expect(second.runBatch).toHaveBeenCalledWith(5, signal);
    expect(third.runBatch).not.toHaveBeenCalled();
    const controller = new AbortController();
    controller.abort();
    expect(await runner.runOnce(controller.signal)).toBe(0);
  });
});
