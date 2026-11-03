# I04-P05 --- Catalog Revision and Baseline Integration Proof

## 1. Task Information

| Item | Details |
|---|---|
| Task | I04-P05 --- Catalog revision and baseline integration proof |
| Owner | MEMBER_3 |
| Reviewer | LEAD |
| Role | Tester |
| Report Status | PARTIAL PASS --- Insufficient evidence to formally accept the entire P05 task |

## 2. Objective

Verify that changes to the status or version of the Template Catalog do not alter historical data already stored in a Project. Also verify behavior when a Template is unavailable and the immutability of Published Revisions.

## 3. Test Environment and Commands

- Directory: `C:\prj\Lumical\backend`
- Command: `pnpm.cmd test:db`
- Database: PostgreSQL used for integration tests; the test script creates and cleans up a temporary database/container.
- Prisma Client generation and Nest build: successful.
- Result: Tests in the `test:db` sequence finished with PASS results; no errors interrupted the sequence.

## 4. Test Results

### 4.1 Build and Migration --- PASS

The following were confirmed:

- Prisma Client generation and backend build completed successfully.
- All 6 migrations were applied to an empty database.
- Migration history and Prisma schema alignment were verified.
- Clean setup and deployment idempotence were verified.
- The supported upgrade preserved the migration history and initial data.
- The `TemplateCategory` migration requires explicit mapping when legacy Templates without a category are detected.
- Prisma runtime seed repeatability was verified.

### 4.2 I01 --- PostgreSQL Integration Gate --- PASS

The logs confirm the following test groups:

- Public catalog availability, category, filtering, stable cursor, projection, and revision immutability.
- Foreign-key ownership, month range/uniqueness, and civil dates.
- Money, quantity, safe integer, and total checks.
- Least privilege, immutable history, restricted deletion, and mutable current work.
- Immutable snapshot children and media/artifact reference deletion.
- Transaction context, rollback, and concurrent asynchronous transaction behavior.
- PostgreSQL readiness, liveness, and handling of missing, invalid, or unavailable configuration.

The log ends with:

`PASS: I01 real PostgreSQL integration gate.`

### 4.3 I02 --- Identity / Session / Security Gate --- PASS

The logs confirm registration, uniqueness, session/CSRF, cookie flags, Origin validation, login/logout, session revocation/expiry, Admin authorization, audit, idempotency, concurrency, security suspension, and gateway isolation.

The log ends with:

`PASS: I02 real PostgreSQL identity/session/security gate.`

### 4.4 I04-P02 --- Catalog Publication / Availability --- PASS

The logs confirm:

- Creation of an INACTIVE Template with its first immutable revision and flat preset row.
- Rejection of mutations when Admin permission, CSRF, or a valid Origin is missing.
- Enforcement of If-Match and handling of stale versions.
- Correct state transitions; only complete ACTIVE Templates are included in the P01 read path.
- Admin listing supports cursors and filtering by state.
- Corrupt publications are not activated.
- Publishing creates a new immutable numbered revision, updates the pointer, and does not overwrite history.
- Idempotency keys and concurrent mutations result in only one mutation.
- Audit failure rolls back the availability change and idempotency record.

The log ends with:

`PASS: I04-P02 real PostgreSQL audited publication/availability gate.`

## 5. Assessment Against I04-P05 Acceptance Criteria

| Criterion | Result | Evidence / Limitation |
|---|---|---|
| Inactive Template selection returns a safe failure | PASS within the public catalog test scope | `catalog.get` returns 404 and the list excludes inactive Templates. There is no evidence yet for the Project-creation-from-Catalog endpoint. |
| Published Revision fields cannot be mutated | PASS | The test confirms that UPDATE operations on `template_revisions` are rejected; historical tables are protected against UPDATE/DELETE. |
| Catalog changes do not alter the Project's captured baseline | NOT VERIFIED / BLOCKED | No test proves that a Project is created by reading a Published Revision and then storing its baseline. The current fixture directly INSERTs fixed baseline data. |

