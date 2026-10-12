# LumiCal — Frontend Standards

Status: **Approved/frozen R04 implementation standard**. Stack: Next.js, React, TypeScript, App Router. Read [Architecture](ARCHITECTURE.md), [API Contract](API_CONTRACT.md), [Design System](DESIGN_SYSTEM.md), and [Business Rules](BUSINESS_RULES.md). Applies to the new frontend only.

## 1. Responsibilities

Render public, owner, recipient and Admin journeys; collect input, display authoritative API outcomes, manage draft interaction and provide VI/EN/theme/accessibility. Public/SSR business data still comes through backend HTTP.

## 2. Non-responsibilities

No database/Prisma access, authoritative pricing, ownership enforcement, Order snapshot creation, payment capture/verification, credential hashing, provider secrets or private storage signing. Hiding a button is UX; backend permission remains mandatory.

## 3. Folder structure

```text
src/
  app/                 route composition, layouts, metadata, boundaries
  features/            identity, templates, calendar-projects, media, ar,
                       orders, payments, sharing, account, admin
  design-system/       foundations, primitives, composites, layouts
  api/                 generated contract types, shared transport, errors
  lib/                 small neutral utilities, server-only HTTP configuration
  i18n/                VI/EN system dictionaries and formatters
  hooks/               genuinely shared UI behavior
  types/               neutral shared UI types, not duplicate API schemas
```

This tree is a future organization specification, not directories to create in this phase. P1 recovery/notifications are feature additions; P2 code is absent until approval.

## 4. Feature ownership

Each feature owns API hooks, forms, stateful components and mapping of canonical outcomes. CalendarProjects owns MonthSelector, CalendarPreview and date editing; Media owns uploads; AR owns scanner state/recognition integration; Orders owns checkout summary. Admin composes operational features without reimplementing their rules. Features expose a small public import surface, not arbitrary deep imports.

## 5. Routes/pages

App Router pages compose features and shared layouts. Distinguish public catalog, authenticated workspace/account, recipient and Admin shells. Routing is presentation, not ownership. Public paths follow approved product navigation. No frontend `/api/v1` business implementation; proxy routes API requests to NestJS. Provider return/cancel pages display verified backend state.

## 6. Server and Client Components

