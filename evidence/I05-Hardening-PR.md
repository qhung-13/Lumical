# fix(i05): harden project lifecycle, privacy and integration

Lifecycle confirmations could overlap, and private creation drafts survived logout after leaving the workspace. This change retains the audited guards/privacy fixes, restores keyboard focus after lifecycle completion, and prevents a browser-local New Year from blocking a creation year accepted by the backend's configured Clock/timezone.

## Scope and fixes

- I05-P01–P06 hardening only; BR-PRJ-001–007, INV-01/02/03/11/14, T01–T04/T24 within I05.
- Synchronous lifecycle guard spans mutation plus authoritative refresh; shared Dialog disables repeat confirmation. A stale 412 refreshes state/version without automatically resending.
- Draft store watches logout/account boundaries after route unmount; actor-scoped caches and exact unresolved intent key/body are preserved appropriately.
- Existing PATCH endpoint is permitted by configured CORS; runtime Project/year/version/timestamp validation and Windows newline-safe OpenAPI checking remain enforced.
- Correct the legal archive-winner race assertion and P06 evidence manifest. Add read-only inventory verification and separate mocked/live browser artifacts.
- Focus recovery respects a user who moved into the Months. Client checks numeric year/storage bounds; backend alone enforces current..+2 in its configured zone. Server year refusals retain form data.

## API / database compatibility

No core wire DTO, endpoint semantics, schema, migration, generated API, dependency or original-outcome replay behavior changes. PATCH CORS is additive for an already implemented endpoint. New `inventory-project-replay.sql` is a bounded READ ONLY aggregate query, not a migration or remediation. D01/D02 proposals remain PROPOSED; authoritative API Contract is unchanged.

No Studio editor, AR/readiness, media pipeline, checkout/payment/Order placement or provider work is introduced. Cancelled Order rows in tests are explicit schema fixtures, not I09 acceptance.

## Verification

Executed results and exact commands are in [I05 Hardening Final Verification](I05-Hardening-Final-Verification.md): typecheck/lint/backend+frontend builds, contract/peers/proxy and whitespace PASS; backend Jest **225/225**, Supertest **7/7**, Vitest **127/127**, three-engine Playwright **99/99**, live Chromium **6/6**, existing Windows visual cases **4/4**. PostgreSQL gates passed **77 assertion groups**, including atomic creation, stale/concurrent writes, original-outcome replay, controlled Clock and read-only inventory. All databases were disposable. Tests kept their assertions/timeouts; local Console Ninja teardown interference was isolated separately and earlier failed attempts remain documented.

Regression evidence includes failed-before/passed-after native focus and cross-zone creation cases; original audited tests remain. Live browser forwards creation to the actual backend and drops only the first response, then retries the exact intent after Template deactivation. It also checks owner isolation, twelve Months, lifecycle conflicts/deletion and cancelled-history rejection in disposable PostgreSQL.

## Pending decisions / manual acceptance

- D01: API owner/Lead must explicitly approve staged core Project DTO and additive I07/I08 resource mapping; no authority amendment applied.
- D02: authorized operator inventory/deployment lineage is required to select A/B/C. A fresh disposable DB cannot establish absence of deployed legacy records. No backfill, fake outcome/current-state replay or key deletion.
- Manual screen-reader audio, native toolbar zoom 200% and human keyboard/New Year observations remain unverified. Computer Use stopped because browser URL could not be verified; a reproducible disposable checklist is provided. Automated browser/axe/Clock results are separately labelled.

## Risk / rollback

No data migration to roll back. Reverting UI/config hardening removes its protections but does not repair or erase old intents. Keep the original-outcome writer at/after `ed6888e`; reverting to the earlier writer could introduce more missing outcomes. Future child writes must retain Project-root locking/version coordination. Local Console Ninja isolation helpers and ignored logs/build artifacts are excluded from the proposed PR; unrelated untracked files are preserved.

No commit, push, PR creation or merge was performed by this task. Lead/teammate approval remains required.
