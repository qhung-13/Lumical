# LumiCal — Product Scope

Status: **R02 product authority for the new LumiCal university project**. Course: **Đồ án thực tế Công nghệ phần mềm**. This document defines **what** the product includes and the observable experience it must provide. It does not select a framework, database, API design, AR technology or payment integration method. It stands alone for a team building LumiCal as a new project from scratch. “Required final project” below means the product must work as one demonstrable journey, not that every possible enhancement is mandatory.

## 1. Product definition

**One sentence:** LumiCal is a web-based platform for creating personalized twelve-month calendars that combine personal photos, meaningful dates and messages with a shareable AR experience and an academic sandbox ordering flow.

LumiCal helps a person turn memories into a calendar for someone they care about. The creator chooses a template, personalizes each month with their own content, adds important dates, previews the result and can order it through a clearly labeled demonstration payment flow. The recipient can access shared calendar content and reveal linked digital media through an AR experience, with a non-AR path when camera access or device support is unavailable.

It is a **personalized memory product**: the calendar is useful as a dated object, but its photographs, messages, dates and interactive reveal are the central value. The interface should be calm and understandable for non-designers. LumiCal is not a generic calendar utility, a free-form design editor or a marketplace.

## 2. Product problem

Conventional calendars are usually generic and static. Personal photos, important dates and messages may be scattered across separate tools, while creating a personalized gift can require different steps for design, sharing and ordering. A printed calendar can also lose its interactive value after it is produced. LumiCal addresses this gap by providing one guided journey from calendar personalization to a recipient-facing digital/AR experience and a demonstrable order. This is a product problem statement, **not** a claim about market size or measured user demand.

## 3. Observable product goals

| Goal | Observable outcome for acceptance |
| --- | --- |
| G1 — Make a meaningful calendar | A registered creator can create, save, reopen and preview a calendar with twelve editable months, personal media, messages and important dates. |
| G2 — Keep creation understandable | A first-time user can move from template choice through preview with clear steps, validation and recovery from errors, without needing a graphic-design tool. |
| G3 — Connect calendar and memory | A recipient can use a defined calendar target to reveal at least one owner-linked AR media experience; the same meaningful content remains accessible through a non-AR fallback. |
| G4 — Complete the demonstration purchase journey | A creator can see a price/order summary, place an order, complete a clearly labeled PayPal Sandbox demonstration payment and view an appropriately verified outcome. |
| G5 — Let users return and operate the product | Creators can find their own projects and orders; an admin can maintain templates, inspect orders/payment results and update demo fulfillment status without direct data manipulation. |
| G6 — Be usable across the approved experience | Core journeys work in Vietnamese and English, light and dark themes, responsive layouts and the approved accessibility baseline. |
| G7 — Protect personal material | Personal projects start private; sharing is deliberate; a normal user cannot browse another user's private project through the product. |

These are product outcomes. Exact permissions, state transitions, limits and test methods will be specified later.

## 4. Non-goals

LumiCal is **not** a general-purpose graphic/vector editor, a multi-vendor marketplace, a social network, an enterprise AR authoring suite, a banking/payment processor, or a full logistics/ERP system. It does not need a large CMS or an advanced analytics platform to fulfill its calendar promise. The final project is a focused academic demonstration of a coherent product, not a production commercial launch.

## 5. Target users and contextual actors

“Registered user” and “Admin” are account-level roles; “calendar owner,” “recipient/viewer” and “contributor” describe a person's relationship to a specific calendar or interaction. One person can be a user and an owner; a recipient need not be a registered user. This is a product-level distinction, not the final authorization matrix.

| Actor | Who / main goal | Generally can do | Cannot do at product level |
| --- | --- | --- | --- |
| **Guest** | Visitor deciding whether LumiCal is useful. | Discover the product and active templates, read public guidance, register/login. | Edit private calendars, order on behalf of another person or access unshared personal content. |
| **Registered user** | Person with a LumiCal account. | Create and manage their own calendars and orders, choose language/theme. | Manage another user's private material or administrative catalog/order data. |
| **Calendar owner** | Registered user who created a given calendar. | Personalize it, preview it, decide when/how it is shared, order it and review related status. | Treat another owner's calendar as their own; declare a sandbox payment complete. |
| **Recipient / viewer** | Person invited to experience a shared calendar, possibly without an account. | Access explicitly shared recipient content and its AR/non-AR experience. | Edit the owner's project, see private account/order/contact information, or gain access to unrelated calendars. |
| **Contributor** | Person invited to send a wish if that optional capability is enabled. | Submit content to the intended calendar and view only what the owner explicitly makes available. | Publish directly to all viewers, modify the calendar or see owner/private order information. |
| **Admin** | Authorized operator for the course demonstration. | Maintain templates, inspect orders/payment references, manage demo fulfillment and perform necessary support actions. | Treat admin access as permission to publish personal content indiscriminately or process real money outside the product scope. |

