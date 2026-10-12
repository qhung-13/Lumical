# LumiCal — Development Workflow

Status: **Approved/frozen R04 team agreement**. Applies to the future new repository; no repository/branch/CI is initialized by this documentation phase.

## 1. Source of truth

Approved [Product Scope](PRODUCT_SCOPE.md), [Business Rules](BUSINESS_RULES.md), [Design System](DESIGN_SYSTEM.md) and technical authorities govern their own decisions. Authority documents > ADRs within that authority > implementation > comments/temporary notes. [README](README.md) defines ownership/reading order. A lower document cannot silently override a higher one.

## 2. Tickets

Every implementation ticket states user/business outcome, milestone, applicable C/BR/INV IDs, accepted API/model/design boundary, validation and exclusions. Keep tasks small enough to review. Board: Ready → In progress → Review → Tested → Done; blockers recorded with owner and concrete dependency. Tickets must not introduce capabilities outside approved authority.

## 3. Branch strategy

One protected `main`, short-lived ticket branches, reviewed PR merge. No long-lived frontend/backend/developer branches. Integrate small vertical changes; use safe disabled/incomplete feature composition where needed, without claiming milestone acceptance early.

## 4. Branch naming

`feature/<ticket>-<short-name>`, `fix/<ticket>-<short-name>`, `docs/<ticket>-<short-name>`. A release/demo branch is temporary and justified, not a permanent divergent product. Current branch is unset until the new repository exists.

## 5. Commits

Use conventional `feat`, `fix`, `docs`, `test`, `refactor`, `chore` with meaningful business/module scope and ticket reference. No secrets, participant content, generated credential payloads or build output committed. Keep applied migrations in history.

## 6. PR requirements

Describe problem/result, ticket/milestone/rules, affected frontend/backend/API/DB boundaries and validation evidence. Include UI evidence for visual changes, migration impact/rollback for data changes, and negative/race cases for high-risk operations. No unrequested feature mixed into cleanup. PR is concrete and reviewable before requesting approval.

## 7. Review

At least one teammate reviews before merge. Affected API/database/design owner participates; ownership means review responsibility, not a permanent silo. Review correctness and behavior first, then maintainability. Do not approve by typecheck alone; settlement/share/snapshot changes require relevant integration evidence.

## 8. Authority changes

Propose smallest edit with reason, affected decisions/BR/INV IDs, derived document impact and testing/migration consequence. Product/scope/business/visual decision change needs its owner approval before dependent implementation. Frozen Product Scope/Business Rules cannot be rewritten to justify accidental code behavior. Update all affected derived authorities in the reviewed change.

## 9. ADRs

Record significant architecture/storage/auth/provider tradeoffs, status, alternatives, consequences/risks and revisit triggers. ADRs complement authority, not supersede product rules. Supersede with a linked new decision rather than erasing history; small internal refactor need not create ADR ceremony.

## 10. Database migrations

PostgreSQL in every environment; reviewed Prisma migration history from initial empty DB. Developer generates/reviews migration with pinned tooling, tests empty and upgrade path; teammate reviews constraints/data-loss/locking. Resolve concurrent migration naming/order before merge. Never modify an applied migration or use deploy schema push. Deployment runs reviewed migration workflow once with separate authority and synthetic test evidence. No existing production dump/baseline is reused.

## 11. API changes

Update [API Contract](API_CONTRACT.md) and OpenAPI/examples, regenerate client/types, test runtime projection/error/security/preconditions, and coordinate both apps in one compatible change. Additive compatible change preferred; breaking contract needs explicit version/deployment plan. Never add browser/Admin mark-paid or recipient Order data.

## 12. Design changes

Design System is the single token/interaction authority. Visual changes review both themes/VI-EN, responsive/zoom/keyboard, contrast/focus, reduced motion and snapshots. New token/variant requires recurring semantic use or justified exception. Do not change screenshot baselines blindly to hide drift.

