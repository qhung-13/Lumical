# ADR-005 — Mandatory AR behind a boundary until early proof

## Status

**Accepted provider-boundary decision. AR technology/SDK is NOT yet selected; actual selection remains delegated to mandatory I03 spike.** AR itself remains frozen mandatory P0.

## Context

A supported prepared target must genuinely reveal intended personalized content within explicit recipient access. An image+meaningful message is sufficient; short video/audio are alternatives. Hardware/browser recognition and licensing cannot be safely assumed, while paid Order/target/media version binding must remain stable.

## Decision

Define provider-neutral ARPreparation and recognition integration boundaries. Prepare immutable target artifacts bound to a Project revision and capture them in the Order AR snapshot. Recognition never authorizes access; backend resolves target only within the currently valid owner/recipient version. Same authorized content is available without camera; unknown/wrong-user target fails closed. Do not select an SDK in this ADR.

Run I03 early, in parallel with foundations, before final Studio/snapshot/AR integration gates. Record tested evidence and amend/supersede technology detail through reviewed decision after proof. Core IDs/readiness/projections stay provider-neutral; bounded provider artifact metadata belongs to the adapter.

## Options considered

- Select an SDK immediately: insufficient supported-device/privacy/license evidence; deferred.
- QR/direct-link-only or mocked “scan”: may help navigation/fallback but cannot satisfy genuine target-recognition reveal; rejected as final AR acceptance.
- Global target→media public lookup: risks private cross-user leakage; forbidden.
- Early practical spike plus boundary: chosen; technology risk resolved before late-semester integration.

## Selection criteria and required spike evidence

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
