# ADR-003 — Backend-owned opaque revocable sessions

## Status

**Accepted**; follows the approved authentication baseline.

## Context

Private ownership, Admin limitation and disabling accounts require prompt server-side revocation. Browser rendering is not a permission boundary. Anonymous recipient grants are distinct from registered-account identity. Password recovery is P1 and email verification/change/account self-delete are not semester features.

## Decision

Backend creates random opaque account session, persists only keyed digest and revocation/expiry/CSRF binding, sends Secure HttpOnly SameSite=Lax `__Host-lumical_session` cookie (Path=/, no Domain) in deployed HTTPS. Same-origin proxy preferred; separate-port development uses exact credentialed CORS and distinct loopback-only cookie settings. Current logout revokes current session; reset/disable revoke all. Backend checks account active and session expiry every request. Initial technical expiry: 24-hour idle, 7-day absolute.

Cookie-authenticated mutations require exact Origin and synchronizer `X-CSRF-Token`; login/registration also have origin/abuse protections. CSRF token resides only in memory. Recipient share exchange creates a separate opaque recipient session/cookie bound to share generation; it cannot authorize account/Admin actions. All raw secrets/digests are redacted.

## Options considered

- JWT bearer session: would require additional revocation/version state for disable/reset, offering little benefit in this monolith; not chosen.
- localStorage bearer tokens: accessible to script and explicitly forbidden; rejected.
- Secure HttpOnly cookie + durable opaque session: chosen for direct logout/reset/disable revocation and narrow frontend responsibility.
- Frontend-owned authentication: conflicts with authoritative backend and cross-object authorization; rejected.

## Consequences

Session lookup on protected backend requests and careful idle updates; manageable with indexed digests. SameSite reduces exposure but does not replace Origin/CSRF. SSR must safely forward relevant cookies through HTTP, not access database. No token-refresh/OAuth infrastructure needed.

## Risks

Cookie misconfiguration, CSRF, leaked logs, private cache or mixed owner/recipient cookies. Tests enforce flags, exact origins, revocation, safe serialization and separate principal types. Cookie protection does not make XSS harmless; frontend content handling/CSP still matters.

## Revisit triggers

Approved native/API clients, materially different deployment origins or an identity-provider requirement. Any alternative must preserve revocation and prohibit frontend persistence of auth secrets.

## Related authorities

[Architecture](../ARCHITECTURE.md), [API Contract](../API_CONTRACT.md), [Database](../DATABASE.md), [Frontend Standards](../FRONTEND_STANDARDS.md), [Business Rules](../BUSINESS_RULES.md).
