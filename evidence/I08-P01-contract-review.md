# I08-P01 — Contract review proposal

Status: **DECISION REQUIRED — LEAD CONTRACT REVIEW**. This is a proposal, not an amendment to approved API/schema authorities. Prepared on 2026-11-23 from starting commit `bd7626fe3916c6e17cfa7483060065eda2f757b0`. No new HTTP route, published DTO, generated schema, acknowledgement persistence or migration is enabled by this implementation.

## Effective authority and terminology

The [Business Rules](../docs/BUSINESS_RULES.md) remain the R03 business authority, with R04 technical implementation authorities. The current [roadmap](../docs/ROADMAP.md) and [replanning reconciliation](../planning/REPLANNING_I08_I20.md) record the Lead-confirmed Core direction: Preview → independent Finalization → Sharing → genuine AR, with Commerce deferred. That direction does not require another scope approval. Their technical-follow-up register explicitly leaves DTO/DDL/lifecycle amendments open. Historical CR-LUMICAL-01 wording about awaiting scope approval is superseded for product direction, not evidence that its technical sketches are approved.

`Order-ready` is the current BR-RDY-003 / API `orderReady` name. `Finalization readiness` is the revised Core consumer's name for the shared Working/content/AR/current-review predicate. Neither implies payment, an existing Order, a created immutable version, or recipient entitlement. This patch uses `finalization` internally and does not silently rename published `orderReady`. The Order-paid wording of BR-RDY-004 and revised independent-version Sharing need coordinated follow-up in CR-S01/I11. P01 implements neither subject's Sharing policy.

| Authority | Effective requirement / implementation boundary |
| --- | --- |
| BR-RDY-001, BR-MON-001/003 | Valid saved Project with exactly Months 1–12; empty Months, no captions, zero dates and no AR configuration remain Preview-ready. |
| BR-RDY-002, BR-AR-001–005, ADR-005 accepted Decision | Unambiguous current-version prepared target → one owned Ready image/video/audio reveal, meaningful readable text, owner mapping confirmation, same authorized camera-free content. A status/reference/job/mock cannot prove this. |
| BR-RDY-003, BR-PRJ-002/004/005 | Working, valid saved identity/year, twelve Months, ≥1 owned Ready calendar image, ≥1 AR-ready mapping, owner review of the current revision. Creation-year window never reimposed; no per-Month image/AR/date gate. |
| BR-RDY-004 | Sharing concerns an immutable authorized recipient version; outside mutable Project policies. Paid-Order versus independent-version subject reconciliation remains a technical decision. |
| BR-PRJ-001/005/007, API §12, Database §13 | Active owner only, safe foreign/missing 404; root revision coordinates identity/style/Month/date/AR/lifecycle edits. Archived is owner-readable/read-only and cannot finalize. |
| BR-MED-001–006 | Owned, verified Ready media; correct categories/size/duration, immutable content version, no deletion intent; no unreferenced-library image counted toward calendar completeness. |
| I07 code + API §17C/D | `PUT /projects/{id}/months/{number}`, event/style writes and AR write/delete increment Project revision under root lock. AR write records `sourceRevision`, PREPARING and after-commit job intent. `/ar/config` is authoring state, not AR readiness. |

Archived Preview is permitted by the derived BR-RDY-001 criterion and BR-PRJ-005 owner-readable historical workspace. It grants no edit/finalize/share entitlement. If the Lead intends a narrower render-route restriction, decide it for I08-P03 explicitly; P01 does not add a route or lifecycle state.

## Architecture assessment before implementation

The existing CalendarProjects module already has pure identity/personalization rules, ProjectOwnerService, ProjectRepository, and Prisma adapters. Identity `withActiveAccount` joins `PrismaTransactions.run`, which uses PostgreSQL SERIALIZABLE isolation. I07 child writes lock the root and advance one Project revision; reads can therefore collect root, Months, AR and media from one authoritative transaction without network calls. A separate CQRS/module platform is unnecessary.