## 6. Core user value journey

**Discover a template → create a private calendar → personalize its twelve months with photos/messages and important dates → link at least one personalized AR reveal → preview/save → review order and demo price → complete a clearly labeled PayPal Sandbox payment → revisit the order → explicitly share recipient access → recipient points a capable device at the defined calendar target and sees the reveal (or uses the non-AR fallback).** Admin supports template availability and the order's demonstration fulfillment. The journey is not tied to any particular existing screen or technical implementation.

## 7. Capability map and scope levels

Scope levels mean: **CORE** directly delivers the differentiated calendar journey; **REQUIRED SUPPORTING** makes that journey usable, safe or demonstrable; **OPTIONAL / STRETCH** is valuable only after the whole mandatory journey works; **OUT OF SCOPE** is excluded from this university project. Priorities are defined in §25. The product reason is stated for every retained item.

| ID / capability | Purpose and primary actors | Product value | Scope level / priority | Depends on |
| --- | --- | --- | --- | --- |
| C01 Identity/account | Guest/user sign-up and login. | Establishes an owner for private work. | CORE / P0 | Clear account experience. |
| C02 Template catalog | Guest/user explores active starting designs. | Gives non-designers a useful starting point. | CORE / P0 | Admin template availability. |
| C03 Calendar project | Owner creates, saves, reopens a calendar with year, title and recipient context. | Persistent personalized gift/workspace. | CORE / P0 | C01, C02. |
| C04 Calendar Studio | Owner works through guided personalization. | Makes creation understandable rather than free-form. | CORE / P0 | C03, C26. |
| C05 Monthly customization | Owner edits all twelve months. | Calendar is personal throughout the year. | CORE / P0 | C03, C04, C06. |
| C06 Personal media management | Owner selects/uploads and manages personal images and AR-linked media. | Carries the memories and reveal. | REQUIRED SUPPORTING / P0 | C01, privacy, C26. |
| C07 Special dates/events | Owner records meaningful dates, labels and notes. | Connects the calendar to personal life events. | CORE / P0 | C03, C05. |
| C08 Calendar preview | Owner reviews overall and month-level result before ordering/sharing. | Prevents accidental or unclear output. | CORE / P0 | C03–C07. |
| C09 Explicit sharing/recipient access | Owner grants access; recipient opens only shared content. | Makes the gift usable by its recipient. | CORE / P0 | C03, C06, privacy. |
| C10 AR experience | Recipient uses a designated calendar target to reveal linked media, with non-AR fallback. | Signature interactive memory experience. | CORE / P0 | C06, C09, media readiness. |
| C11 Wishes/contributions | Invited contributor sends a message for owner review. | Adds voices from friends/family. | OPTIONAL / STRETCH / P2 | C09, moderation/privacy. |
| C12 Order/checkout | Owner reviews price and delivery context, places an order for a project. | Completes the calendar-to-order path. | CORE / P0 | C03, C08, C01. |
| C13 International sandbox payment | Owner completes a non-real-money academic payment demonstration, preferably PayPal Sandbox. | Demonstrates a credible international checkout journey. | CORE / P0 | C12, verified result experience. |
| C14 Account project/order views | Owner finds own saved projects and orders. | Supports returning to work and checking progress. | REQUIRED SUPPORTING / P0 | C01, C03, C12. |
| C15 Essential administration | Admin manages templates and orders/payment result/demo fulfillment. | Makes the demo operable without direct data edits. | REQUIRED SUPPORTING / P0 | C02, C12, C13. |
| C16 Blog/editorial content | Visitor reads a small set of product/help stories if capacity permits. | Supports explanation/discovery, not calendar creation itself. | OPTIONAL / STRETCH / P2 | Public content ownership, C23. |
| C17 Basic notifications | Owner receives in-product notice of meaningful order or contribution changes. | Helps users notice changes without repeatedly checking. | REQUIRED SUPPORTING / P1 | C14; C11 if wishes enabled. |
| C18 Reviews/testimonials | Public rating/social proof. | Not needed to prove the core journey; moderation cost. | OUT OF SCOPE / OUT | None in final project. |
| C19 Newsletter | Subscription to marketing email. | Not needed to create, order or experience a calendar. | OUT OF SCOPE / OUT | None in final project. |
| C20 Product analytics | Privacy-conscious aggregate use of product/scan events. | May inform later improvement, not demo completion. | OPTIONAL / STRETCH / P2 | Consent/privacy decisions. |
| C21 Blog comments/likes | Public reactions to editorial content. | Adds moderation/social complexity without aiding core value. | OUT OF SCOPE / OUT | C16 would be required if reconsidered. |
| C22 Password recovery | User can regain an account without operator intervention. | Improves completeness after core auth is working. | REQUIRED SUPPORTING / P1 | C01. |
| C23 Vietnamese/English interface | All product/system/admin/payment/AR copy can switch language. | Makes the approved two-language product usable. | REQUIRED SUPPORTING / P0 | Content/copy review. |
| C24 Light/dark themes | User can choose a readable theme. | Supports comfort and the approved identity. | REQUIRED SUPPORTING / P0 | Approved Design System. |
| C25 Accessibility and responsive use | Core journeys work by keyboard/assistive tech, zoom and mobile. | Prevents exclusion and broken demos. | REQUIRED SUPPORTING / P0 | Approved Design System, all screens. |
| C26 Feedback states | Loading, validation, empty, success, failure and retry are understandable. | Makes every core task recoverable. | REQUIRED SUPPORTING / P0 | All interactive capabilities. |
| C27 Advanced AR effects/recap | Richer overlays, yearly recap or effects beyond one reliable reveal. | More expressive gift after AR baseline is solid. | OPTIONAL / STRETCH / P2 | C10. |
| C28 Music/audio extras | Spotify-style linking or decorative audio beyond essential linked media. | Adds atmosphere but is not needed for the initial reveal. | OPTIONAL / STRETCH / P2 | C06, C10, rights/privacy. |
| C29 Recipient reactions/scan analytics | Viewer reacts or owner sees engagement history. | Optional feedback about recipient experience. | OPTIONAL / STRETCH / P2 | C09, consent/privacy. |
| C30 Advanced admin analytics | Revenue charts and richer operational reports. | Useful only after transactions and operations exist. | OPTIONAL / STRETCH / P2 | C12–C15, privacy. |

