import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const execute = promisify(execFile);
export async function docker(args, options = {}) {
  try {
    const result = await execute('docker', args, {
      maxBuffer: 8 * 1024 * 1024,
      ...options,
    });
    return result.stdout.trim();
  } catch (error) {
    // execFile's default error message includes argv, including temporary role
    // passwords for `run`. Never serialize that message or its command field.
    throw new Error(
      `Docker ${args[0]} failed (${error.code}).\n${error.stderr ?? ''}`,
    );
  }
}

async function cleanup(name, run) {
  const labels = JSON.parse(
    await docker(['inspect', '--format', '{{json .Config.Labels}}', name]),
  );
  if (
    labels['lumical.i01.run'] !== run ||
    !name.startsWith('lumical-i01-test-')
  ) {
    throw new Error(
      'Refusing cleanup: disposable resource ownership does not match.',
    );
  }
  await docker(['rm', '-f', name]);
  console.log('PASS: removed only this run’s disposable PostgreSQL container.');
}

// Each invocation owns exactly one labelled container, using tmpfs rather than
// a reusable dev volume. Cleanup checks ownership; no reset or global prune.
export async function withDisposablePostgres(work) {
  const run = randomUUID();
  const name = `lumical-i01-test-${run}`;
  const passwords = Object.fromEntries(
    ['bootstrap', 'migration', 'runtime'].map((role) => [
      role,
      randomBytes(24).toString('hex'),
    ]),
  );
  const init = fileURLToPath(new URL('../database/init', import.meta.url));
  let created = false;
  try {
    await docker([
      'run',
      '-d',
      '--name',
      name,
      '--label',
      `lumical.i01.run=${run}`,
      '--tmpfs',
      '/var/lib/postgresql/data:rw',
      '-p',
      '127.0.0.1::5432',
      '--mount',
      `type=bind,source=${init},target=/docker-entrypoint-initdb.d,readonly`,
      '-e',
      'POSTGRES_USER=lumical_bootstrap',
      '-e',
      'POSTGRES_DB=lumical_i01_blank',
      '-e',
      `POSTGRES_PASSWORD=${passwords.bootstrap}`,
      '-e',
      `MIGRATION_DB_PASSWORD=${passwords.migration}`,
      '-e',
      `RUNTIME_DB_PASSWORD=${passwords.runtime}`,
      'postgres:17.11-bookworm',
    ]);
    created = true;
    const port = (await docker(['port', name, '5432/tcp'])).split(':').at(-1);
    const url = (role, database) =>
      `postgresql://lumical_${role}:${passwords[role]}@127.0.0.1:${port}/${database}?schema=lumical`;
    let available = false;
    for (let count = 0; count < 120; count += 1) {
      const connection = new pg.Client({
        connectionString: url('bootstrap', 'lumical_i01_blank'),
        connectionTimeoutMillis: 500,
      });
      try {
        await connection.connect();
        const result = await connection.query(
          "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='lumical_runtime') AS ready",
        );
        available = result.rows[0].ready;
      } catch {
        /* Initialization polling only; concurrency tests use barriers. */
      } finally {
        await connection.end();
      }
      if (available) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!available)
      throw new Error('Disposable PostgreSQL initialization failed.');
    await work({ name, run, url });
  } finally {
    if (created) {
      await cleanup(name, run);
    }
  }
}