Current storage has twelve Month rows, optional captions, ordered Month-media associations, optional Special Dates, one ProjectARExperience, and ARTargetArtifact rows. Media has owned verified metadata/content version and deletion-job guards. Artifact storage has revision, status, target ID, reference, prepared timestamp and opaque adapterMetadata, but **no reviewed provenance/integrity/region/reveal-verification protocol**. There is no preview-review acknowledgement table/service. No current readiness helper or duplicated readiness evaluator was found. The P01 adapter must return null preparation proof and null review evidence even for a fully populated READY artifact row.

I07 PRs #60/#61 are merged, but its milestone still has unchecked acceptance and no independent/manual closure was located. I03's R1 acceptance-boundary revision and ADR-005 addendum say ready for review; conditional MindAR direction is not a selected production SDK or product-device acceptance. These are admission limits, not reasons to fabricate evidence or mark predecessors accepted.

## Existing routes and missing decisions

| Route under `/api/v1` | Documentary authority | Runtime before/after P01 |
| --- | --- | --- |
| GET `/projects/{id}/readiness` | API §17C approves Readiness + `projectVersion`; §16 names `previewReady,arReady,orderReady` and safe issues | Not implemented. Exact new vocabulary, preparation detail and revised Finalization naming need review before binding this query to HTTP. |
| GET `/projects/{id}/preview` | API §17C approves incomplete preview + readiness + reviewed version | Not implemented; I08-P03/P05. Serving a GET must not itself acknowledge owner review. |
| GET `/projects/{id}/checkout-preview` | API §17C, quantity 1–10 + quote/current version | Not implemented; deferred Commerce I09, outside P01. |
| GET `/projects/{id}/ar` and `/ar/preview` | API §17D ARReadiness / scoped preview | Not implemented; genuine preparation/owner preview dependencies open. |
| GET `/projects/{id}/ar/config` | Approved authoring read | Implemented by I07 and preserved, including its version/ETag. Status is not genuine AR proof. |
| OrderCreate `reviewedProjectVersion` | API §12/16 and retained I09 contract | Future command input; never proof that the current preview was reviewed and never a mutable Project state. |

The existing readiness route is approved in principle. Its exact issue codes are not enumerated by the approved contract; `AR_UNAVAILABLE` there is a broad readiness/error category, not an approved substitute for all policy issues. Publishing the internal new codes, `finalizationReady`, `arPreparation`, or a review mechanism now would violate this task's contract-review gate. The complete internal query is composed in Nest, with HTTP intentionally withheld.

## Exact readiness DTO proposal

**DECISION REQUIRED — LEAD CONTRACT REVIEW (D1).** Approve this response on the already documented GET `/projects/{id}/readiness`:

```json
{
  "data": {
    "projectVersion": 3,
    "previewReady": true,
    "arReady": false,
    "orderReady": false,
    "finalizationReady": false,
    "arPreparation": "PENDING",
    "issues": {
      "preview": [],
      "ar": ["AR_PREPARATION_PENDING"],
      "finalization": ["FINALIZATION_AR_REQUIRED", "FINALIZATION_REVIEW_REQUIRED"]
    }
  }
}
```

`projectVersion`: positive safe integer, one saved root revision for every policy. Booleans are required. `orderReady` is a deprecated compatibility alias for the shared content/review predicate (`finalizationReady`), **not commercial checkout eligibility**. Review this alias explicitly; do not silently delete or change the old field's meaning. If consumers require a different Commerce meaning, retain the old DTO and review a separate compatible projection before enabling either route.

`arPreparation`: `NOT_CONFIGURED | PENDING | UNAVAILABLE | MISSING | STALE | UNVERIFIED | VERIFIED`. VERIFIED means trusted preparation provenance/integrity checks passed; it does not by itself mean usable reveal, owner-confirmed mapping, AR Ready or Finalization Ready. The existing AR authoring status enum is unchanged. The added values are detail on this proposed readiness DTO only.

`issues`: required arrays of the proposed codes from the matrix below, fixed evaluation order, no localized message/translation key/provider errors or arbitrary context. Each code belongs to its array. Empty arrays mean that policy has no unmet requirement. Readiness issues are a 200 domain result, not HTTP exceptions. `orderReady` shares the finalization issue array under this proposal. Additional consumer fixtures: [JSON examples](I08-P01-readiness-fixtures.json).