## 8. Minimum complete final-project product

The **P0 product** is one coherent, live-capable journey. Every item below is required because removing it breaks creation, recipient experience, purchase demonstration or operation—not because it appeared in prior software.

| Required item | Why it is needed in the final demo |
| --- | --- |
| Account registration/login and private ownership | Calendar work and orders must have a recognizable owner. |
| Active template discovery | A non-designer needs a guided starting point; admin can make templates available/unavailable. |
| Calendar project and guided Studio | Creator needs a persistent place to make and revisit the calendar. |
| Twelve editable months | The result must be a full-year calendar, not a one-page mockup. Each month can be reviewed and personalized; distinct media in every month is not required for the demo. |
| Personal image/media and a designated AR-linked item | The product's memory and AR promises need real user-chosen content. |
| Personal/special dates | Calendar must represent meaningful events beyond stock dates. |
| Preview and save/edit | Creator can catch mistakes and return later. |
| Explicit recipient access and AR reveal with fallback | The recipient's experience is a signature requirement, not a later optional effect. |
| Order/checkout and clear summary | Creator can commit the personalized calendar to a demonstrated order. |
| PayPal Sandbox-preferred international payment demo | Completes the academic purchase flow without real-money claims; result must eventually be verified by the backend. |
| Account project/order views | Owner can see saved work and the order/payment outcome. |
| Essential admin template/order/payment/fulfillment view | Faculty can see that the system is operable without direct data manipulation. |
| Usability baseline | VI/EN, light/dark, responsive layout, accessibility and clear feedback apply to the whole journey. |

