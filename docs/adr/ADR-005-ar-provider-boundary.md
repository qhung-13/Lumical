# ADR-005 — Mandatory AR behind a boundary until early proof

## Status

**Current review proposal:** the provider boundary remains accepted. The technology-selection/timing addendum below is
**READY FOR REVIEW**, following LEAD's explicit scope revision. No independent repository approval or product-device
acceptance is claimed. The next paragraph preserves the original accepted status.

**Accepted provider-boundary decision. AR technology/SDK is NOT yet selected; actual selection remains delegated to mandatory I03 spike.** AR itself remains frozen mandatory P0.

## Context

A supported prepared target must genuinely reveal intended personalized content within explicit recipient access. An image+meaningful message is sufficient; short video/audio are alternatives. Hardware/browser recognition and licensing cannot be safely assumed, while paid Order/target/media version binding must remain stable.

## Technology-selection addendum R1 — ready for review

LEAD's requested direction is **SELECT WITH CONDITIONS — MindAR image tracking**, based on
[P05](../../spikes/ar/I03-P05-ar-technology-recommendation.md), the prototype and
[boundary revision R1](../../spikes/ar/I03-acceptance-boundary-revision.md). Independent teammate/coordinated authority
review and final repository closeout approval are pending. This addendum is not a supported-device or runtime-privacy claim.

The original Decision and evidence table below remain historical accepted baseline. R1 changes **when** device/runtime
verification occurs: I03 establishes technical feasibility, known limits and a reproducible handoff; I08 verifies production
preparation/version integrity; I12 verifies genuine product mobile HTTPS recognition, privacy, lifecycle and accessible
authorized fallback. Former P06 independent execution remains required in I08-P06/I12-P05, not fabricated by a procedure.

Conditions remain: provider-neutral ports/IDs and replaceable adapter; recognition never authorizes content; server-owned
scope checks; immutable source/Order bindings; same authorized camera-free fallback; finite retention. Core P0 must need
no mandatory paid AR SDK/runtime/service; monetary PASS is not complete transitive-license review. Pin compatible tooling,
assign maintenance/retest ownership and complete applicable obligations before dependency/runtime use.

R1–R7 reopen selection if real-device P0 recognition/browser requirements, privacy/security, zero mandatory AR cost,
authorization/version safety, fallback or licensing cannot be satisfied. Do not relax product rules to retain this provider.
After review, this addendum supplies the conditional technology detail without replacing the boundary decision. No API,
schema or production implementation is selected by the sketch; [P06](../../spikes/ar/I03-P06-handoff.md) remains a handoff.

## Decision

**Original accepted text, retained history:** R1's review-pending technology/timing addendum above is the proposed change;
this baseline is not rewritten or claimed retroactively approved for a particular SDK.

Define provider-neutral ARPreparation and recognition integration boundaries. Prepare immutable target artifacts bound to a Project revision and capture them in the Order AR snapshot. Recognition never authorizes access; backend resolves target only within the currently valid owner/recipient version. Same authorized content is available without camera; unknown/wrong-user target fails closed. Do not select an SDK in this ADR.

Run I03 early, in parallel with foundations, before final Studio/snapshot/AR integration gates. Record tested evidence and amend/supersede technology detail through reviewed decision after proof. Core IDs/readiness/projections stay provider-neutral; bounded provider artifact metadata belongs to the adapter.

## Options considered

- Select an SDK immediately: insufficient supported-device/privacy/license evidence; deferred.
- QR/direct-link-only or mocked “scan”: may help navigation/fallback but cannot satisfy genuine target-recognition reveal; rejected as final AR acceptance.
- Global target→media public lookup: risks private cross-user leakage; forbidden.
- Early practical spike plus boundary: chosen; technology risk resolved before late-semester integration.

## Selection criteria and required spike evidence

Original I03-stage evidence table retained below. R1 V01–V12 explicitly reassign verification timing/owners to I08/I09/I12;
it does not claim the missing evidence passed or remove the product obligations.

| Criterion | Evidence required |
| --- | --- |
| Web/mobile support | Actual supported browser/OS/device matrix and native-browser constraints. |
| Reliability | Prepared image target under recorded distance/light/orientation and repeat scan conditions. |
| Privacy | Camera frames/target artifacts processing location and external transfer, authorized media separation. |
| HTTPS/camera | Real permission/start/denial/exit behavior on deployed HTTPS test harness. |
| Licensing | Course/demo-use permission, costs, SDK/artifact redistribution restrictions. |
| Offline/online needs | Which preparation/recognition/content steps require network, honest unavailable behavior. |
| Integration complexity | Client bundle/performance, preparation process and implementation effort. |
| Version binding | Correct Order target/media even after mutable Project changes; wrong-owner target rejection. |
| Fallback/accessibility | Same authorized meaningful content without recognition; revocation blocks both. |

## Consequences

AR spike is mandatory before final technology-specific implementation; foundation can begin without SDK selection. Orders still require AR-ready target, so I08 preparation/owner preview precedes I09 checkout. Final I12 proves genuine recipient recognition with paid-version authorization. No advanced multi-target/effects requirement appears in P0.

## Risks

No viable supported-browser/licensing choice, unreliable target preparation or camera/SDK constraints. Report failed spike as an implementation blocker for affected milestones; propose reviewed scope/technology correction rather than claiming mock success. Keep fallback usable but do not call it a substitute for genuine AR.

## Revisit triggers

I03 evidence, material browser/license change, failed device acceptance or inability to preserve privacy/version binding. Update technical selection while preserving frozen P0 reveal/access/fallback decisions.

## Related authorities

[Product Scope](../PRODUCT_SCOPE.md), [Business Rules](../BUSINESS_RULES.md), [Architecture](../ARCHITECTURE.md), [Database](../DATABASE.md), [API Contract](../API_CONTRACT.md), [Roadmap](../ROADMAP.md), [Testing Strategy](../TESTING_STRATEGY.md).