### 5.1 Historical Data Evidence Reviewed

In `backend/scripts/test-database.mjs`:

- The public catalog test checks availability and revision immutability.
- `projectFixture()` is used to create a Project fixture.
- `order_calendar_versions` is populated using snapshot data prepared in the test.
- The test updates `calendar_projects.title` and confirms that `order_calendar_versions.title` remains `TEST ONLY`.
- Tests protect historical tables against UPDATE/DELETE.

These checks demonstrate part of revision immutability and order snapshot immutability. They **do not prove** that the Project baseline is retrieved from a Published Revision at creation time, or that the Project baseline remains unchanged after the Catalog changes.

### 5.2 Limitations of the Project Fixture

The `projectFixture()` fixture in `backend/test/database/fixtures.mjs` directly INSERTs baseline fields such as:

- `baseline_name_vi`
- `baseline_name_en`
- `baseline_style`
- `style_preset_id`
- `unit_price_minor`
- `template_revision_id`

Because these values are supplied directly during the fixture INSERT, the fixture only proves that the database can store those fields. It does not prove that the Project-creation business flow reads the data from a Published Revision.

## 6. Tests Still Required to Close P05

An integrated Project--Catalog test flow must be provided or confirmed by the developer/LEAD:

1. Create and publish Template Revision 1 with identifiable values.
2. Create a Project through the business flow/API using the ACTIVE Template.
3. Read and record the Project's `template_revision_id` and baseline fields.
4. Change the Catalog by publishing Revision 2 with a different name/style/unit price, or by changing the Template to INACTIVE.
5. Read the original Project again.
6. Compare it with the data recorded in step 3.

**Expected result:** The original Project must retain Revision 1 and the baseline values captured at creation time. Changes to the Catalog must not automatically overwrite the baseline of an existing Project.

The tester will not modify code or add tests independently as part of this report. The LEAD/developer must provide the Project-creation endpoint/flow and the corresponding test so that verification can be performed.

## 7. Frontend / T21

According to the frontend results previously discussed:

- Frontend unit tests: 14 test files / 87 tests passed.
- Frontend build: successful; TypeScript and 11 static pages completed.
- Visual tests: 4/4 Chromium visual tests passed.
- Manual viewport and accessibility checks were reported as PASS by the tester during the discussion.


## 8. Conclusion

**Status: PARTIAL PASS --- I04-P05 cannot yet be confirmed as complete.**

`pnpm.cmd test:db` ran successfully, including build, migration, I01, I02, and I04-P02. The existing checks support verification of Template availability, Published Revision immutability, and part of historical snapshot immutability.

However, the criteria for creating a Project from a Published Revision and preserving its captured baseline when the Catalog changes have not yet been verified with test evidence.

### Items Requiring Confirmation from the LEAD/developer

- Provide or identify the flow/API for creating a Project from a Published Revision.
- Provide an integration test verifying that baseline fields are captured at the time the Project is created.
- Provide a test proving that an existing Project remains unchanged after the Catalog publishes a new revision or the Template becomes INACTIVE.

Once the flow and evidence above are available, the tester can perform the remaining verification and update the P05 acceptance status.

---

## Appendix --- Key Confirmation Logs

Representative PASS lines from the `pnpm.cmd test:db` run:

```text
PASS: empty database → latest reviewed migrations
PASS: migration history, exact P0 table set and Prisma schema alignment
PASS: repeat clean setup and deploy idempotence
PASS: supported upgrade preserves initial migration history and data
PASS: pending TemplateCategory migrations require explicit mapping for legacy Templates
PASS: PostgreSQL public catalog availability, category, filtering, stable cursor, projection and revision immutability
PASS: least privilege, immutable history, restricted deletion and mutable current work
PASS: I01 real PostgreSQL integration gate.
PASS: I02 real PostgreSQL identity/session/security gate.
PASS: I04-P02 real PostgreSQL audited publication/availability gate.
```

*This report is based on the test logs and the test/fixture sections that were reviewed. Criteria without supporting evidence have not been marked as PASS.*