P0 does **not** require a separate photo in every month, AR on every page, real printing/shipping or advanced social/marketing services. All twelve months must nonetheless be individually editable and reviewable. Exact completion requirements and limits belong in Business Rules.

## 9. Required supporting features

P0 supporting work includes safe media selection/upload, clear error/loading/empty and retry states, private-by-default project access, responsive/mobile composition, VI/EN product copy, light/dark themes, accessibility, order/payment status display and the essential admin experience. These do not individually differentiate LumiCal, but the P0 journey is unusable or misleading without them.

After P0 is coherent, P1 adds self-service password recovery and basic in-product notifications for meaningful changes. Order/payment outcomes remain visible in the account at P0 even if separate notifications are not yet present. Supporting features are not a reason to add unrelated dashboards or external marketing integrations.

## 10. Optional / stretch features

Only after all P0 capabilities work together: moderated wishes can enrich a gift with others' voices; advanced AR effects/recap can deepen the signature experience; music/Spotify-style extras may add atmosphere; recipient reactions/scan insights may provide feedback; a small editorial blog may explain the product; aggregate analytics and advanced admin reporting may support improvement. Each requires its own privacy, moderation, rights or operational review. None is a substitute for the required camera-to-content AR reveal or the complete order/payment demo.

## 11. Explicitly out of scope for this course project

No real-money production transactions, banking reconciliation, stored card/payment credentials, native iOS/Android apps, multi-vendor commerce, professional free-form/vector design, enterprise inventory/ERP, carrier/logistics integration, real-time collaborative editing, social-network features, complex CMS, AI-generated designs, public reviews/testimonials, marketing newsletter, or blog comments/likes. Actual physical printing/shipping is not performed as part of the software demonstration. These exclusions may change only through explicit scope approval; they are not implied backlog commitments.

## 12. Calendar personalization promise

| Level | P0 user capability | Boundary |
| --- | --- | --- |
| Calendar | Set a title/name, calendar year and recipient/context; choose an active template and limited approved style/color/layout presets. | Not a blank-canvas editor; template structure remains recognizable. |
| Month | Open each of twelve months; select/upload at least one personal photo where desired; add a short caption/message and choose linked personalized content for designated AR use. | Every month is editable, but twelve distinct uploads and AR on every month are not required. |
| Date/event | Add birthdays, anniversaries, milestones or custom personal events with date, label and optional short note/message. | Event-level extra media is stretch; exact date limits/validation belong to Business Rules. |
| Preview | See the whole calendar and month detail, including media/AR readiness and clear missing-content feedback, before ordering or sharing. | Preview must not silently claim production print fidelity that has not been defined. |

Visual customization is **curated**, not Canva-like free positioning. The product lets people make a thoughtful calendar without requiring design expertise; exact preset inventory is a later design/content decision.

## 13. AR product scope — signature final-project experience

From the **owner's perspective**, LumiCal lets them associate a short personal digital reveal—such as a video greeting or audio message with readable text/caption—with at least one designated calendar page/target. The owner can preview whether that experience is ready and decide whether recipient access is shared. Ordinary personal photos and messages remain meaningful even if AR is not used.

From the **recipient's perspective**, they receive an explicit way to access the shared calendar experience, see concise scan instructions, grant camera permission when needed, point a capable device at a defined calendar page/marker and have LumiCal resolve the intended target and reveal the linked media. The final product must demonstrate at least **one genuine target-to-personalized-content reveal**. The target format and recognition technology are intentionally undecided here.

AR content categories for the required experience are **personal photo/context, short video or audio greeting, and readable text/caption**. Advanced effects, multiple simultaneous overlays and yearly recap are P2. If camera permission is denied, target recognition fails or the device is unsupported, the recipient gets a clear explanation, retry/help where useful and a **non-AR path to the same authorized content**. The experience must not dead-end or reveal unrelated private media. No autoplay audio is required. Owner media and recipient access remain private unless explicitly shared; exact access duration, limits and moderation rules belong to Business Rules. No AR SDK or implementation is specified.

## 14. Order and payment product scope

