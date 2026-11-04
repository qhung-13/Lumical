import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { cp, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import { withDisposablePostgres } from './disposable-postgres.mjs';
import { projectFixture } from '../test/database/fixtures.mjs';

const require = createRequire(import.meta.url);
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module.js');
const {
  CreateProject,
} = require('../dist/modules/calendar-projects/application/create-project.js');
const {
  IdentityService,
} = require('../dist/modules/identity/application/identity-service.js');
const { Clock } = require('../dist/modules/identity/application/ports.js');
const {
  PublicTemplateCatalog,
} = require('../dist/modules/templates/application/template-catalog.js');
const backend = fileURLToPath(new URL('..', import.meta.url));
const migrationName = '20261104000100_project_names_text';
const origin = 'https://lumical.test';
const months = Array.from({ length: 12 }, (_, index) => index + 1);
const layout = {
  version: 1,
  type: 'PHOTO_FOCUS',
  monthCount: 12,
  maxImagesPerMonth: 4,
};
const presets = [{ id: 'classic', nameVi: 'Cổ điển', nameEn: 'Classic' }];

async function check(name, work) {
  await work();
  process.stdout.write(`PASS: ${name}\n`);
}

async function connect(connectionString) {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 2000,
  });
  await client.connect();
  return client;
}

async function migrate(args, database) {
  const result = await promisify(execFile)(process.execPath, args, {
    cwd: backend,
    env: { ...process.env, MIGRATION_DATABASE_URL: database },
  });
  console.log(result.stdout.trim());
}

