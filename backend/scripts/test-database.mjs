import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import request from 'supertest';
import { withDisposablePostgres } from './disposable-postgres.mjs';
import {
  mediaFixture,
  artifactFixture,
  projectFixture,
  orderFixture,
} from '../test/database/fixtures.mjs';

const require = createRequire(import.meta.url);
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module.js');
const { configureApp } = require('../dist/config/configure-app.js');
const {
  PrismaDatabase,
} = require('../dist/platform/database/infrastructure/prisma-database.js');
const {
  PrismaTransactions,
} = require('../dist/platform/database/infrastructure/prisma-transactions.js');
const {
  seedSynthetic,
  syntheticIds,
} = require('../dist/platform/database/infrastructure/synthetic-seed.js');
const backend = fileURLToPath(new URL('..', import.meta.url));
const firstMigration = '20261012000100_current_work';

function cli(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: backend,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Migration runner exited ${code}`)),
    );
  });
}
async function connection(connectionString) {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 2000,
    statement_timeout: 10000,
  });
  await client.connect();
  return client;
}
async function rejectsSql(client, sql, params, code) {
  await assert.rejects(
    client.query(sql, params),
    (error) => error.code === code,
  );
}
async function check(name, work) {
  await work();
  console.log(`PASS: ${name}`);
}

try {
  await withDisposablePostgres(async ({ url }) => {
    const bootstrap = await connection(url('bootstrap', 'lumical_i01_blank'));
    try {
      assert.match(
        (await bootstrap.query('SHOW server_version')).rows[0].server_version,
        /^17\.11/,
      );
      await check('empty database → latest reviewed migrations', () =>
        cli(['scripts/prisma.mjs', 'migrate', 'deploy'], {
          MIGRATION_DATABASE_URL: url('migration', 'lumical_i01_blank'),
        }),
      );
      await check(
        'migration history, exact P0 table set and Prisma schema alignment',
        async () => {
          assert.equal(
            (
              await bootstrap.query(
                'SELECT count(*) FROM lumical._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
              )
            ).rows[0].count,
            '4',
          );
          assert.equal(
            (
              await bootstrap.query(
                "SELECT count(*) FROM information_schema.tables WHERE table_schema='lumical' AND table_type='BASE TABLE' AND table_name<>'_prisma_migrations'",
              )
            ).rows[0].count,
            '30',
          );
          assert.equal(
            (
              await bootstrap.query(
                "SELECT count(*) FROM information_schema.columns WHERE table_schema='lumical' AND column_name IN ('password','raw_credential','provider_secret','share_url')",
              )
            ).rows[0].count,
            '0',
          );
          await cli(
            [
              'scripts/prisma.mjs',
              'migrate',
              'diff',
              '--from-config-datasource',
              '--to-schema',
              'prisma/schema.prisma',
              '--exit-code',
            ],
            { MIGRATION_DATABASE_URL: url('migration', 'lumical_i01_blank') },
          );
        },
      );
      for (const name of ['lumical_i01_repeat', 'lumical_i01_upgrade']) {
        // Identifiers are fixed literals; only newly created databases in our owned container.
        await bootstrap.query(`CREATE DATABASE ${name}`);
        const admin = await connection(url('bootstrap', name));
        try {
          await admin.query(`CREATE SCHEMA lumical AUTHORIZATION lumical_migration;
          REVOKE ALL ON DATABASE ${name} FROM PUBLIC;
          GRANT CONNECT,TEMPORARY ON DATABASE ${name} TO lumical_migration;
          GRANT CONNECT ON DATABASE ${name} TO lumical_runtime;
          REVOKE ALL ON SCHEMA public FROM PUBLIC;
          GRANT USAGE ON SCHEMA lumical TO lumical_runtime`);
        } finally {
          await admin.end();
        }
      }
      await check('repeat clean setup and deploy idempotence', async () => {
        const env = {
          MIGRATION_DATABASE_URL: url('migration', 'lumical_i01_repeat'),
        };
        await cli(['scripts/prisma.mjs', 'migrate', 'deploy'], env);
        await cli(['scripts/prisma.mjs', 'migrate', 'deploy'], env);
      });
      await check(
        'supported upgrade preserves initial migration history and data',
        async () => {
          const directory = await mkdtemp(
            path.join(tmpdir(), 'lumical-i01-upgrade-'),
          );
          try {
            const migrations = path.join(directory, 'migrations');
            await cp(
              path.join(backend, 'prisma/migrations', firstMigration),
              path.join(migrations, firstMigration),
              { recursive: true },
            );
            await cp(
              path.join(backend, 'prisma/migrations/migration_lock.toml'),
              path.join(migrations, 'migration_lock.toml'),
            );
            const config = path.join(directory, 'prisma.config.ts');
            await writeFile(
              config,
              `export default {schema:${JSON.stringify(path.join(backend, 'prisma/schema.prisma'))}, migrations:{path:${JSON.stringify(migrations)}}, datasource:{url:process.env.MIGRATION_DATABASE_URL}};`,
            );
            const env = {
              MIGRATION_DATABASE_URL: url('migration', 'lumical_i01_upgrade'),
            };
            await cli(
              [
                'node_modules/prisma/build/index.js',
                'migrate',
                'deploy',
                '--config',
                config,
              ],
              env,
            );
            const migration = await connection(env.MIGRATION_DATABASE_URL);
            try {
              await migration.query(
                "INSERT INTO lumical.users(id,normalized_email,password_hash,updated_at) VALUES ('02000000-0000-4000-8000-000000000001','upgrade@example.invalid','TEST_DISABLED',now())",
              );
            } finally {
              await migration.end();
            }
            await cli(['scripts/prisma.mjs', 'migrate', 'deploy'], env);
            const runtime = await connection(
              url('runtime', 'lumical_i01_upgrade'),
            );
            try {
              assert.equal(
                (await runtime.query('SELECT count(*) FROM lumical.users'))
                  .rows[0].count,
                '1',
              );
            } finally {
              await runtime.end();
            }
          } finally {
            assert.equal(path.dirname(directory), tmpdir());
            assert.ok(
              path.basename(directory).startsWith('lumical-i01-upgrade-'),
            );
            await rm(directory, { recursive: true });
          }
        },
      );
    } finally {
      await bootstrap.end();
    }

    process.env.DATABASE_URL = url('runtime', 'lumical_i01_blank');
    const runtime = await connection(process.env.DATABASE_URL);
    const database = new PrismaDatabase();
    try {
      await check(
        'Prisma runtime seed repeatability and two disabled synthetic owners',
        async () => {
          await seedSynthetic(database);
          const before = await runtime.query(
            'SELECT row_to_json(u) AS data FROM lumical.users u ORDER BY id',
          );
          const beforeCatalog = await runtime.query(
            'SELECT row_to_json(t) AS data FROM lumical.template_revisions t ORDER BY id',
          );
          await seedSynthetic(database);
          assert.deepEqual(
            (
              await runtime.query(
                'SELECT row_to_json(u) AS data FROM lumical.users u ORDER BY id',
              )
            ).rows,
            before.rows,
          );
          assert.deepEqual(
            (
              await runtime.query(
                'SELECT row_to_json(t) AS data FROM lumical.template_revisions t ORDER BY id',
              )
            ).rows,
            beforeCatalog.rows,
          );
          assert.equal(before.rows.length, 2);
          assert.ok(
            before.rows.every(
              ({ data }) =>
                data.status === 'DISABLED' &&
                data.password_hash === 'SYNTHETIC_DISABLED_NO_USABLE_PASSWORD',
            ),
          );
        },
      );
      const owner = syntheticIds.owners[0];
      const other = syntheticIds.owners[1];
      const project = await projectFixture(
        runtime,
        owner,
        syntheticIds.revision,
      );
      const otherProject = await projectFixture(
        runtime,
        other,
        syntheticIds.revision,
      );
      const readyMedia = await mediaFixture(runtime, owner, 'READY');
      const otherMedia = await mediaFixture(runtime, other);
      const artifact = await artifactFixture(runtime, project, owner, 'READY');
      const month = randomUUID();
      await runtime.query(
        'INSERT INTO lumical.calendar_months(id,project_id,month_number) VALUES($1,$2,1)',
        [month, project],
      );
      const order = await orderFixture(runtime, project, owner);
      const version = randomUUID();
      await runtime.query(
        `INSERT INTO lumical.order_calendar_versions(id,order_id,owner_id,project_id,source_project_revision,year,title,dedication,template_revision_id,template_name_vi,template_name_en,style_definition)
      VALUES($1,$2,$3,$4,1,2027,'TEST ONLY','Synthetic',$5,'Mẫu','Synthetic','{}')`,
        [version, order, owner, project, syntheticIds.revision],
      );

      await check(
        'normalized email unique/check, FK ownership, month range/uniqueness, civil dates',
        async () => {
          const insert =
            "INSERT INTO lumical.users(id,normalized_email,password_hash,updated_at) VALUES($1,$2,'TEST_ONLY',now())";
          await rejectsSql(
            runtime,
            insert,
            [randomUUID(), 'synthetic-owner-1@example.invalid'],
            '23505',
          );
          await rejectsSql(
            runtime,
            insert,
            [randomUUID(), 'MixedCase@example.invalid'],
            '23514',
          );
          await rejectsSql(
            runtime,
            'INSERT INTO lumical.calendar_months(id,project_id,month_number) VALUES($1,$2,1)',
            [randomUUID(), randomUUID()],
            '23503',
          );
          await rejectsSql(
            runtime,
            'INSERT INTO lumical.calendar_months(id,project_id,month_number) VALUES($1,$2,13)',
            [randomUUID(), project],
            '23514',
          );
          await rejectsSql(
            runtime,
            'INSERT INTO lumical.calendar_months(id,project_id,month_number) VALUES($1,$2,1)',
            [randomUUID(), project],
            '23505',
          );
          await rejectsSql(
            runtime,
            `INSERT INTO lumical.project_month_media(id,project_id,owner_id,month_id,asset_id,position,alt_text) VALUES($1,$2,$3,$4,$5,0,'TEST ONLY')`,
            [randomUUID(), project, owner, month, otherMedia],
            '23503',
          );
          await rejectsSql(
            runtime,
            `INSERT INTO lumical.project_month_media(id,project_id,owner_id,month_id,asset_id,position,alt_text) VALUES($1,$2,$3,$4,$5,0,'TEST ONLY')`,
            [randomUUID(), otherProject, other, month, otherMedia],
            '23503',
          );
          await rejectsSql(
            runtime,
            `INSERT INTO lumical.special_dates(id,project_id,event_date,title) VALUES($1,$2,'2027-02-30','TEST ONLY')`,
            [randomUUID(), project],
            '22008',
          );
          await rejectsSql(
            runtime,
            `INSERT INTO lumical.media_assets(id,owner_id,category,status,upload_intent_id,storage_reference,content_type,verified_at) VALUES($1,$2,'IMAGE','READY',$3,'test-only:null-byte-count','image/png',now())`,
            [randomUUID(), owner, randomUUID()],
            '23514',
          );
        },
      );
      await check(
        'exact USD money, quantity, safe integer, zero adjustment and total checks',
        async () => {
          const insert = `INSERT INTO lumical.orders(id,owner_id,project_id,checkout_intent_id,quantity,unit_price_minor,total_minor,currency,discount_minor,tax_minor,shipping_minor,contact_name,contact_email,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,0,0,'Synthetic','synthetic@example.invalid',now())`;
          const intent = (
            await runtime.query(
              'SELECT checkout_intent_id FROM lumical.orders WHERE id=$1',
              [order],
            )
          ).rows[0].checkout_intent_id;
          for (const [quantity, unit, total, currency, discount] of [
            [0, 1450, 0, 'USD', 0],
            [11, 1450, 15950, 'USD', 0],
            [2, 1450, 2901, 'USD', 0],
            [2, 1450, 2900, 'EUR', 0],
            [2, 1450, 2900, 'USD', 1],
            [1, '9007199254740992', '9007199254740992', 'USD', 0],
          ]) {
            await rejectsSql(
              runtime,
              insert,
              [
                randomUUID(),
                owner,
                project,
                intent,
                quantity,
                unit,
                total,
                currency,
                discount,
              ],
              '23514',
            );
          }
          assert.equal(
            (
              await database.client.order.findUniqueOrThrow({
                where: { id: order },
              })
            ).totalMinor,
            2900n,
          );
        },
      );
      await check(
        'least privilege, immutable history, restricted deletion and mutable current work',
        async () => {
          const privileges = (
            await runtime.query(
              'SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user',
            )
          ).rows[0];
          assert.deepEqual(privileges, {
            rolsuper: false,
            rolcreatedb: false,
            rolcreaterole: false,
          });
          for (const sql of [
            'CREATE TABLE lumical.forbidden(id integer)',
            'CREATE TABLE public.forbidden(id integer)',
            'ALTER TABLE lumical.users ADD COLUMN forbidden text',
            'TRUNCATE lumical.orders',
            'SELECT * FROM lumical._prisma_migrations',
            'SET ROLE lumical_migration',
          ]) {
            await rejectsSql(runtime, sql, [], '42501');
          }
          for (const table of [
            'template_revisions',
            'order_calendar_versions',
            'order_month_snapshots',
            'order_special_date_snapshots',
            'order_media_references',
            'order_ar_snapshots',
            'payment_settlements',
            'fulfillment_events',
            'admin_audit_events',
          ]) {
            await rejectsSql(
              runtime,
              `DELETE FROM lumical.${table}`,
              [],
              '42501',
            );
            const column =
              table === 'template_revisions'
                ? 'name_en'
                : table === 'order_month_snapshots'
                  ? 'caption'
                  : table === 'order_special_date_snapshots'
                    ? 'title'
                    : table === 'order_media_references'
                      ? 'accessible_text'
                      : table === 'order_ar_snapshots'
                        ? 'readable_text'
                        : table === 'payment_settlements'
                          ? 'capture_reference'
                          : table === 'fulfillment_events'
                            ? 'reason'
                            : table === 'admin_audit_events'
                              ? 'action'
                              : 'title';
            await rejectsSql(
              runtime,
              `UPDATE lumical.${table} SET ${column}='forbidden'`,
              [],
              '42501',
            );
          }
          await runtime.query(
            "UPDATE lumical.calendar_projects SET title='Edited current work',updated_at=now() WHERE id=$1",
            [project],
          );
          assert.equal(
            (
              await runtime.query(
                'SELECT title FROM lumical.order_calendar_versions WHERE id=$1',
                [version],
              )
            ).rows[0].title,
            'TEST ONLY',
          );
          await runtime.query(
            "UPDATE lumical.orders SET status='CANCELLED',version=version+1,updated_at=now() WHERE id=$1",
            [order],
          );
          await rejectsSql(
            runtime,
            'DELETE FROM lumical.calendar_projects WHERE id=$1',
            [project],
            '23503',
          );
          await rejectsSql(
            runtime,
            'UPDATE lumical.calendar_projects SET owner_id=$1 WHERE id=$2',
            [other, project],
            '42501',
          );
          await rejectsSql(
            runtime,
            "UPDATE lumical.media_assets SET storage_reference='forbidden' WHERE id=$1",
            [readyMedia],
            '23514',
          );
          await rejectsSql(
            runtime,
            "UPDATE lumical.ar_target_artifacts SET artifact_reference='forbidden' WHERE id=$1",
            [artifact],
            '23514',
          );
          await runtime.query(
            "UPDATE lumical.media_assets SET status='UNAVAILABLE' WHERE id=$1",
            [readyMedia],
          );
          await runtime.query(
            "UPDATE lumical.ar_target_artifacts SET status='UNAVAILABLE' WHERE id=$1",
            [artifact],
          );
        },
      );
      await check(
        'immutable snapshot children and media/artifact reference deletion',
        async () => {
          const snapshotMonth = randomUUID();
          const reference = randomUUID();
          await runtime.query(
            "INSERT INTO lumical.order_month_snapshots(id,version_id,month_number,layout) VALUES($1,$2,1,'{}')",
            [snapshotMonth, version],
          );
          await rejectsSql(
            runtime,
            "INSERT INTO lumical.order_media_references(id,version_id,owner_id,project_id,month_id,asset_id,purpose,accessible_text) VALUES($1,$2,$3,$4,$5,$6,'MONTH_IMAGE','TEST ONLY')",
            [randomUUID(), version, owner, project, snapshotMonth, readyMedia],
            '23514',
          );
          await runtime.query(
            "INSERT INTO lumical.order_media_references(id,version_id,owner_id,project_id,month_id,asset_id,purpose,position,accessible_text) VALUES($1,$2,$3,$4,$5,$6,'MONTH_IMAGE',0,'TEST ONLY')",
            [reference, version, owner, project, snapshotMonth, readyMedia],
          );
          const reveal = randomUUID();
          await runtime.query(
            "INSERT INTO lumical.order_media_references(id,version_id,owner_id,project_id,asset_id,purpose,accessible_text) VALUES($1,$2,$3,$4,$5,'AR_REVEAL','TEST ONLY')",
            [reveal, version, owner, project, readyMedia],
          );
          await runtime.query(
            "INSERT INTO lumical.order_ar_snapshots(id,version_id,owner_id,project_id,target_artifact_id,reveal_reference_id,readable_text,fallback_representation) VALUES($1,$2,$3,$4,$5,$6,'TEST ONLY','{}')",
            [randomUUID(), version, owner, project, artifact, reveal],
          );
          await rejectsSql(
            runtime,
            'DELETE FROM lumical.media_assets WHERE id=$1',
            [readyMedia],
            '23503',
          );
          await rejectsSql(
            runtime,
            'DELETE FROM lumical.ar_target_artifacts WHERE id=$1',
            [artifact],
            '23503',
          );
        },
      );
      await check(
        'one unresolved payment and unique order-bound settlement',
        async () => {
          const attempt = randomUUID();
          const insert =
            "INSERT INTO lumical.payment_attempts(id,order_id,provider,environment,updated_at) VALUES($1,$2,'TEST_ONLY','SANDBOX',now())";
          await runtime.query(insert, [attempt, order]);
          await rejectsSql(runtime, insert, [randomUUID(), order], '23505');
          await runtime.query(
            "UPDATE lumical.payment_attempts SET status='FAILED',updated_at=now() WHERE id=$1",
            [attempt],
          );
          const second = randomUUID();
          await runtime.query(insert, [second, order]);
          const settle =
            "INSERT INTO lumical.payment_settlements(id,order_id,attempt_id,provider,environment,capture_reference,amount_minor,evidence_summary,completed_at) VALUES($1,$2,$3,'TEST_ONLY','SANDBOX',$4,2900,'{\"testOnly\":true}',now())";
          await rejectsSql(
            runtime,
            settle,
            [randomUUID(), order, randomUUID(), randomUUID()],
            '23503',
          );
          const unrelatedOrder = await orderFixture(
            runtime,
            otherProject,
            other,
          );
          await rejectsSql(
            runtime,
            settle,
            [randomUUID(), unrelatedOrder, second, randomUUID()],
            '23503',
          );
          await runtime.query(settle, [
            randomUUID(),
            order,
            second,
            randomUUID(),
          ]);
          await rejectsSql(
            runtime,
            settle,
            [randomUUID(), order, second, randomUUID()],
            '23505',
          );
        },
      );
      await check(
        'share generations preserve old lease records; scoped access and durable identities',
        async () => {
          const share = randomUUID();
          const lease = randomUUID();
          await runtime.query(
            "INSERT INTO lumical.recipient_shares(id,order_id,credential_digest) VALUES($1,$2,'test-digest-one')",
            [share, order],
          );
          await runtime.query(
            "INSERT INTO lumical.recipient_access_sessions(id,share_id,order_id,order_version_id,generation,lease_digest,csrf_digest,expires_at) VALUES($1,$2,$3,$4,1,'test-lease-digest','test-csrf-digest',now()+interval '1 hour')",
            [lease, share, order, version],
          );
          await runtime.query(
            "UPDATE lumical.recipient_shares SET generation=2,version=2,credential_digest='test-digest-two' WHERE id=$1",
            [share],
          );
          assert.equal(
            (
              await runtime.query(
                'SELECT generation FROM lumical.recipient_access_sessions WHERE id=$1',
                [lease],
              )
            ).rows[0].generation,
            1,
          );
          await rejectsSql(
            runtime,
            "INSERT INTO lumical.recipient_access_sessions(id,share_id,order_id,order_version_id,generation,lease_digest,csrf_digest,expires_at) VALUES($1,$2,$3,$4,2,'test-lease-too-long','test-csrf',now()+interval '25 hours')",
            [randomUUID(), share, order, version],
            '23514',
          );
          const inspection = randomUUID();
          const inspect =
            "INSERT INTO lumical.admin_content_access(id,admin_id,order_id,purpose,reason,expires_at) VALUES($1,$2,$3,$4,'TEST ONLY',now()+interval '5 minutes')";
          await runtime.query(inspect, [
            inspection,
            owner,
            order,
            'ORDER_SUPPORT',
          ]);
          await rejectsSql(
            runtime,
            inspect,
            [randomUUID(), owner, order, 'DRAFT_BROWSING'],
            '23514',
          );
          await runtime.query(
            "INSERT INTO lumical.admin_audit_events(id,actor_id,inspection_id,action,target_type,target_id,outcome,purpose,correlation_id) VALUES($1,$2,$3,'TEST_ONLY','ORDER',$4,'TEST_ONLY','ORDER_SUPPORT','test-correlation')",
            [randomUUID(), owner, inspection, order],
          );
          const fulfillment = randomUUID();
          await runtime.query(
            'INSERT INTO lumical.fulfillments(id,order_id,updated_at) VALUES($1,$2,now())',
            [fulfillment, order],
          );
          await runtime.query(
            "INSERT INTO lumical.fulfillment_events(id,fulfillment_id,actor_id,previous_status,next_status,reason,correlation_id) VALUES($1,$2,$3,'WAITING_FOR_PAYMENT','PREPARING','TEST ONLY','test-correlation')",
            [randomUUID(), fulfillment, owner],
          );
          const idem =
            "INSERT INTO lumical.idempotency_records(id,actor_id,operation,key,request_digest,condition) VALUES($1,$2,'TEST_ONLY','test-key','test-digest','test-condition')";
          await runtime.query(idem, [randomUUID(), owner]);
          await rejectsSql(runtime, idem, [randomUUID(), owner], '23505');
          await rejectsSql(
            runtime,
            'UPDATE lumical.idempotency_records SET encrypted_replay=$1 WHERE actor_id=$2',
            [Buffer.from('TEST ONLY encrypted placeholder'), owner],
            '23514',
          );
          await rejectsSql(
            runtime,
            "UPDATE lumical.idempotency_records SET encrypted_replay=$1,replay_expires_at=created_at+interval '25 hours' WHERE actor_id=$2",
            [Buffer.from('TEST ONLY encrypted placeholder'), owner],
            '23514',
          );
          const inbox =
            "INSERT INTO lumical.provider_event_inbox(id,provider,environment,event_id,evidence_summary,condition,verified_at) VALUES($1,'TEST_ONLY','SANDBOX','test-event','{\"testOnly\":true}','test-condition',now())";
          await runtime.query(inbox, [randomUUID()]);
          await rejectsSql(runtime, inbox, [randomUUID()], '23505');
          const job =
            "INSERT INTO lumical.job_records(id,kind,object_id,operation_identity,condition,due_at,updated_at) VALUES($1,'TEST_ONLY',$2,'test-operation','test-condition',now(),now())";
          await runtime.query(job, [randomUUID(), order]);
          await rejectsSql(runtime, job, [randomUUID(), order], '23505');
        },
      );
      await check(
        'Prisma transaction context shares one connection and rolls back all writes',
        async () => {
          const transactions = new PrismaTransactions(database);
          let saved;
          const rollbackId = randomUUID();
          await assert.rejects(
            transactions.run(async (context) => {
              saved = context;
              // Two future repository adapters obtain the exact same scoped client.
              const first = transactions.clientFor(context);
              const second = transactions.clientFor(context);
              assert.equal(first, second);
              await first.calendarMonth.create({
                data: { id: rollbackId, projectId: project, monthNumber: 2 },
              });
              assert.equal(
                await second.calendarMonth.count({ where: { id: rollbackId } }),
                1,
              );
              throw new Error('deliberate rollback');
            }),
            /deliberate rollback/,
          );
          assert.equal(
            await database.client.calendarMonth.count({
              where: { id: rollbackId },
            }),
            0,
          );
          assert.throws(() => transactions.clientFor(saved), /not active/);
          assert.throws(
            () => transactions.clientFor({ scope: Symbol() }),
            /not active/,
          );
          await transactions.run(async (context) => {
            await transactions.clientFor(context).calendarMonth.createMany({
              data: Array.from({ length: 12 }, (_, index) => ({
                projectId: otherProject,
                monthNumber: index + 1,
              })),
            });
          });
          assert.equal(
            await database.client.calendarMonth.count({
              where: { projectId: otherProject },
            }),
            12,
          );
        },
      );
      await check(
        'nested Prisma run joins one context: outer rollback removes both writes',
        async () => {
          const transactions = new PrismaTransactions(database);
          const ids = [randomUUID(), randomUUID()];
          const job = (id) => ({
            id,
            kind: 'TEST_ONLY',
            objectId: project,
            operationIdentity: id,
            condition: 'TEST_ONLY',
            dueAt: new Date(),
          });
          let outerContext;
          let innerContext;
          await assert.rejects(
            transactions.run(async (context) => {
              outerContext = context;
              await transactions
                .clientFor(context)
                .jobRecord.create({ data: job(ids[0]) });
              await transactions.run(async (nested) => {
                innerContext = nested;
                assert.equal(nested, context);
                assert.equal(
                  transactions.clientFor(nested),
                  transactions.clientFor(context),
                );
                await transactions
                  .clientFor(nested)
                  .jobRecord.create({ data: job(ids[1]) });
              });
              assert.equal(
                await database.client.jobRecord.count({
                  where: { id: { in: ids } },
                }),
                0,
              );
              throw new Error('outer rollback after nested work');
            }),
            /outer rollback after nested work/,
          );
          assert.equal(
            await database.client.jobRecord.count({
              where: { id: { in: ids } },
            }),
            0,
          );
          assert.throws(
            () => transactions.clientFor(outerContext),
            /not active/,
          );
          assert.throws(
            () => transactions.clientFor(innerContext),
            /not active/,
          );

          await transactions.run(async (context) => {
            await transactions
              .clientFor(context)
              .jobRecord.create({ data: job(ids[0]) });
            await transactions.run(async (nested) => {
              assert.equal(nested, context);
              await transactions
                .clientFor(nested)
                .jobRecord.create({ data: job(ids[1]) });
            });
            assert.equal(
              await database.client.jobRecord.count({
                where: { id: { in: ids } },
              }),
              0,
            );
          });
          assert.equal(
            await database.client.jobRecord.count({
              where: { id: { in: ids } },
            }),
            2,
          );
        },
      );
      await check(
        'concurrent async chains have independent contexts and commit/rollback outcomes',
        async () => {
          const transactions = new PrismaTransactions(database);
          const contexts = [];
          const clients = [];
          const ids = [randomUUID(), randomUUID()];
          let arrivals = 0;
          let release;
          const barrier = new Promise((resolve) => {
            release = resolve;
          });
          const outcomes = await Promise.allSettled(
            ids.map((id, index) =>
              transactions.run(async (context) => {
                contexts[index] = context;
                clients[index] = transactions.clientFor(context);
                assert.throws(
                  () => new PrismaTransactions(database).clientFor(context),
                  /not active/,
                );
                arrivals += 1;
                if (arrivals === 2) release();
                await barrier;
                await transactions.run(async (nested) => {
                  assert.equal(nested, context);
                  await transactions.clientFor(nested).jobRecord.create({
                    data: {
                      id,
                      kind: 'TEST_ONLY',
                      objectId: project,
                      operationIdentity: id,
                      condition: 'TEST_ONLY',
                      dueAt: new Date(),
                    },
                  });
                });
                if (index === 0)
                  throw new Error('only the first chain rolls back');
              }),
            ),
          );
          assert.notEqual(contexts[0], contexts[1]);
          assert.notEqual(clients[0], clients[1]);
          assert.equal(outcomes[0].status, 'rejected');
          assert.match(outcomes[0].reason.message, /first chain rolls back/);
          assert.equal(outcomes[1].status, 'fulfilled');
          assert.equal(
            await database.client.jobRecord.count({ where: { id: ids[0] } }),
            0,
          );
          assert.equal(
            await database.client.jobRecord.count({ where: { id: ids[1] } }),
            1,
          );
        },
      );
      await check(
        'an async descendant cannot reopen a finished transaction context',
        async () => {
          const transactions = new PrismaTransactions(database);
          const id = randomUUID();
          let release;
          let inherited;
          let callbackEntered = false;
          const barrier = new Promise((resolve) => {
            release = resolve;
          });
          await transactions.run(async () => {
            inherited = (async () => {
              await barrier;
              return transactions.run(async (context) => {
                callbackEntered = true;
                await transactions.clientFor(context).jobRecord.create({
                  data: {
                    id,
                    kind: 'TEST_ONLY',
                    objectId: project,
                    operationIdentity: id,
                    condition: 'TEST_ONLY',
                    dueAt: new Date(),
                  },
                });
              });
            })();
          });
          release();
          await assert.rejects(inherited, /not active/);
          assert.equal(callbackEntered, false);
          assert.equal(
            await database.client.jobRecord.count({ where: { id } }),
            0,
          );
        },
      );
      await check(
        'deterministic concurrent checkout uniqueness using a barrier (no race sleeps)',
        async () => {
          const clients = await Promise.all([
            connection(process.env.DATABASE_URL),
            connection(process.env.DATABASE_URL),
          ]);
          let arrivals = 0;
          let release;
          const barrier = new Promise((resolve) => {
            release = resolve;
          });
          try {
            const results = await Promise.allSettled(
              clients.map(async (client) => {
                await client.query('BEGIN');
                arrivals += 1;
                if (arrivals === 2) release();
                await barrier;
                try {
                  await client.query(
                    "INSERT INTO lumical.checkout_intents(id,owner_id,project_id,project_revision,request_digest,canonical_request) VALUES($1,$2,$3,42,'test-digest','{}')",
                    [randomUUID(), owner, project],
                  );
                  await client.query('COMMIT');
                } catch (error) {
                  await client.query('ROLLBACK');
                  throw error;
                }
              }),
            );
            assert.equal(
              results.filter((result) => result.status === 'fulfilled').length,
              1,
            );
            assert.equal(
              results.find((result) => result.status === 'rejected').reason
                .code,
              '23505',
            );
          } finally {
            await Promise.all(clients.map((client) => client.end()));
          }
        },
      );
      await check(
        'real PostgreSQL missing SELECT/schema access returns readiness 503 and is restored',
        async () => {
          const migration = await connection(
            url('migration', 'lumical_i01_blank'),
          );
          const module = await Test.createTestingModule({
            imports: [AppModule],
          }).compile();
          const app = module.createNestApplication();
          configureApp(app);
          await app.init();
          try {
            await request(app.getHttpServer())
              .get('/api/v1/health/ready')
              .expect(200)
              .expect({ ready: true });
            for (const privilege of [
              'SELECT ON TABLE lumical.users',
              'USAGE ON SCHEMA lumical',
            ]) {
              await migration.query(`REVOKE ${privilege} FROM lumical_runtime`);
              try {
                await rejectsSql(
                  runtime,
                  'SELECT 1 FROM lumical.users LIMIT 0',
                  [],
                  '42501',
                );
                await request(app.getHttpServer())
                  .get('/api/v1/health/ready')
                  .expect(503)
                  .expect({ ready: false });
                await request(app.getHttpServer())
                  .get('/api/v1/health/live')
                  .expect(200)
                  .expect({ alive: true });
              } finally {
                await migration.query(`GRANT ${privilege} TO lumical_runtime`);
              }
              await request(app.getHttpServer())
                .get('/api/v1/health/ready')
                .expect(200)
                .expect({ ready: true });
            }
          } finally {
            await app.close();
            await migration.end();
          }
        },
      );
      await check(
        'real PostgreSQL readiness, liveness, redacted missing/invalid/unavailable configuration',
        async () => {
          for (const [value, ready] of [
            [process.env.DATABASE_URL, true],
            [undefined, false],
            [
              'postgresql://lumical_migration:PRIVATE_SECRET@PRIVATE_HOST/private',
              false,
            ],
            [
              'postgresql://lumical_runtime:PRIVATE_SECRET@127.0.0.1:1/private?schema=lumical',
              false,
            ],
          ]) {
            if (value === undefined) delete process.env.DATABASE_URL;
            else process.env.DATABASE_URL = value;
            const module = await Test.createTestingModule({
              imports: [AppModule],
            }).compile();
            const app = module.createNestApplication();
            configureApp(app);
            await app.init();
            try {
              await request(app.getHttpServer())
                .get('/api/v1/health/live')
                .expect(200)
                .expect({ alive: true });
              await request(app.getHttpServer())
                .get('/api/v1/health/ready')
                .expect(ready ? 200 : 503)
                .expect({ ready });
            } finally {
              await app.close();
            }
          }
        },
      );
    } finally {
      await runtime.end();
      await database.onModuleDestroy();
      delete process.env.DATABASE_URL;
    }
  });
  console.log('PASS: I01 real PostgreSQL integration gate.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