A calendar owner orders **their personalized project**, not an unconfigured template. Checkout shows the selected calendar, quantity/price and any delivery/contact information before the commitment action; order and payment are separate concepts. LumiCal demonstrates an **international payment flow**, currently preferring **PayPal Sandbox**. Users must be told when a transaction is a **non-real-money academic sandbox transaction**. Returning from a provider or a frontend success screen alone must never be represented as verified payment; later Business Rules and Architecture will define how the backend confirms it. The product displays clear ready, approval, processing, completed, cancelled, failed and retry outcomes without inventing final technical state names here.

**Fulfillment interpretation: B — manually managed by Admin for the course demo.** Admin can review the order and update a simple fulfillment progress indication. Real printing, packaging, carrier booking and delivery are **simulated operational steps**, not commitments to ship a physical item. This gives the order an observable post-payment lifecycle without building logistics/ERP. Required delivery/contact details must be proportionate to the demonstration and handled privately; no actual shipment is promised.

## 15. Minimum Admin product scope

Admin can create/update/activate or deactivate templates used for discovery; inspect orders and the associated calendar context necessary to support them; see the sandbox payment result/reference; and update manually managed demo fulfillment progress. Admin may view a minimal user identity/contact summary when needed for an order, not a broad surveillance view of all personal content. Any support access to private calendar media needs explicit later permission/audit rules. Content management is relevant only if the P2 blog is approved. No inventory, reconciliation, enterprise reporting or real logistics integration is required.

## 16. Content and marketing capability decisions

| Capability | Decision | Product reason |
| --- | --- | --- |
| Blog/editorial | **B — Optional / stretch (P2).** A small set of curated public stories or guides may explain the calendar/AR experience if the core is complete. | Helpful for discovery and guidance, but not necessary to create, order or experience a calendar. A full CMS is not part of scope. |
| Blog comments/likes | **C — Out of scope.** | Adds public moderation and social interactions without improving the primary calendar journey. |
| Newsletter | **C — Out of scope.** | Marketing list operations are not needed for the academic product demonstration. |
| Reviews/testimonials | **C — Out of scope.** | Social proof is not required; collecting public claims and moderation would distract from private personalized content. |

Product/help copy needed for core navigation and AR/payment instructions is **P0 UI content**, not a “blog” dependency. The exclusion of comments/likes applies to editorial content; optional recipient wishes and reactions are separately classified in §7.

## 17. Internationalization requirement

Vietnamese is the primary authored product language. Users can switch between **Vietnamese and English** for navigation, forms, validation, AR instructions, account/admin views, order/checkout, sandbox-payment explanations and status/error/result copy. The selected language should remain consistent across the user's journey rather than switching unexpectedly between pages. User-uploaded media, names, captions, wishes and other user-generated text remain in the language written by their author; LumiCal does **not** promise automatic translation. Product-managed template/content copy included in P0 should be understandable in both languages. This is a product expectation, not an i18n implementation plan.

## 18. Light/dark theming requirement

Users can use **light and dark** themes across public, studio, recipient, checkout, account and admin experiences. Both are first-class and follow the approved Design System; the product preserves readability and clear status/focus in either theme. A physical calendar preview may remain paper-like inside a dark interface. Theme choice should feel consistent while navigating. This document deliberately does not repeat token values or prescribe storage mechanisms.

## 19. Accessibility requirement

Accessibility is a **product requirement**, not optional polish. The approved Design System sets **WCAG 2.2 AA as LumiCal's baseline**, with any exception documented, justified, scoped and reviewed; this is not a claim of certification. The required journeys must be usable with keyboard and assistive interaction, visible focus, labeled controls/feedback, 200% zoom/text resize and 320px reflow. AR has an accessible non-AR path to authorized content. Detailed visual and component acceptance criteria belong to `DESIGN_SYSTEM.md`, not this scope document.

## 20. Privacy and user-data scope

LumiCal handles account identity, personal photos/video/audio, calendar captions and dates, recipient-facing messages, recipient access, order/contact information, AR/media access and sandbox payment references. Projects and personal media are **private by default**. Sharing is an explicit owner action that exposes only the intended recipient experience; private account, address, order and unrelated project material remain protected. Users must be able to understand when they are sharing content and with whom the access is intended. The product does not store payment credentials, and sandbox data must not be mistaken for real payment proof. Media ownership, retention, revocation, contributor moderation and detailed access policy will be specified in Business Rules and later authority documents; no database or encryption design is implied here.