Authentication: existing active account cookie; owner-only even for Admin. Unknown/foreign ID → identical safe 404; inactive/absent session → 401. No GET query parameter, request body, If-Match or idempotency key. `Cache-Control: private, no-store`; ETag `"<projectVersion>"` labels the root only. Since media availability can change without a Project revision, ETag must **not** be used to return 304 or cache readiness. Reevaluate every request. Return no media URLs, storage references, raw text, artifact hashes/bytes, target IDs or other-owner identifiers. Read-only except the established Identity session-activity refresh; no Project/job/acknowledgement writes.

The implementation returns the evaluated snapshot revision, which can become old immediately after evaluation. It does not promise a lock held through the consumer's next operation. Finalization/Order commands must lock and re-evaluate the exact expected current root version, media/pins and evidence again. New preconditions belong to those separately reviewed command contracts.

## Issue vocabulary proposal and rule matrix

**DECISION REQUIRED — LEAD CONTRACT REVIEW (D2).** Codes below are internal proposals, not newly canonical API errors. Safe response context is **none for every code**; only the containing policy and evaluated Project revision are exposed. All triggers accumulate in deterministic source order within their policy; preparation chooses STALE before UNAVAILABLE before PENDING before MISSING before UNVERIFIED. Other unmet conditions can coexist. Tests are named Rxx in [domain tests](../backend/src/modules/calendar-projects/domain/readiness.spec.ts).

| Proposed code | Policy | Trigger / scenario | Rule | Test |
| --- | --- | --- | --- | --- |
| PREVIEW_INVALID_PROJECT | Preview | Invalid saved identity/year/root revision/lifecycle | BR-RDY-001, BR-PRJ-002/004 | R04 |
| PREVIEW_MONTHS_INVALID | Preview | Not exactly one Month 1–12 | BR-RDY-001, BR-PRJ-003 | R04 |
| AR_NOT_CONFIGURED | AR | No configuration | BR-RDY-002 | R01 |
| AR_CONFIGURATION_INVALID | AR | Invalid configuration/designated Month/readable text or invalid saved Project | BR-RDY-002, BR-MED-001 | R04, R11 |
| AR_REVEAL_UNAVAILABLE | AR | Missing/wrong-owner/mismatched/unverified/unusable/non-Ready/deleting reveal | BR-MED-001–004 | R12, DB10 |
| AR_PREPARATION_PENDING | AR | Current config or target still PREPARING | BR-RDY-002, ADR-005 | R06, DB03 |
| AR_PREPARATION_UNAVAILABLE | AR | Current config or target unavailable | BR-RDY-002 | R06, DB05 |
| AR_PREPARATION_MISSING | AR | No artifact while no earlier preparation-state issue applies | BR-RDY-002 | R07, DB05 |
| AR_PREPARATION_UNVERIFIED | AR | READY flags lack verified source/artifact proof or valid SHA-256 digests | BR-RDY-002, ADR-005 | R07, R18, DB04 |
| AR_PREPARATION_STALE | AR | Config or artifact source revision differs from root, including future mismatches | BR-RDY-002, BR-CON revision boundary | R08, R15, R16, DB08/09 |
| AR_MAPPING_INVALID | AR | Target scope/Month/ID or reveal ID/content-version pin mismatches | BR-RDY-002, BR-AR-002/003 | R09, R10 |
| AR_FALLBACK_UNVERIFIED | AR | Missing or different authorized Project/owner/revision/reveal/text fallback evidence | BR-RDY-002, BR-AR-004/005 | R13 |
| AR_MAPPING_REVIEW_REQUIRED | AR | Owner-confirmed mapping evidence absent/stale/wrong scope or target | BR-RDY-002 | R14 |
| FINALIZATION_PREVIEW_REQUIRED | Finalization | Saved identity/structure invalid | BR-RDY-003 | R04 |
| FINALIZATION_NOT_WORKING | Finalization | Archived Project | BR-RDY-003, BR-PRJ-005 | R03, DB11 |
| FINALIZATION_PERSONAL_IMAGE_REQUIRED | Finalization | No owned usable Ready calendar image anywhere | BR-RDY-003, BR-MED-003 | R01, R05, DB03/08 |
| FINALIZATION_AR_REQUIRED | Finalization | AR policy not ready | BR-RDY-003 | R01, R06–R16 |
| FINALIZATION_REVIEW_REQUIRED | Finalization | No trusted owner review acknowledgement | BR-RDY-003 | R14, DB04 |
| FINALIZATION_REVIEW_STALE | Finalization | Review does not match owner/Project/current root version/current target | BR-RDY-003, API §12 | R14, R15 |

