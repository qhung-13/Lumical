# ADR-004 — PayPal Sandbox with USD and verified evidence

## Status

**Accepted technical adapter decision**. USD, sandbox-only honesty and completion authority are already frozen business decisions, not reopened here.

## Context

LumiCal demonstrates an international academic checkout without real-money commerce. Payment is separate from fixed Order intent and simulated Fulfillment. Lost responses, browser returns and duplicate provider events must not create false success or duplicate settlement.

## Decision

PayPal Sandbox is the initial PaymentGateway adapter. Display/Order/payment USD, captured unit price × quantity 1–10, no FX/discount/tax/delivery fee. Backend creates bound attempts and stable provider operation identities, verifies approval/capture/status and correct account/environment/Order/amount/currency, then atomically records one unique settlement. Browser return/approval is only a signal. Verified webhook inbox and provider-status reads feed the same completion use case.

Provider calls occur outside database locks. Unknown outcome remains pending and is rechecked before another attempt. Definitive Failed/Cancelled attempts can retry under same unpaid Order. Admin may inspect/request recheck but cannot mark Completed. No provider secret goes to frontend. Sandbox disclosure and simulated/no-real-shipment wording remain visible.

## Options considered

- Browser success/callback: lacks trustworthy evidence; forbidden.
- Manual Admin paid flag: violates frozen completion authority; forbidden.
- Real payment or multi-currency conversion: outside academic scope; rejected.
- Provider-neutral port with PayPal Sandbox adapter: chosen; preserves business state/evidence while allowing reviewed adapter change if needed.

## Consequences

Sandbox account/setup and genuine provider acceptance are required. Fake adapters accelerate tests but do not prove final payment. Database uniqueness plus stable provider identities handle replay; no refund/banking reconciliation platform is created. Order content remains fixed regardless of attempt outcomes.

## Risks

Sandbox outages, currency/account settings, late/duplicate events and uncertain captures. Durable intent/inbox/job state, evidence binding and status recovery reduce risks. A recording may back up presentation, not replace successful acceptance. This ADR claims **no production payment readiness**.

## Revisit triggers

Provider availability/licensing or course-approved gateway change. Real-money operations, refunds or currency changes require explicit Product Scope/Business Rules review, not adapter configuration alone.

## Related authorities

[Business Rules](../BUSINESS_RULES.md), [Architecture](../ARCHITECTURE.md), [Database](../DATABASE.md), [API Contract](../API_CONTRACT.md), [Testing Strategy](../TESTING_STRATEGY.md).