## 21. Product objects needing lifecycle rules

**Each object below has a lifecycle that must be formalized in `BUSINESS_RULES.md`.** This document intentionally does not define final status enums or transition conditions.

| Object | Product-level reason its lifecycle matters |
| --- | --- |
| Calendar Project | Creation, editing, preview readiness, sharing, ordering and possible archival/deletion affect owner and recipient. |
| Order | Placing, reviewing, cancellation and manual demo fulfillment are distinct events. |
| Payment | Sandbox initiation, approval, verification and failure/cancellation must not be conflated with an order. |
| Template | Active/inactive availability affects new calendar creation and existing projects. |
| AR Experience / media readiness | Missing media, target readiness, unsupported access and replacement affect the recipient journey. |
| Contribution/Wish, if P2 is approved | Submission, owner review and recipient visibility require moderation semantics. |

Account recovery, sharing/access revocation and admin support authority also need rules, but are not assigned technical states in Product Scope.

## 22. Top-level supported product flows

These describe **P0** product journeys. No endpoint, page path or storage design is implied.

| Flow | Actor / goal | Starts when → ends when | Capabilities involved |
| --- | --- | --- | --- |
| F01 — Discover | Guest finds a suitable starting design. | Opens LumiCal → understands available active templates and can select one. | C02, C23–C26. |
| F02 — Join | Guest becomes an identified creator. | Chooses register/login → has an active account session or a clear recoverable error. | C01, C26. |
| F03 — Create | User establishes a calendar for a person/year. | Selects template → has a private saved project with twelve editable months. | C02–C05. |
| F04 — Personalize | Owner adds personal content. | Opens Studio → attaches media, captions and meaningful dates, with changes retained. | C04–C07, C26. |
| F05 — Preview/save | Owner checks result and returns later. | Requests preview/save → sees a reviewable calendar and can reopen it. | C03, C08, C14. |
| F06 — Order | Owner commits a personalized project. | Opens checkout → sees summary/price and places an order with clear outcome. | C08, C12, C26. |
| F07 — Sandbox pay | Owner completes academic payment demo. | Chooses sandbox payment → sees verified completion or clear cancelled/failed/retry outcome, explicitly non-real-money. | C12, C13, C26. |
| F08 — Manage | Owner returns to projects/orders. | Opens account → sees only own projects, order and payment/fulfillment information. | C01, C14, C26. |
| F09 — Receive/AR | Recipient experiences a shared calendar. | Receives explicit access → scans designated calendar target, sees linked content or authorized non-AR fallback. | C06, C09, C10, C25–C26. |
| F10 — Operate | Admin keeps demo viable. | Opens admin workspace → manages template availability, reviews payment/order and updates demo fulfillment. | C02, C12–C15. |

P1 password recovery/notifications and P2 contributions/blog/analytics have their own later use cases if included; they are not prerequisites for the ten-flow core demonstration.

## 23. Official university demonstration scenario

1. A visitor opens LumiCal, switches between VI/EN or light/dark briefly, and browses active templates.
2. The visitor registers or logs in, selects a template, and creates a private calendar for a named recipient and year.
3. The owner opens the Studio, edits two distinct months live, adds personal photos/messages and one meaningful date, then shows that all twelve months are individually editable.
4. The owner links one short personal media reveal to a designated calendar target, previews the calendar and saves it.
5. The owner reviews the order summary and price, places an order, and proceeds to the **clearly labeled PayPal Sandbox non-real-money demonstration**.
6. A successful sandbox result is shown only after the product has received the appropriate verified outcome; the owner opens their account to view the order and payment status.
7. An admin views the order/payment reference and updates manually managed **demo** fulfillment progress.
8. The owner explicitly shares recipient access. A recipient uses a prepared calendar target and capable device to open the AR experience, reveal the linked media and see the non-AR fallback path.

The prepared demonstration should include a tangible sample target if feasible; an on-screen target and accessible fallback are prepared as backups. **External-service outage fallback:** show a clearly labeled, pre-recorded capture/evidence of an earlier verified sandbox and AR run, then demonstrate the remaining local journey and non-AR content live. Never present a recording or simulated result as a live verified transaction/scan. This presentation fallback preserves a coherent explanation during an outage; it does **not** replace the requirement that P0 payment and AR work in acceptance testing before final handoff. No fallback mechanism is implemented by this document.