## Preparation and review handoff proposals

**DECISION REQUIRED — LEAD CONTRACT REVIEW (D3, I08-P02/P04).** Review the trusted normalization boundary before implementing a real adapter. The internal `PreparationProof` requires SHA-256 source/artifact digests, pinned reveal ID/content version, and same-content fallback binding; the target carries owner/Project/revision/Month/target ID. These are **verified adapter outputs**, never evidence just because a JSON object has these fields. P02 must prove actual saved rendered calendar image/region → immutable source/hash/transform → genuine compiled artifact/integrity → unique scoped target/mapping. No user metadata, READY flag, nonempty reference, timestamp, or mock adapter success can be converted into this proof. P04 must verify owner authorization and identical meaningful reveal/fallback. Storage format/region/render provenance, integrity verifier, immutability, SDK/license/zero-cost selection and late-job compare-and-publish remain P02 review items; P01 adds no metadata parser or DDL.

**DECISION REQUIRED — LEAD CONTRACT REVIEW (D4, I08-P05).** Proposed acknowledgement flow, not implemented:

1. Owner GET `/projects/{id}/preview` returns saved `projectVersion`, current target identity and a backend-issued opaque `previewReceipt` bound to active owner, Project, revision, target, source digest and expiry. Serving it records no review.
2. Explicit owner confirmation POST `/projects/{id}/preview-review`, `Origin`, `X-CSRF-Token`, `If-Match: "7"`, `Idempotency-Key`; exact body `{ "previewReceipt": "<opaque server-issued receipt>", "previewConfirmed": true, "arMappingConfirmed": true }`. Each confirmation reflects an explicit owner attestation; a served response alone never confirms review.
3. Backend verifies receipt/current active owner, locks root, rejects stale receipt/revision with 412, rejects invalid/expired receipt with safe 422, validates current mapping and only then persists acknowledgement atomically with idempotency result. Proposed 200 `{ "data": { "projectVersion": 7, "reviewedProjectVersion": 7 } }`. No Project content/version change merely to acknowledge it.
4. Proposed new acknowledgement record: `id,ownerId,projectId,projectVersion,targetId,sourceDigest,previewReviewedAt,arMappingReviewedAt`; composite same-owner Project reference; no update of historical acknowledged versions; replay intent binds request digest/revision. Receipt expiry duration/storage/signing and retention must be reviewed in P05; no approval is inferred here. The query adapter derives separate mapping/full-review evidence only after verification. No client-supplied `reviewedProjectVersion` GET parameter or arbitrary persisted boolean.

This is a new route/DTO/persistence/precondition proposal and must be reviewed before schema or API changes. I09-R2 Finalization and deferred I09 OrderCreate must independently recheck current `reviewedProjectVersion` and all content/media/artifact invariants atomically; acknowledgement is not a bypass or recipient grant.

## Compatibility and review disposition

No runtime API/DB change in this patch; current I07 clients and generated types remain byte-for-byte unchanged. Enabling D1/D2 later requires coordinated API Contract/OpenAPI/client generation, actual route DTO/security/cache tests, and I07 consumer review. D3/D4 are hard dependencies for any true AR/Finalization Ready output. No new SDK or provider call is introduced. D1–D4 and predecessor independent/manual acceptance remain open; this patch is reviewable internal policy work, not acceptance or merge-readiness evidence.