Server Components handle public rendering and safe account bootstrap; Client Components handle forms, React Query, interactive tools and camera/player APIs. Mark browser boundaries narrowly; keep layouts server-renderable. Server HTTP uses trusted internal backend URL, explicit cookie forwarding only for private reads, safe DTO projection and no-store. No server-only environment values serialized to client props. Do not make the entire app client-only for a local control. Follow the [Next.js data-security guidance](https://nextjs.org/docs/app/guides/data-security) while preserving the HTTP boundary required here.

## 7. API access

One typed transport in `api/` handles base path, credentials, CSRF, request IDs, envelopes and safe errors; feature API functions call it. Generated OpenAPI types plus runtime boundary validation where useful; no unchecked `as` conversion for network payloads. SSR transport uses the same contract. No scattered component fetches, arbitrary backend origins, provider capture requests or silent catch blocks.

## 8. Server-state/cache

TanStack Query for browser API state. Keys include resource/query filters and actor scope; clear private query caches on logout/account change/disable. Never persist private query data in localStorage. Public Template caching may be stale briefly; create action handles backend availability check. Private SSR/recipient/media responses no-store; no global shared cache for an owner's content. Mutations invalidate affected Project/readiness/list keys. Avoid optimistic payment/share/Order transitions; display committed outcome only.

## 9. Local UI state

React component state/reducer holds tab, dialog, selected Month, crop and unsaved field drafts. Distinguish draft from persisted Project version. Preserve unsaved inputs on recoverable error and show save status; never display unsaved content as an ordered version. Introduce a small state store only when a demonstrated workspace need warrants it, not as a second API database.

## 10. Forms

Use shared FormField/controls and a consistent schema-aware form approach (Zod with a form library if useful). Required/optional labels, keyboard submit, stable IDs, inline errors and summary. Maintain current ETag and explicit save intent. Destructive confirmation uses shared Dialog, safe initial focus and specific consequence. Disable repeat UI submit while reusing the same idempotency key; timeout alone must not create a new intent.

## 11. Validation

Frontend mirrors limits for early assistance, consumes backend field errors and respects BR-VAL-001. Validate current calendar date/year, image count and byte/duration guidance before upload where possible. Do not assume those checks authorize the operation. Zero Special Dates is allowed for a particular Order; all twelve Months need not have unique photos. AR reveal accepts image+message, video+caption/transcript or audio+transcript/caption.

## 12. Design System consumption

[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) is the single visual authority. Implement its token registry once; components consume named semantic roles. Never redefine values in feature docs/styles. Foundations→primitives→composites/layout→feature components→pages. First prove public page, form/dialog and Admin data view across required themes/languages before scaling.

## 13. Component taxonomy

Primitives/composites/layouts contain no entity ownership, pricing or provider logic. Buttons, fields, Dialog, Drawer, Tooltip, Menu and status feedback share one behavior implementation. Avoid custom per-feature modal/focus logic. Accept semantic props rather than color strings. UI examples can show product data without making generic controls domain-aware.

## 14. Feature components

TemplateCard, MonthSelector, OrderSummary, ARScannerUI and recipient viewer live with their features. Each explicitly maps ready/loading/error/empty/disabled states. Do not create a generic “everything card” that handles unrelated account, Order and AR semantics.

## 15. Styling

Semantic tokens, approved type/space/radius/layer scales, scoped component styles and predictable variants. No hardcoded semantic color, arbitrary z-index, global `.bg-white` remapping, stylesheets that bypass approved tokens or secret broad overrides. An optical exception is measured/documented/reviewed under Design System governance.

## 16. Responsive implementation

Follow Design System breakpoints/compositions; test 320px reflow, target widths and contained scrolling for exceptional canvases. Studio preview remains usable, tools become accessible drawers, Admin tables become labeled lists. DOM reading order remains meaningful; virtual keyboard/safe areas cannot hide save/pay/exit controls.

## 17. Light/dark

Use the approved semantic light/dark mappings everywhere, including controls/statuses/overlays. Respect OS on first use and explicit preference thereafter. A physical calendar preview may retain paper material; surrounding controls follow selected theme. Preference may persist as a nonsecret setting; authentication never does.

## 18. Internationalization

Vietnamese and English system dictionaries cover public/workspace/recipient/Admin/auth/payment/AR/error copy. No hardcoded bilingual conditionals in components. Canonical API codes map through dictionaries; dates/currency format appropriately while USD amounts stay identical. User-authored text remains authored language; no auto-translation. Test text expansion/diacritics and labels at zoom.

## 19. Accessibility

Meet Design System WCAG 2.2 AA baseline: semantic landmarks/headings, keyboard/focus, control labels, announcement restraint, accessible dialog/drawer, contrast, reduced motion, reflow/zoom. Preview has readable data/list alternative. Image AR has meaningful text; video/audio have required caption/transcript. Fallback is available without camera/hover. Exceptions require explicit reviewed documentation.

## 20. Loading/error/empty

Distinguish initial load, refresh, empty data, no filter matches and failed fetch. Keep meaningful transaction/save outcomes persistent, not toast-only. Retry preserves inputs and original intent. Skeletons do not appear as active controls. Status speaks accurately: verification pending, confirmed cancellation, simulated fulfillment.

## 21. Authentication UX

Session bootstrap provides safe principal/CSRF; tokens stay memory-only. Login/logout follow cookie API. 401 prompts login while preserving safe nonsecret navigation context; logout clears all private data/recipient state as appropriate. Disabled-account result ends protected interaction. Recovery is P1, not a fabricated P0 feature. Never store auth/session/share credentials in localStorage.

## 22. Authorization UX

Show only relevant owner/recipient/Admin actions for clarity, then accept backend rejection safely. Do not prefetch another user's Project as a role experiment. Admin has no draft editor; recipient has no Order/account panel. Route guards aid navigation, not security.

## 23. Media upload UX

Backend authorizes UploadIntent; browser uses returned bounded provider upload fields; backend finalizes verified facts. Show type/size/duration rules, progress/cancel/retry, Pending/Ready/Unavailable. A direct upload result is not Ready until backend confirms. Attach only owned Ready assets, update Project version on save. Render private media through scoped backend paths; do not use shared Next image optimization/CDN caching for private assets.

## 24. AR UX

Scanner follows Design System instructions/permission/init/scanning/found/not-found/reveal/unsupported states. AR SDK remains unselected until I03 evidence. Recognition result resolves only within authorized recipient/owner version; never directly fetch a global target URL. Explicit camera start, exit and fallback. Stop camera tracks on leave. Same meaningful image/video/audio/text available via fallback; video preference for presentation is not required business content.

## 25. Payment UX

Checkout displays USD summary and sandbox/no-real-shipment disclosure before commitment. Submit quantity/contact/reviewed revision only; backend returns authoritative total. Persist same logical request key in memory through retry/navigation as needed without secrets; recover Order via account history after reload. Approval/return query is only a signal; show Verifying until backend evidence. Bounded polling/backoff; Failed/Cancelled retry same unpaid Order, paid cancellation absent. No capture SDK business logic in frontend.

## 26. Error handling

Map stable error/messageKey to VI/EN; fieldErrors connect to exact controls; request ID assists support. 412 triggers current-version review rather than silent overwrite; 409 explains state/intent conflict. 503 payment refresh keeps uncertainty/pending. Do not expose raw provider text, stacks or hide API errors behind success.

## 27. Security

No DB/payment/storage secret in public environment variables, bundles or props. Treat UGC as text unless separately reviewed sanitization allows markup. Recipient link fragment exchanged once and removed, with no-referrer/no-store/no third-party tracking; do not log link/body/cookies. Scoped media native requests carry same-origin cookies; no external redirect containing private fields. Synchronizer CSRF sent only to trusted backend. CSP/permission settings reviewed alongside AR spike.

## 28. Performance

Public SSR/static shell where useful; paginate catalog/account lists; lazy-load AR runtime and heavy media tools. Responsive public images, bounded upload concurrency, avoid eager private video downloads. Query caching reduces duplicate API reads within session, not access checks. Measure Studio interaction on target mobile device; no premature global state/cache infrastructure.

## 29. SEO/public pages

Public product/help/active Template content can be server-rendered using backend public contract with consistent metadata. Private Studio/account/checkout/Admin/recipient pages use noindex and private cache handling. Never index bearer links or user photos by default. Blog remains P2; no SEO dependency on OUT newsletter/reviews/comments.

## 30. Testing

Vitest + Testing Library for forms/components/query states; Playwright + axe for integrated journeys and visual regression. Verify generated contract types, response projections, keyboard/focus, VI/EN/theme, 320px/200% and sandbox return uncertainty. Use test adapters/fixtures per Testing Strategy; final AR/payment require genuine device/provider evidence.

## 31. Naming

PascalCase components; `use…` hooks; feature-related files use business terminology; `…Request/…Response` generated DTO types; `…Query/…Mutation` distinguish API behavior. No fake business states like ProjectPaid or OrderShipped. Avoid barrel import cycles and ambiguous global helpers.

## 32. Forbidden patterns

Prisma/database access; localStorage auth token; frontend-only authorization/pricing; payment success from redirect; provider secrets; scattered fetch; unchecked payload assertions; hidden errors; mutable Project used to display an existing immutable Order; token/color redefinition; one-off modals; guessed private target resolution; public cached private media; P2 imports required by P0.

## 33. Review checklist

Reviewer checks typed API/ownership projection, UI-only state, idempotency/version handling, no secret/cache leaks, required feedback, Design System reuse, VI/EN/theme/accessibility/responsive evidence and meaningful tests. Feature PR names affected authority rules and has no unapproved capability. [Development Workflow](DEV_WORKFLOW.md) governs review/change process.
