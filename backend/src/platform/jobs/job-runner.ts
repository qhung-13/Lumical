import { Inject, Injectable } from '@nestjs/common';

export const DURABLE_JOB_HANDLERS = Symbol('DURABLE_JOB_HANDLERS');
export interface DurableJobHandler {
  runBatch(limit: number, signal: AbortSignal): Promise<number>;
}

/** Same-build bounded dispatcher. Feature adapters own durable leases and outcomes. */
@Injectable()
export class DurableJobRunner {
  constructor(
    @Inject(DURABLE_JOB_HANDLERS)
    private readonly handlers: readonly DurableJobHandler[],
  ) {}
  async runOnce(signal: AbortSignal): Promise<number> {
    let processed = 0;
    for (const handler of this.handlers) {
      if (signal.aborted || processed >= 20) break;
      processed += await handler.runBatch(20 - processed, signal);
    }
    return processed;
  }
}
