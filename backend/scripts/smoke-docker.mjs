import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { docker } from './disposable-postgres.mjs';

const project = `lumical-i01-smoke-${randomBytes(6).toString('hex')}`;
const composeFile = fileURLToPath(
  new URL('../../compose.yaml', import.meta.url),
);
async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return String(port);
}
const env = {
  ...process.env,
  POSTGRES_BOOTSTRAP_PASSWORD: randomBytes(24).toString('hex'),
  MIGRATION_DB_PASSWORD: randomBytes(24).toString('hex'),
  RUNTIME_DB_PASSWORD: randomBytes(24).toString('hex'),
  POSTGRES_DB: 'lumical_i01_smoke',
  FRONTEND_PORT: await unusedPort(),
  BACKEND_PORT: await unusedPort(),
  POSTGRES_PORT: await unusedPort(),
};
const compose = (args) =>
  docker(['compose', '-p', project, '-f', composeFile, ...args], { env });
async function response(port, route, status, body) {
  const result = await fetch(`http://127.0.0.1:${port}${route}`, {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(result.status, status);
  if (body) assert.deepEqual(await result.json(), body);
}
async function cleanup() {
  const ids = await docker([
    'ps',
    '-aq',
    '--filter',
    `label=com.docker.compose.project=${project}`,
  ]);
  for (const id of ids.split(/\s+/).filter(Boolean)) {
    const labels = JSON.parse(
      await docker(['inspect', '--format', '{{json .Config.Labels}}', id]),
    );
    assert.equal(labels['com.docker.compose.project'], project);
  }
  assert.ok(project.startsWith('lumical-i01-smoke-'));
  await compose(['down', '--volumes', '--remove-orphans']);
  assert.equal(
    await docker([
      'ps',
      '-aq',
      '--filter',
      `label=com.docker.compose.project=${project}`,
    ]),
    '',
  );
  assert.equal(
    await docker([
      'volume',
      'ls',
      '-q',
      '--filter',
      `label=com.docker.compose.project=${project}`,
    ]),
    '',
  );
  console.log(
    'PASS: cleaned only this smoke project’s containers, network and database volume.',
  );
}
async function smoke() {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'lumical-i01-fresh-init-'),
  );
  let startup;
  let postgres;
  let released = false;
  try {
    console.log(
      'Building isolated Compose smoke images and applying migrations...',
    );
    // No shell and no credentials in command output. Docker output is retained only
    // for build diagnostics; Compose never prints the supplied passwords.
    await compose(['build']);
    const override = path.join(directory, 'compose.init-barrier.json');
    // Override the initializer in memory only. The real role script and real
    // Compose health/dependency definitions stay in use. SIGUSR1 releases the
    // barrier; timing sleeps are only short condition polling, never the gate.
    const initializer = `source /usr/local/bin/docker-entrypoint.sh
LUMICAL_INIT_RELEASED=''
trap 'LUMICAL_INIT_RELEASED=1' USR1
docker_process_init_files() {
  echo LUMICAL_FRESH_INIT_GATE
  while [ -z "$$LUMICAL_INIT_RELEASED" ]; do sleep 0.1; done
  source /docker-entrypoint-initdb.d/00-roles.sh
}
_main postgres`;
    await writeFile(
      override,
      JSON.stringify({
        services: {
          postgres: {
            entrypoint: [
              'bash',
              '-ec',
              'chown postgres:postgres /var/lib/postgresql/data; exec gosu postgres bash -ec "$$1"',
              '--',
              initializer,
            ],
            command: [],
            volumes: [{ type: 'tmpfs', target: '/var/lib/postgresql/data' }],
          },
        },
      }),
    );
    // Observe startup while Compose is blocked on PostgreSQL's actual health.
    // Capture rejection immediately so a failed startup cannot be unhandled.
    startup = compose(['-f', override, 'up', '-d']).then(
      () => ({ error: null }),
      (error) => ({ error }),
    );
    let held = false;
    for (let count = 0; count < 120; count += 1) {
      postgres = await compose(['ps', '-aq', 'postgres']);
      if (
        postgres &&
        (await docker(['logs', postgres])).includes('LUMICAL_FRESH_INIT_GATE')
      ) {
        held = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(held, 'Fresh initialization must reach the release barrier');
    const health = async () =>
      JSON.parse(
        await docker([
          'inspect',
          '--format',
          '{{json .State.Health}}',
          postgres,
        ]),
      );
    const previousCheck = (await health()).Log.at(-1)?.End;
    let checked;
    for (let count = 0; count < 120; count += 1) {
      const state = await health();
      if (state.Log.at(-1)?.End && state.Log.at(-1).End !== previousCheck) {
        checked = state;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(checked, 'Healthcheck must execute while initialization is held');
    assert.notEqual(
      checked.Status,
      'healthy',
      'Socket-only initialization must never satisfy TCP health',
    );
    await docker([
      'exec',
      postgres,
      'pg_isready',
      '-U',
      'lumical_bootstrap',
      '-d',
      env.POSTGRES_DB,
    ]);
    assert.equal(
      await docker([
        'exec',
        postgres,
        'psql',
        '-U',
        'lumical_bootstrap',
        '-d',
        env.POSTGRES_DB,
        '-Atc',
        "SELECT count(*) FROM pg_roles WHERE rolname IN ('lumical_runtime','lumical_migration')",
      ]),
      '0',
    );
    for (const service of ['migrate', 'backend']) {
      const id = await compose(['ps', '-aq', service]);
      if (id)
        assert.equal(
          await docker(['inspect', '--format', '{{.State.Status}}', id]),
          'created',
          `${service} must wait for initialization`,
        );
    }
    const labels = JSON.parse(
      await docker([
        'inspect',
        '--format',
        '{{json .Config.Labels}}',
        postgres,
      ]),
    );
    assert.equal(labels['com.docker.compose.project'], project);
    await docker(['kill', '--signal', 'USR1', postgres]);
    released = true;
    const result = await startup;
    if (result.error) throw result.error;
    assert.equal((await health()).Status, 'healthy');
    console.log(
      'PASS: delayed fresh Compose initialization blocks health, migrations and backend until roles and final TCP are ready.',
    );
    let started = false;
    for (let count = 0; count < 120; count += 1) {
      try {
        await response(env.BACKEND_PORT, '/api/v1/health/ready', 200, {
          ready: true,
        });
        await response(env.FRONTEND_PORT, '/api/v1/health', 200, {
          status: 'ok',
          service: 'lumical-backend',
        });
        started = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    assert.ok(started, 'Compose backend/frontend failed readiness');
    await response(env.FRONTEND_PORT, '/', 200);
    await response(env.BACKEND_PORT, '/api/v1/health/live', 200, {
      alive: true,
    });
    const migration = await compose(['ps', '-aq', 'migrate']);
    assert.equal(
      await docker(['inspect', '--format', '{{.State.ExitCode}}', migration]),
      '0',
    );
    console.log(
      'PASS: production images, PostgreSQL initialization, migration service, readiness and frontend proxy.',
    );
    await compose(['stop', 'postgres']);
    await response(env.BACKEND_PORT, '/api/v1/health/ready', 503, {
      ready: false,
    });
    await response(env.BACKEND_PORT, '/api/v1/health/live', 200, {
      alive: true,
    });
    console.log(
      'PASS: actual PostgreSQL outage returns readiness 503 while liveness stays 200.',
    );
  } finally {
    try {
      if (startup) {
        if (postgres && !released) {
          // Release a held initializer before waiting for a failed assertion's
          // startup to finish; mutations still target only this owned project.
          await docker(['kill', '--signal', 'USR1', postgres]).catch(() => {});
        }
        await startup;
      }
      await cleanup();
    } finally {
      const resolved = path.resolve(directory);
      assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
      assert.ok(path.basename(resolved).startsWith('lumical-i01-fresh-init-'));
      await rm(resolved, { recursive: true });
    }
  }
}
try {
  await smoke();
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
