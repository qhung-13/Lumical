# I08-P01 — Readiness rule matrix

Issue codes are internal proposals pending [LEAD contract review](I08-P01-contract-review.md). Rxx = named [Jest policy test](../backend/src/modules/calendar-projects/domain/readiness.spec.ts); Qxx = [application query test](../backend/src/modules/calendar-projects/application/readiness-query.spec.ts); DBxx/APIxx = [disposable PostgreSQL integration test](../backend/scripts/test-project-readiness.mjs). Positive preparation/review cases use synthetic trusted facts and cannot certify genuine preparation or acknowledgement.

| Policy | Scenario | Expected Result | Issue Code | Rule ID | Test |
| --- | --- | --- | --- | --- | --- |
| Preview | Twelve empty Months, no captions | Ready | None | BR-RDY-001, BR-MON-003 | R01, DB01 |
| Preview | Zero Special Dates | Ready | None | BR-RDY-001/003 | R01/R02, DB01 |
| Preview / AR | No AR configuration | Preview Ready, AR false | AR_NOT_CONFIGURED | BR-RDY-001/002 | R01, DB01 |
| Preview | Missing/duplicate/out-of-range Month | False | PREVIEW_MONTHS_INVALID | BR-PRJ-003, BR-RDY-001 | R04 |
| Preview | Invalid saved title/year | False | PREVIEW_INVALID_PROJECT | BR-PRJ-002, BR-RDY-001 | R04 |
| Finalization | One owned usable Ready calendar image, eleven empty Months | Image requirement satisfied | None for image gate | BR-RDY-003 | R02, DB03 |
| Finalization | No usable Ready personal image | False | FINALIZATION_PERSONAL_IMAGE_REQUIRED | BR-RDY-003, BR-MED-003 | R01/R05, DB08 |
| Finalization | Library-only image / AR reveal not attached to calendar | Does not count as calendar image | FINALIZATION_PERSONAL_IMAGE_REQUIRED | BR-RDY-003 | R01/R05 (only Month associations are inputs), DB08 |
| Finalization | Working + verified current content/mapping/review | Predicate accepts synthetic facts | None | BR-RDY-003 | R02 |
| Preview / Finalization | Archived | Preview Ready, Finalization false | FINALIZATION_NOT_WORKING | BR-PRJ-005, BR-RDY-003 | R03, DB11 |
| AR | Configured, preparation Pending | False | AR_PREPARATION_PENDING | BR-RDY-002 | R06, DB03 |
| AR | Preparation Unavailable | False | AR_PREPARATION_UNAVAILABLE | BR-RDY-002 | R06/R18, DB05 |
| AR | Artifact revision older/newer than evaluated root | False / STALE | AR_PREPARATION_STALE | BR-RDY-002, API §12 | R08/R15/R16, DB08/09 |
| AR | Missing prepared artifact | False / MISSING | AR_PREPARATION_MISSING | BR-RDY-002 | R07, DB05 |
| AR | READY row, reference, timestamp, arbitrary metadata / mock success | False / UNVERIFIED | AR_PREPARATION_UNVERIFIED | BR-RDY-002, ADR-005 | R07/R18, DB04 |
| AR | Wrong target Project/owner/Month/ID | False | AR_MAPPING_INVALID | BR-RDY-002, BR-AR-002/003 | R09 |
| AR | Reveal ID/content version differs from prepared pin | False | AR_MAPPING_INVALID | BR-RDY-002, BR-AR-002 | R10 |
| AR | Current verified source/artifact evidence + correct mapping/reveal/fallback + owner mapping confirmation | Predicate accepts synthetic facts | None | BR-RDY-002 | R02/R11 |
| AR | Image+message, video+caption/transcript, audio+transcript/caption | Each alternative accepted with appropriate Ready media | None | BR-MED-001, BR-RDY-002 | R11 |
| AR | Missing readable text, invalid designated Month | False | AR_CONFIGURATION_INVALID | BR-MED-001, BR-RDY-002 | R11 (text), R04 (invalid structure) |
| AR | Wrong-owner/Pending/unverified/deleting reveal or invalid type/size/duration | False | AR_REVEAL_UNAVAILABLE | BR-MED-001–004 | R12, DB10 |
| AR | Missing/different/unauthorized fallback content/text/version | False | AR_FALLBACK_UNVERIFIED | BR-RDY-002, BR-AR-004/005 | R13 |
| AR | Mapping not confirmed for this owner/Project/target/revision | False | AR_MAPPING_REVIEW_REQUIRED | BR-RDY-002 | R14 |
| Finalization | Trusted current review | Accepted where all other evidence is valid | None | BR-RDY-003, API §12 | R02/R14 |
| Finalization | No trustworthy acknowledgement mechanism | False | FINALIZATION_REVIEW_REQUIRED | BR-RDY-003 | R14, DB04 |
| Finalization | Stale/wrong-owner/Project/target review | False | FINALIZATION_REVIEW_STALE | BR-RDY-003, API §12 | R14 |
| AR / Finalization | Month/style/date edit after review | New root version; old review/preparation rejected | AR_PREPARATION_STALE, FINALIZATION_REVIEW_STALE | BR-RDY-002/003, API §12 | R15, DB08 |
| AR / Finalization | AR edit then late old preparation | False; old artifact cannot restore Ready | AR_PREPARATION_STALE | BR-RDY-002/003 | R16, DB09 |
| Finalization | Zero dates with otherwise complete saved Project | Accepted with synthetic verified evidence | None | BR-RDY-003 | R02 |
| Preview / Finalization | Saved year now outside creation window | Existing valid year still accepted | None for year | BR-PRJ-002, BR-RDY-003 | R02 (year 2000) |
| All | Order/Payment state changes | Same readiness | None added | BR-PRJ-004/007, BR-RDY-001–003 | R17, DB07 |
| All | Missing/foreign Project, including Admin without owner relationship | Deny before reading private children; safe NOT_FOUND error | HTTP/domain NOT_FOUND, not readiness issue | BR-ID-001/002, BR-PRJ-001 | Q02/Q03, DB02, API01 |
| All | Unauthenticated/disabled account | Denied | HTTP UNAUTHENTICATED, not readiness issue | BR-ID-001/010 | DB02 |
| All | Root read interleaved with committed Month edit | Entirely N or entirely N+1, never mixed; result labels evaluated revision | Existing transaction retry if needed | API §12, ADR-002 | Q01/Q04/Q05, DB08 |
| All | Repeated query | Deterministic issues, no content/job mutation | None added | Backend Standards §§5/12 | DB01/06 |
| Sharing | Mutable Project or payment facts | No Sharing projection or entitlement computed | Outside policy | BR-RDY-004 | R17, no Sharing input/output |

The current database adapter has no trusted preparation or review verifier. Therefore positive AR/Finalization policy cases are unit-only; every real query stays false for those policies until P02/P04/P05 provide reviewed evidence. Runtime HTTP DTO and genuine provider/device acceptance remain separate gates.