## 24. Semester product success criteria

| Criterion | Observable evidence at product level |
| --- | --- |
| SC1 Complete journey | A new user can go from template discovery to private calendar, preview, order, sandbox payment result and recipient AR access without direct data manipulation. |
| SC2 Real calendar scope | All twelve months can be opened, edited and revisited; at least one personal image/message and one special date appear correctly in preview. |
| SC3 Signature AR | A defined target triggers the intended personalized media on a supported device; denial/unsupported/no-target cases give clear help and a non-AR path. |
| SC4 Honest payment | Sandbox transactions are visibly non-real-money; completion is not asserted solely by the frontend; cancelled/failed cases have understandable next actions. |
| SC5 Operable admin | Admin can make a template available/unavailable, inspect an order/payment reference and update demo fulfillment without editing underlying data manually. |
| SC6 Ownership/privacy | Through normal product use, one user cannot open another user's private project; a recipient sees only explicitly shared content. |
| SC7 Usability | Core flow is available in VI/EN and light/dark, reflows at 320px/200% zoom, and supports keyboard/assistive interaction per the approved Design System baseline. |
| SC8 Recovery | Core save/upload/checkout/AR actions provide clear loading, error, retry and success feedback; entered work is not silently lost on a recoverable failure. |

These are outcomes for later acceptance criteria and testing strategy, not a claim that a future build already passes.

## 25. Final requirement-priority matrix

**P0** = mandatory for a complete final live-capable demo. **P1** = required supporting work after P0 is coherent; any deferral requires explicit scope approval. **P2** = stretch, only after P0 and P1 commitments are controlled. **OUT** = excluded for this university project. The capability map in §7 supplies purpose and actors; this matrix records the final rationale and dependency for **every** capability.

| ID / capability | Priority | Why at this priority | Depends on |
| --- | --- | --- | --- |
| C01 Identity/account | P0 | Private owned work requires identity. | Registration/login experience. |
| C02 Template catalog | P0 | Guided starting point is essential. | Admin template availability. |
| C03 Calendar project | P0 | Persistent gift object anchors the journey. | C01, C02. |
| C04 Studio | P0 | Non-designer creation needs guided workflow. | C03, C26. |
| C05 Monthly customization | P0 | Twelve-month personalization defines the calendar. | C03, C04, C06. |
| C06 Personal media | P0 | Memories and AR reveal need owner-selected content. | C01, privacy, feedback. |
| C07 Special dates | P0 | Meaningful events distinguish the gift. | C03, C05. |
| C08 Preview | P0 | User must review before ordering/sharing. | C03–C07. |
| C09 Sharing/recipient access | P0 | Recipient must reach the experience intentionally. | C03, privacy, C06. |
| C10 AR experience | P0 | Approved signature final-project requirement. | C06, C09. |
| C11 Wishes/contributions | P2 | Enriches gift but core works without it. | C09, moderation/privacy. |
| C12 Order/checkout | P0 | Demonstrates commitment to personalized product. | C03, C08. |
| C13 Sandbox payment | P0 | Approved international-payment demo direction. | C12, honest verification/result. |
| C14 Account views | P0 | Owner needs to revisit work and order outcome. | C01, C03, C12. |
| C15 Essential admin | P0 | Operates templates/orders without data edits. | C02, C12, C13. |
| C16 Blog/editorial | P2 | Helpful education/discovery, not core. | Content ownership, C23. |
| C17 Basic notifications | P1 | Improves awareness; account status view exists at P0. | C14, events. |
| C18 Reviews/testimonials | OUT | Moderation/social proof not needed. | None. |
| C19 Newsletter | OUT | Marketing list is unrelated to semester demo. | None. |
| C20 Product analytics | P2 | Improvement insight, not user journey. | Consent/privacy decisions. |
| C21 Blog comments/likes | OUT | Social moderation without core product value. | Would require C16. |
| C22 Password recovery | P1 | Account recovery after core auth is stable. | C01. |
| C23 VI/EN | P0 | Approved bilingual product expectation. | Product copy. |
| C24 Light/dark | P0 | Approved dual-theme experience. | Design System. |
| C25 Accessibility/responsive | P0 | Core flows must be usable across people/devices. | All screens, Design System. |
| C26 Feedback states | P0 | Errors and asynchronous tasks need recovery. | All interactive flows. |
| C27 Advanced AR/recap | P2 | Enhances, but cannot replace baseline AR. | C10. |
| C28 Music/audio extras | P2 | Optional atmosphere beyond essential media. | C06, C10, rights/privacy. |
| C29 Reactions/scan analytics | P2 | Optional recipient feedback with privacy cost. | C09, consent/privacy. |
| C30 Advanced admin analytics | P2 | Reports are unnecessary to operate demo. | C12–C15. |