## 13. Dependencies

At I00 select supported compatible versions and commit lockfile; choose one package manager (pnpm preferred) across workspace. Add only needed dependencies with reason/license/maintenance review and teammate approval through PR. Check breaking upgrades against docs/adapters/tests. No package installation in this documentation phase.

## 14. Environments

Separate development, disposable test and academic demo databases/provider accounts. Future example environment file has placeholders and clear public/backend-only names. Startup validation fails closed for missing required config or wrong live payment mode. P1 email only required when recovery enabled. Shared participant production data is not a test fixture.

## 15. Secrets

Use local ignored files/secret store, no committed credentials or frontend secret env. Redact logs/PR screenshots, raw share/CSRF/session/provider tokens. Rotate leaked keys promptly and assess affected grants; document incident without repeating secret. Do not grant everyone unrestricted production/database credentials.

## 16. Before PR

Typecheck/lint/build affected apps; focused behavior/contract/database tests; critical invariant tests for snapshot/payment/share changes; UI component/accessibility/visual checks when affected. Document external provider/device acceptance separately. Missing check is explicit, not represented as pass.

## 17. CI

Install from lockfile, static checks, frontend/backend production compilation, domain/unit/component tests, migrated disposable PostgreSQL integration/contract tests, critical Playwright journey and automated accessibility/secret checks. Sandbox/device gates may be scheduled/manual evidence with owner; mock success is not a final acceptance gate. Build artifacts contain no secrets.

## 18. Merge

Squash reviewed short-lived PR into main, preserve ticket/rule summary, require green required checks and approval. Rebase/resolve conflicts carefully without discarding teammate changes. Database/API conflicts reviewed with affected contributors. Main stays reproducible and protected.

## 19. Release/demo

Tag stable demo candidate; temporary `release/demo-<date>` only for final controlled fixes if useful. Record migration version, app versions and sandbox/device evidence. Changes propagate back to main via review. R04 approval and all P0 gates precede final demo readiness claim; P1 deferral needs scope-owner approval.

## 20. Rollback

Code rollback requires compatibility with applied schema/data. Prefer backward-compatible expand/change then later cleanup; do not erase successful payment/snapshot history to revert code. Before destructive migration take a tested backup and explicit authorized rollout plan. Provider effects use evidence/status recovery, not database deletion. No deployment is authorized by this document.

## 21. Definition of Ready

Ticket has clear outcome, dependencies available, rule/API/model/design decisions settled, acceptance scenarios and smallest deliverable. AR production integration is not Ready until I03 spike proves selection. P2 ticket is not Ready without approval and stable mandatory priorities.

## 22. Definition of Done

Reviewed implementation matches authority, required checks/evidence pass, safe error/retry/security/accessibility behavior works, documentation/OpenAPI/migration impact updated, no secret or unapproved feature, acceptance gate met. A finished component alone does not make an incomplete end-to-end milestone Done.

## 23. Hotfix

Small `fix/…` branch from relevant stable base, ticket with impact and safe reproduction, targeted validation and teammate review. If incident demands unusually fast handling, record responsible approver/action and complete review/tests promptly; no permanent bypass of payment/access rules or destructive history cleanup.

## 24. Team ownership

Assign module/design/API/DB reviewers while pairing across boundaries; rotate knowledge and provide short handoff notes. Shared snapshot/payment/share contracts reviewed together. Avoid individual branches with weeks of integration debt and avoid a single person holding all provider setup knowledge.

## 25. Review checklists

All PRs: scope/rules, behavior, validation, docs and secrets. Frontend: typed HTTP, tokens, VI/EN/theme/accessibility, no private caching. Backend: authorization, transaction/version/idempotency, safe DTO/evidence/audit. Database: migration, exact money, references/constraints/retention and rollback. API: compatible OpenAPI, safe owner/recipient/Admin projection. Milestone: dependency gates plus actual integrated acceptance evidence.
