# I05-P06 — Implementation and Test Verification Report

**Project:** LumiCal  
**Source branch:** `dev` (source archive supplied for implementation)  
**Task:** I05-P06 — Core Project Invariant Integration Proof  
**Integration test result:** **PASSED — 11/11 checks**  
**Evidence:** PowerShell console output provided by the user (November 9, 2026, Vietnam time)

## 1. Objective

Verify that the Calendar Project REST lifecycle preserves critical data and authorization invariants, including ownership boundaries, exactly twelve Months per Project, safe concurrent writes, year-to-year isolation, Template snapshot preservation, and deletion safeguards.

## 2. Implementation Scope

The delivery changes only two files; no production application code was changed.

| File | Change | Description |
| --- | --- | --- |
| `backend/scripts/test-project-rest.mjs` | Modified | Added integration scenarios for future-year isolation and Template deactivation with existing-Project preservation. |
| `docs/verification/I05-P06.md` | Added | Documented the invariant coverage matrix, verification steps, I07 child-version contract, and acceptance checklist. |

### 2.1 Future-year isolation

The added scenario verifies that a new calendar year creates a distinct Project and independent set of twelve Months, while the prior year's Project remains unchanged and unauthorized owners cannot access the new Project.

### 2.2 Inactive Template and existing-Project preservation

The added scenario verifies that an inactive Template prevents new Project creation without invalidating the baseline captured by an existing Project. The existing Project must remain readable and editable, and the test restores Template availability during cleanup.

## 3. Test Environment and Command

The user executed the tests on Windows PowerShell with:

- **Node.js:** `v24.22.0`
- **Package manager:** pnpm invoked through Corepack
- **Database:** Disposable PostgreSQL container managed by the test script

```powershell
cd C:\prj\Lumical\backend
corepack.cmd pnpm run test:project-rest
```

The test command ran the backend build (including Prisma Client generation) and then the Project REST integration script:

```text
$ pnpm build && node scripts/test-project-rest.mjs
$ pnpm db:generate && nest build
$ node scripts/prisma.mjs generate
Prisma Client (7.10.0) generated successfully
```

## 4. Execution Results

All eleven checks reported `PASS` in the console output supplied by the user.

| # | Integration check | Result |
| --- | --- | --- |
| 1 | Project creation persists baseline, twelve Months, and a safe response body | PASS |
| 2 | Creation validation, session guards, and duplicate intents are handled safely | PASS |
| 3 | Owner list is cursor-paginated and scoped before filtering | PASS |
| 4 | Project read, preconditions, and owner isolation follow the contract | PASS |
| 5 | Archive, restore, and repeated lifecycle actions remain safe | PASS |
| 6 | Month listing returns twelve ordered Months and the Project version | PASS |
| 7 | Replayed creation returns the original bound outcome | PASS |
| 8 | Two concurrent mutations against the same version commit exactly once | PASS |
| 9 | Creating a future-year Project does not alter an existing calendar or reuse its Months | PASS |
| 10 | Deletion requires confirmation, rejects Order history, and removes only Project rows | PASS |
| 11 | Inactive Template blocks new Projects while an existing owner's captured baseline survives | PASS |

**Summary:** 11 passed; 0 failed; 0 blocked within this script.

**Cleanup:** The script reported `PASS: removed only this run’s disposable PostgreSQL container.`

## 5. Resolution of Earlier Execution Issues

An earlier direct invocation of `node.exe scripts/test-project-rest.mjs` failed with `expected 201 "Created", got 404 "Not Found"`. After building the backend and invoking the project's `test:project-rest` script, all eleven checks passed. The earlier error is therefore not reproduced in the successful verified run; the log does not by itself establish a definitive root cause.

## 6. Acceptance Assessment and Limitations

**Result for the Project REST integration suite:** **PASS.** The console output supports the I05-P06 integration coverage exercised by `test:project-rest`, including the two newly added scenarios.

This report does **not** claim that all LumiCal checks or every I05-P06 acceptance dependency passed. The provided execution evidence does not include a complete frontend, browser/Playwright, lint, typecheck, or repository-wide test run. Review any additional acceptance criteria in `docs/verification/I05-P06.md` before marking the entire task complete.

## 7. Delivery Notes

The separate `I05-P06-changed-files-only.zip` archive includes only the two changed paths listed in Section 2, preserving their relative paths. The implementation was delivered as an archive; no GitHub push is claimed.