async function deployBaseline(database) {
  const directory = await mkdtemp(path.join(tmpdir(), 'lumical-i05-baseline-'));
  try {
    const source = path.join(backend, 'prisma/migrations');
    const migrations = path.join(directory, 'migrations');
    for (const entry of await readdir(source)) {
      if (entry !== migrationName)
        await cp(path.join(source, entry), path.join(migrations, entry), {
          recursive: true,
        });
    }
    const config = path.join(directory, 'prisma.config.ts');
    const schema = path.join(backend, 'prisma/schema.prisma');
    await writeFile(
      config,
      `export default {schema:${JSON.stringify(schema)}, migrations:{path:${JSON.stringify(migrations)}}, datasource:{url:process.env.MIGRATION_DATABASE_URL}};`,
    );
    await migrate(
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'deploy',
        '--config',
        config,
      ],
      database,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function addTemplate(client, category = 'GENERAL') {
  const id = randomUUID();
  await client.query(
    'INSERT INTO lumical.templates(id, category, updated_at) VALUES ($1,$2,now())',
    [id, category],
  );
  return id;
}

async function addRevision(client, template, revision, copy, design, price) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO lumical.template_revisions
    (id,template_id,revision,name_vi,name_en,description_vi,description_en,layout_definition,style_presets,unit_price_minor,published_at)
    VALUES ($1,$2,$3,$4,$4,'Synthetic description','Synthetic description',$5,$6,$7,now())`,
    [id, template, revision, copy, design, JSON.stringify(presets), price],
  );
  return id;
}

async function setPublished(client, template, revision) {
  await client.query(
    `UPDATE lumical.templates SET current_published_revision_id=$2,
    availability='ACTIVE', version=version+1 WHERE id=$1`,
    [template, revision],
  );
}

async function waitForBlocked(observer, query, blockingPid = null) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const {
      rows: [row],
    } = await observer.query(
      `SELECT EXISTS (
      SELECT FROM pg_stat_activity WHERE usename='lumical_runtime' AND query LIKE $1
      AND cardinality(pg_blocking_pids(pid))>0
      AND ($2::integer IS NULL OR $2=ANY(pg_blocking_pids(pid)))) AS blocked`,
      [query, blockingPid],
    );
    if (row.blocked) return;
    await delay(25);
  }
  assert.fail(`Expected a real PostgreSQL lock wait for ${query}`);
}

async function schemaProtection(client) {
  const { rows } = await client.query(`
    SELECT conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='lumical.calendar_projects'::regclass
    UNION ALL
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname='lumical' AND tablename='calendar_projects'
    ORDER BY name`);
  // PostgreSQL deparses btrim's implicit cast on varchar, but not on text.
  return rows.map(({ name, definition }) => ({
    name,
    definition: definition.replace(/\((title|recipient_name)\)::text/g, '$1'),
  }));
}

await withDisposablePostgres(async ({ url }) => {
  const databaseName = 'lumical_i01_blank';
  const migrationUrl = url('migration', databaseName);
  process.env.DATABASE_URL = url('runtime', databaseName);
  process.env.IDENTITY_COOKIE_MODE = 'https';
  process.env.IDENTITY_SECRET_KEY = randomBytes(32).toString('hex');
  process.env.IDENTITY_ALLOWED_ORIGINS = origin;
  process.env.CALENDAR_TIME_ZONE = 'Pacific/Auckland';
  const observer = await connect(url('bootstrap', databaseName));
  const migration = await connect(migrationUrl);
  let module;
  try {
    const persisted = async (id) =>
      (
        await migration.query(
          `
      SELECT p.*, r.template_id FROM lumical.calendar_projects p
      JOIN lumical.template_revisions r ON r.id=p.template_revision_id WHERE p.id=$1`,
          [id],
        )
      ).rows[0];

    let template;
    let originalRevision;
    await check(
      'PostgreSQL 17.11 baseline deploy and Unicode upgrade preserve rows, constraints and indexes',
      async () => {
        assert.match(
          (await observer.query('SHOW server_version')).rows[0].server_version,
          /^17\.11/,
        );
        await deployBaseline(migrationUrl);
        const owner = randomUUID();
        await migration.query(
          `INSERT INTO lumical.users(id,normalized_email,password_hash,updated_at)
        VALUES ($1,'upgrade@example.invalid','TEST_DISABLED',now())`,
          [owner],
        );
        template = await addTemplate(migration);
        originalRevision = await addRevision(
          migration,
          template,
          1,
          'Original',
          layout,
          1450,
        );
        const existing = await projectFixture(
          migration,
          owner,
          originalRevision,
        );
        const prior = await persisted(existing);
        const protections = await schemaProtection(migration);
        const nameTypes = () =>
          migration.query(`SELECT data_type, is_nullable, character_maximum_length
        FROM information_schema.columns WHERE table_schema='lumical' AND table_name='calendar_projects'
        AND column_name IN ('title','recipient_name') ORDER BY column_name`);
        assert.deepEqual(
          (await nameTypes()).rows,
          Array(2).fill({
            data_type: 'character varying',
            is_nullable: 'NO',
            character_maximum_length: 80,
          }),
        );
        await migrate(
          ['scripts/prisma.mjs', 'migrate', 'deploy'],
          migrationUrl,
        );
        assert.deepEqual(
          (await nameTypes()).rows,
          Array(2).fill({
            data_type: 'text',
            is_nullable: 'NO',
            character_maximum_length: null,
          }),
        );
        assert.deepEqual(await persisted(existing), prior);
        assert.deepEqual(await schemaProtection(migration), protections);
        for (const column of ['title', 'recipient_name']) {
          await assert.rejects(
            migration.query(
              `UPDATE lumical.calendar_projects SET ${column}=' ' WHERE id=$1`,
              [existing],
            ),
            { code: '23514', constraint: 'calendar_projects_identity_check' },
          );
        }
        assert.equal(
          (
            await migration.query(
              `SELECT count(*) FROM lumical._prisma_migrations
        WHERE migration_name=$1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL`,
              [migrationName],
            )
          ).rows[0].count,
          '1',
        );
      },
    );

    // Auckland reaches January 1 while it is still December 31 in UTC and Vietnam.
    let now = new Date('2026-12-31T10:59:59.999Z');
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue({ now: () => now })
      .compile();
    await module.init();
    const createProject = module.get(CreateProject);
    const identity = module.get(IdentityService);
    const register = (email) =>
      identity.register(
        { email, password: 'TEST ONLY memory passphrase' },
        randomUUID(),
        { origin, ip: '127.0.0.1', requestId: randomUUID() },
      );
    const owner = await register('project-owner@example.invalid');
    const other = await register('other-owner@example.invalid');
    const auth = (actor) => ({
      origin,
      secret: actor.secret,
      csrf: actor.csrfToken,
    });
    const year = 2026;
    const family = '👨‍👩‍👧‍👦'.repeat(80);
    const input = {
      title: family,
      recipientName: family,
      year,
      templateId: template,
      stylePresetId: 'classic',
    };
    const create = (key, fields = {}, actor = owner) =>
      createProject.execute(auth(actor), { ...input, ...fields }, key);
    const counts = async () =>
      (
        await migration.query(`SELECT
      (SELECT count(*) FROM lumical.calendar_projects) AS projects,
      (SELECT count(*) FROM lumical.calendar_months) AS months,
      (SELECT count(*) FROM lumical.idempotency_records WHERE operation='PROJECT_CREATE') AS outcomes`)
      ).rows[0];

    await check(
      'authorization, owner injection, invalid identity, inactive/unpublished/incomplete Templates and invalid presets',
      async () => {
        const before = await counts();
        await assert.rejects(
          createProject.execute({ origin }, input, randomUUID()),
          { code: 'UNAUTHENTICATED' },
        );
        await assert.rejects(
          createProject.execute(
            { ...auth(owner), csrf: undefined },
            input,
            randomUUID(),
          ),
          { code: 'CSRF_REJECTED' },
        );
        await assert.rejects(
          create(randomUUID(), { ownerId: other.principal.id }),
          { code: 'VALIDATION_FAILED' },
        );
        for (const [field, value] of [
          ['title', '👨‍👩‍👧‍👦'.repeat(81)],
          ['recipientName', '\u200B'],
          ['year', year + 3],
        ]) {
          await assert.rejects(create(randomUUID(), { [field]: value }), {
            code: 'VALIDATION_FAILED',
            field,
          });
        }
        for (const invalidKey of [
          undefined,
          '',
          '   ',
          'bad\nkey',
          'bad\0key',
          '\uD800',
          'é'.repeat(513),
        ]) {
          await assert.rejects(create(invalidKey), {
            code: 'VALIDATION_FAILED',
          });
        }
        const unpublished = await addTemplate(migration);
        const incomplete = await addTemplate(migration);
        const incompleteRevision = await addRevision(
          migration,
          incomplete,
          1,
          'Incomplete',
          {},
          1450,
        );
        await setPublished(migration, incomplete, incompleteRevision);
        for (const id of [template, unpublished, incomplete, randomUUID()]) {
          await assert.rejects(create(randomUUID(), { templateId: id }), {
            code: 'TEMPLATE_UNAVAILABLE',
          });
        }
        await setPublished(migration, template, originalRevision);
        await assert.rejects(
          create(randomUUID(), { stylePresetId: 'minimal' }),
          { code: 'VALIDATION_FAILED', field: 'stylePresetId' },
        );
        assert.deepEqual(await counts(), before);
      },
    );

    let first;
    const key = 'x';
    await check(
      'one private Working Project at version 1, frozen revision and twelve empty Months; 80 graphemes round trip',
      async () => {
        const before = await counts();
        first = await create(key);
        assert.deepEqual(Object.keys(first), ['id']);
        const project = await persisted(first.id);
        assert.equal(project.owner_id, owner.principal.id);
        assert.equal(project.status, 'WORKING');
        assert.equal(project.version, 1);
        assert.equal(project.year, year);
        assert.equal(project.title, family);
        assert.equal(project.recipient_name, family);
        assert.equal(project.template_id, template);
        assert.equal(project.template_revision_id, originalRevision);
        assert.equal(project.baseline_name_vi, 'Original');
        assert.equal(project.baseline_name_en, 'Original');
        assert.deepEqual(project.baseline_style, layout);
        assert.equal(project.style_preset_id, 'classic');
        assert.equal(project.currency, 'USD');
        assert.equal(project.unit_price_minor, '1450');
        const children = await migration.query(
          `SELECT project_id, month_number, caption FROM lumical.calendar_months
        WHERE project_id=$1 ORDER BY month_number`,
          [first.id],
        );
        assert.deepEqual(
          children.rows,
          months.map((month_number) => ({
            project_id: first.id,
            month_number,
            caption: null,
          })),
        );
        assert.deepEqual(await counts(), {
          projects: String(+before.projects + 1),
          months: '12',
          outcomes: '1',
        });
      },
    );

    await check(
      'canonical replay, lost response recovery, changed intent, actor isolation and disabled-account denial',
      async () => {
        assert.deepEqual(
          await create(key, {
            templateId: template.toUpperCase(),
            title: ` ${family} `,
          }),
          first,
        );
        await assert.rejects(create(key, { title: 'Changed' }), {
          code: 'IDEMPOTENCY_CONFLICT',
        });
        const otherProject = await create(key, {}, other);
        assert.notEqual(otherProject.id, first.id);
        assert.equal(
          (await persisted(otherProject.id)).owner_id,
          other.principal.id,
        );
        const unicodeKey = randomUUID();
        const nfc = await create(unicodeKey, { title: 'Cafe\u0301' });
        assert.equal((await persisted(nfc.id)).title, 'Café');
        assert.deepEqual(await create(unicodeKey, { title: 'Café' }), nfc);
        await migration.query(
          "UPDATE lumical.users SET status='DISABLED' WHERE id=$1",
          [other.principal.id],
        );
        await assert.rejects(create(key, {}, other), {
          code: 'UNAUTHENTICATED',
        });
      },
    );

    await check(
      'Month insertion and commit failures leave no Project, Month or successful intent; same-key retries recover',
      async () => {
        const before = await counts();
        const failedKey = randomUUID();
        await migration.query(
          `ALTER TABLE lumical.calendar_months ADD CONSTRAINT test_reject_june CHECK (month_number<>6) NOT VALID`,
        );
        try {
          await assert.rejects(create(failedKey), /test_reject_june/);
          assert.deepEqual(await counts(), before);
        } finally {
          await migration.query(
            'ALTER TABLE lumical.calendar_months DROP CONSTRAINT test_reject_june',
          );
        }
        await migration.query(`CREATE FUNCTION lumical.test_project_commit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic Project commit failure'; END $$;
        CREATE CONSTRAINT TRIGGER test_project_commit_failure AFTER INSERT ON lumical.idempotency_records
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.operation='PROJECT_CREATE')
        EXECUTE FUNCTION lumical.test_project_commit_failure()`);
        try {
          await assert.rejects(
            create(failedKey),
            /synthetic Project commit failure/,
          );
          assert.deepEqual(await counts(), before);
        } finally {
          await migration.query(`DROP TRIGGER test_project_commit_failure ON lumical.idempotency_records;
          DROP FUNCTION lumical.test_project_commit_failure()`);
        }
        const recovered = await create(failedKey);
        assert.deepEqual(await create(failedKey), recovered);
      },
    );

    await check(
      'parallel same-key requests contend in PostgreSQL and commit one Project and one durable outcome',
      async () => {
        const catalog = module.get(PublicTemplateCatalog);
        const original = catalog.findAvailable;
        const reached = Promise.withResolvers();
        const release = Promise.withResolvers();
        catalog.findAvailable = async (...args) => {
          const baseline = await original.call(catalog, ...args);
          reached.resolve();
          await release.promise;
          return baseline;
        };
        const before = await counts();
        const parallelKey = 'client/v2:daily.calendar+one=';
        const winner = create(parallelKey);
        void winner.catch(reached.reject);
        let contender;
        try {
          await reached.promise;
          contender = create(parallelKey);
          void contender.catch(() => {});
          await waitForBlocked(observer, '%lumical.users%FOR UPDATE%');
        } finally {
          catalog.findAvailable = original;
          release.resolve();
          await Promise.allSettled([winner, contender]);
        }
        assert.deepEqual(await winner, await contender);
        assert.deepEqual(await counts(), {
          projects: String(+before.projects + 1),
          months: String(+before.months + 12),
          outcomes: String(+before.outcomes + 1),
        });
      },
    );

    await check(
      'Template races recheck eligibility and publication retry keeps the pre-midnight creation-year window',
      async () => {
        const before = await persisted(first.id);
        const newerLayout = { ...layout, type: 'COLLAGE' };
        const blocker = (await migration.query('SELECT pg_backend_pid() AS id'))
          .rows[0].id;
        const nextRevision = await addRevision(
          migration,
          template,
          2,
          'Revised',
          newerLayout,
          2900,
        );
        async function race(change, requestYear, beforeCommit = () => {}) {
          await migration.query('BEGIN');
          let pending;
          try {
            await change();
            pending = create(randomUUID(), { year: requestYear });
            void pending.catch(() => {});
            // pg_stat_activity can truncate the SQL before the trailing lock clause.
            await waitForBlocked(
              observer,
              '%FROM lumical.templates t JOIN%',
              blocker,
            );
            beforeCommit();
            await migration.query('COMMIT');
          } catch (error) {
            await migration.query('ROLLBACK');
            if (pending) await Promise.allSettled([pending]);
            throw error;
          }
          return pending;
        }
        const next = await race(
          () => setPublished(migration, template, nextRevision),
          year,
          () => {
            now = new Date('2026-12-31T11:00:00.000Z');
          },
        );
        const newer = await persisted(next.id);
        assert.equal(newer.year, year);
        assert.equal(newer.template_revision_id, nextRevision);
        assert.equal(newer.baseline_name_en, 'Revised');
        assert.deepEqual(newer.baseline_style, newerLayout);
        assert.equal(newer.unit_price_minor, '2900');
        for (const invalidYear of [year, year + 4]) {
          await assert.rejects(create(randomUUID(), { year: invalidYear }), {
            code: 'VALIDATION_FAILED',
            field: 'year',
          });
        }
        const upper = await create('é'.repeat(512), { year: year + 3 });
        assert.equal((await persisted(upper.id)).year, year + 3);
        const beforeDeactivation = await counts();
        await assert.rejects(
          race(
            () =>
              migration.query(
                "UPDATE lumical.templates SET availability='INACTIVE', version=version+1 WHERE id=$1",
                [template],
              ),
            year + 1,
          ),
          { code: 'TEMPLATE_UNAVAILABLE' },
        );
        assert.deepEqual(await counts(), beforeDeactivation);
        assert.deepEqual(await persisted(first.id), before);
        assert.deepEqual(await persisted(next.id), newer);
        assert.deepEqual(await create(key), first);
      },
    );
  } finally {
    await module?.close();
    await migration.end();
    await observer.end();
  }
}).catch((error) => {
  process.stderr.write(`FAIL: ${error.stack ?? error}\n`);
  process.exitCode = 1;
});
