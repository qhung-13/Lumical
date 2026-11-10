import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { setTimeout } from 'node:timers/promises';
import { AppModule } from './app.module';
import { DurableJobRunner } from './platform/jobs/job-runner';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    do {
      try {
        await app.get(DurableJobRunner).runOnce(controller.signal);
      } catch {
        console.error('Job pass failed: STORAGE_OR_DATABASE_UNAVAILABLE');
        if (process.argv.includes('--once')) {
          process.exitCode = 1;
          break;
        }
      }
      if (process.argv.includes('--once') || controller.signal.aborted) break;
      await setTimeout(1000, undefined, { signal: controller.signal }).catch(
        () => undefined,
      );
    } while (!controller.signal.aborted);
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    await app.close();
  }
}
void main().catch(() => {
  console.error('Job worker unavailable');
  process.exitCode = 1;
});