## 26. Canonical product glossary

| Term | Canonical meaning |
| --- | --- |
| **LumiCal** | The web product for creating, ordering and experiencing personalized memory calendars. |
| **User** | A person with a LumiCal account. |
| **Guest** | A person browsing without an account. |
| **Owner** | The user who controls a particular Calendar Project. |
| **Recipient / Viewer** | A person explicitly granted access to a calendar's recipient experience, possibly without an account. |
| **Contributor** | A person invited to submit an optional wish for a calendar. |
| **Admin** | An authorized operator of templates and demo orders. |
| **Template** | A curated starting design and configuration for a new calendar. |
| **Calendar Project** | The owner's saved personalized calendar work, including its twelve months. |
| **Calendar Studio** | The guided product workspace for editing a Calendar Project. |
| **Month** | One of twelve editable calendar periods/pages in a Calendar Project. |
| **Special Date** | A personal event attached to a calendar date, such as a birthday or anniversary. |
| **Media** | Owner-selected photo, short video or audio used in calendar/recipient content. |
| **AR Experience** | The recipient-facing camera/target interaction that reveals linked personalized digital content. |
| **Target** | The defined calendar page/marker the recipient points a capable device at for AR; exact technology is not specified here. |
| **Non-AR Fallback** | Authorized access to the same meaningful content without camera-based recognition. |
| **Sharing** | The owner's explicit grant of recipient access to selected calendar content. |
| **Wish / Contribution** | An invited person's optional message for a calendar, subject to later moderation rules. |
| **Order** | The owner's request to obtain the personalized calendar, with price and fulfillment context. |
| **Payment** | The separate transaction attempt/result associated with an Order. |
| **Sandbox Payment** | A clearly labeled non-real-money academic gateway transaction used to demonstrate payment flow. |
| **Fulfillment** | The post-order operational progress; manually updated and physically simulated in this course project. |
| **Product Scope** | Authority for what LumiCal includes and excludes, not its implementation design. |

## 27. Open product questions

**No unresolved product-scope question blocks the next Business Rules phase.** The calendar, AR, sandbox payment, admin and content decisions above are deliberate. Exact AR target technology, detailed permissions/state transitions, sandbox verification method, pricing rules and retention periods are **later authority decisions**, not missing R02 product scope. If course requirements change, record an explicit scope revision rather than silently adding a feature.

## 28. Traceability to future authority documents

| Authority document | Decision it owns |
| --- | --- |
| `PRODUCT_SCOPE.md` | **What** LumiCal includes/excludes and the required product journey (this document). |
| `BUSINESS_RULES.md` | **How** permissions, limits, lifecycles, pricing, payment verification and business invariants behave. |
| `DESIGN_SYSTEM.md` | **How** UI looks and behaves visually/accessibly across themes and densities; approved separately. |
| `ARCHITECTURE.md` | **How** frontend/backend and external responsibilities are divided. |
| `DATABASE.md` | **How** persistent business data and relationships are modeled. |
| `API_CONTRACT.md` | **How** frontend and backend exchange data and errors. |
| `FRONTEND_STANDARDS.md` | **How** frontend code is structured and reviewed. |
| `BACKEND_STANDARDS.md` | **How** backend code is structured and reviewed. |
| `TESTING_STRATEGY.md` | **How** product and technical requirements are verified. |
| `DEV_WORKFLOW.md` | **How** the team coordinates changes and reviews. |
| `ROADMAP.md` | **When** approved work is planned and delivered. |

No later document may silently expand this scope. It may refine behavior inside it or propose a reviewed scope change.
