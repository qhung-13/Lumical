# LumiCal Design System

Status: **Approved Design System v2 authority**. Scope: visual foundations, responsive composition, interaction patterns, and acceptance criteria for LumiCal. [Product Scope](PRODUCT_SCOPE.md) and [Business Rules](BUSINESS_RULES.md) own capabilities, permissions, pricing, payment evidence and lifecycle behavior. This document owns their visual presentation and accessibility contracts.

The frontend team maintains this system. Public and admin share tokens, controls and accessibility contracts; they use different **density presets**, not different brands. Token names are conceptual and implementation-neutral. Values are the approved baseline. Color ratios below were calculated for the stated opaque sRGB pairs; rendered states, images and overlays still require testing.

## 1. Design principles

| Principle | Meaning and why | Do | Don't |
| --- | --- | --- | --- |
| **Calm hierarchy** | A visitor should understand the page purpose and next action in a glance; consistent emphasis helps people identify their next action. | One primary heading and one dominant task CTA per view; group secondary actions near their content. | Use competing red/gold buttons, simultaneous glows or several equal-weight cards in one viewport. |
| **Warmth through material, not clutter** | LumiCal is a personal memory product, not a dashboard; warmth should come from paper, type and imagery. | Use warm neutrals, restrained terracotta, human copy and real calendar/media previews. | Add gradients, blobs, pills or chunky shadows to every section. |
| **Content before chrome** | Photos, calendars, messages and stories are the product. | Let content breathe on quiet surfaces; use dividers/spacing before extra cards. | Nest cards merely to separate every paragraph or control. |
| **One clear next step** | Creation and checkout are multi-step tasks; ambiguity increases error. | Show current step, save/payment status and a single next action; progressively reveal advanced options. | Hide critical status, mix destructive action with the main CTA, or force all settings open at once. |
| **Accessible by default** | People must be able to create, read and operate the product with keyboard, zoom, assistive technology and reduced motion. | Define semantic controls, focus, labels, contrast, 320px reflow and 44px preferred touch targets before visual polish. | Use color, animation or icon shape as the only carrier of meaning. |
| **Consistent interaction language** | The same action should look and behave the same in public, studio and admin contexts. | Reuse button/field/status/dialog contracts; keep permission and state labels explicit. | Invent a new validation, confirmation or loading pattern per feature. |
| **Mobile is composition, not shrinkage** | Studio, checkout and admin cannot simply compress desktop panels. | Reorder content, collapse sidebars into accessible tools, transform wide tables to lists. | Require horizontal page scrolling at 320px or hide essential actions behind hover. |

## 2. Hierarchy, emphasis and density

The standard reading order is: **page purpose/eyebrow (optional) → one H1 → short supporting description → primary content → primary CTA placed at decision point → secondary content/actions → persistent or local status/feedback**. Breadcrumbs precede the heading on detail pages. Never rely on visual size alone to establish heading order. A page may repeat the same primary action at the bottom of a long flow, but it is still one action, not two competing choices.

| Level | Treatment | Typical use |
| --- | --- | --- |
| Primary | `text-primary`, H1/H2, brand-filled CTA; at most one brand action within a decision group | Purpose, next step, main result. |
| Secondary | `text-secondary`, secondary/outline action, normal surface | Explanation, alternate non-destructive action. |
| Tertiary | `text-muted`, quiet link/ghost action, subtle divider | Metadata, optional hints, timestamps. Still meets text contrast. |
| Status | Semantic icon + word + color; inline near affected object, banner for page-wide effect | Saved, pending, success, warning, failure. |
| Destructive | Danger color, explicit verb and separation from primary actions; confirmation for irreversible operations | Delete project, revoke access. Never use brand as a synonym for danger. |

Density presets: **public** uses section rhythm 48px mobile / 64px desktop, card padding 24–32px and generous imagery; **admin** uses section rhythm 32–40px, compact data rows and 16–24px panel padding. Both keep body text at least 16px for primary reading and the same contrast/focus/target rules. Studio is a task workspace: compact tools around a spacious preview. Density is a layout choice, not permission to make admin labels illegible.

## 3. Consolidated token registry: color

### 3.1 Foundation palette (not direct component styling)

| Family | Approved swatches | Intended role | Do / don't |
| --- | --- | --- | --- |
| Paper neutral | `paper.0 #FFFDF9`, `.50 #FAF7F1`, `.100 #F4EEE4`, `.300 #D8CCBD`, `.600 #907D68`, `.800 #51453B`, `.950 #29221D` | Warm light materials and text. | Use semantic roles below in components; do not bind a button to a palette step. |
| Warm dark | `night.950 #181512`, `.900 #211C18`, `.800 #2B241F`, `.750 #29221C`, `.500 #5A4D40`, `.350 #8A7562`, `.200 #B8A998`, `.50 #F8F1E7` | Purpose-built dark surfaces, not inverted light colors. | Use semantic roles; do not translate `.bg-white` with global overrides. |
| Terracotta | `terra.soft #F3DCD2`, `.base #A43225`, `.link #9B2D22`, `.hover #87271D`, `.active #6F1F17`, `.dark-base #E58C7A`, `.dark-hover #F4A596`, `.dark-active #CE7463` | Main interaction identity. | Reserve filled terracotta for the primary decision; do not use it for every badge. |
| Warm gold | `gold.soft #F8E8CB`, `.base #D0A25F`, `.ink #765025`, `.dark #E7C38B` | Restrained brand accent/illustration, never a success/warning substitute. | Use on ornaments and special product detail; do not put small white text on gold base. |
| Decorative only | Blush `#EBD8D2`, sage `#E7EDDF`, sky `#E2EDF1` | Illustration/background accents behind content with verified foreground. | Never encode payment, validation or accessibility state with these values. |

### 3.2 Semantic light/dark roles — authoritative color token table

`color.*` tokens must be used by all components. Each row provides a approved exact light/dark value, intended use and a prohibition. A light/dark “surface” role describes material; shadow/elevation controls visual depth, while the separate `layer.*` scale controls stacking order.

| Token | Light | Dark | Usage / do | Don't |
| --- | --- | --- | --- | --- |
| `color.canvas` | `#FAF7F1` | `#181512` | App/page background. | Assume canvas is always white. |
| `color.surface` | `#FFFDF9` | `#211C18` | Default content surface, forms and cards. | Nest surfaces automatically. |
| `color.surface-raised` | `#FFFFFF` | `#2B241F` | Menus, floating panels, dialogs. | Use raised fill to simulate status. |
| `color.surface-subtle` | `#F4EEE4` | `#29221C` | Quiet field/chip/secondary-action area. | Use as a disabled text color. |
| `color.text-primary` | `#29221D` | `#F8F1E7` | Headings, body-critical information. | Render on unchecked photos. |
| `color.text-secondary` | `#51453B` | `#DDD0C0` | Descriptions, secondary body. | Use for disabled controls alone. |
| `color.text-muted` | `#665B50` | `#B8A998` | Metadata/help; still readable. | Reduce opacity further for essential text. |
| `color.text-inverse` | `#FFFDF9` | `#29221D` | Text on filled brand/danger actions. | Assume it fits every accent fill. |
| `color.border` | `#D8CCBD` | `#5A4D40` | Decorative dividers/nonessential outlines only. | Use alone as the sole boundary of an active control. |
| `color.border-strong` | `#907D68` | `#8A7562` | Control edges, interactive/selected boundary where needed. | Replace focus ring with it. |
| `color.brand` | `#A43225` | `#E58C7A` | Primary button fill and key active cue. | Use as danger without a danger role. |
| `color.brand-hover` | `#87271D` | `#F4A596` | Hover fill on brand action. | Change hue to indicate success. |
| `color.brand-active` | `#6F1F17` | `#CE7463` | Pressed brand fill. | Persist pressed state as selected state. |
| `color.brand-text` | `#9B2D22` | `#F4A596` | Links/emphasis on canvas/surface. | Use ununderlined color alone for links in body copy. |
| `color.focus` | `#A43225` | `#F4A596` | 2px visible outer keyboard focus ring. | Remove for aesthetic reasons. |
| `color.selected-bg` | `#F3DCD2` | `#563229` | Chosen chip/option surface. | Encode selection by fill alone. |
| `color.selected-text` | `#762319` | `#FFE9DF` | Text on selected surface. | Use generic muted text here. |
| `color.selected-border` | `#A43225` | `#E58C7A` | 2px selected option edge. | Confuse selected with focus. |
| `color.success` | `#276B42` | `#A8D6AC` | Success text/icon. | Treat as the only success message. |
| `color.success-bg` | `#E7F4EA` | `#203529` | Success banner/status background. | Put generic primary text on it without test. |
| `color.warning` | `#84500C` | `#F3C47B` | Caution text/icon. | Use for an actual failure. |
| `color.warning-bg` | `#FFF1D9` | `#3A2A18` | Warning banner/status background. | Replace explanatory copy with color. |
| `color.danger` | `#AA2925` | `#F5A59D` | Error text and destructive fill. | Reuse brand just because both are warm red. |
| `color.danger-hover` | `#8E211E` | `#FFC0B8` | Destructive button hover fill. | Apply to ordinary brand action. |
| `color.danger-active` | `#731A18` | `#DB8D85` | Destructive button pressed fill. | Treat pressed as completed deletion. |
| `color.danger-bg` | `#FCE9E5` | `#432522` | Error/destructive warning surface. | Use for ordinary required-field hints. |
| `color.info` | `#1C5F7A` | `#A7D4EA` | Neutral guidance/status text. | Use for a success claim. |
| `color.info-bg` | `#E6F2F7` | `#203644` | Guidance/status background. | Make every informative paragraph a banner. |

Gold and decorative values are intentionally **not** semantic statuses. Images/media can retain their own pixels. A physical calendar preview may keep an off-white paper material in dark mode, but surrounding controls, captions and focus indicators use dark semantic tokens; provide a defined border/shadow against the dark shell.

### 3.3 Contrast intent and calculated examples

Targets follow [WCAG 2.2 text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) (normal text ≥4.5:1, qualifying large text ≥3:1) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) (meaningful UI indicators/boundaries ≥3:1). All planned normal-text pairs below exceed 4.5:1. Ratios are rounded to two decimals for design review; color changes require recalculation. Hover/active and opacity-over-image combinations need separate implementation tests.

| Pair (foreground on background) | Light | Dark | Target / decision |
| --- | --- | --- | --- |
| Primary body on canvas | `#29221D` / `#FAF7F1` **14.65:1** | `#F8F1E7` / `#181512` **16.22:1** | ≥4.5; excellent body reserve. |
| Secondary body on canvas | `#51453B` / canvas **8.67:1** | `#DDD0C0` / canvas **12.00:1** | ≥4.5. |
| Muted/help on canvas | `#665B50` / canvas **6.18:1** | `#B8A998` / canvas **7.94:1** | ≥4.5; “muted” is never low-contrast. |
| Primary button | `#FFFDF9` / `#A43225` **6.75:1** | `#29221D` / `#E58C7A` **6.24:1** | ≥4.5; dark action uses dark ink, not white. |
| Secondary button | `#29221D` / `#F4EEE4` **13.57:1** | `#F8F1E7` / `#29221C` **13.98:1** | ≥4.5 plus visible interactive border when needed. |
| Destructive filled button | `#FFFDF9` / `#AA2925` **6.77:1** | `#29221D` / `#F5A59D` **8.02:1** | ≥4.5, danger label required. |
| Brand link on canvas | `#9B2D22` / canvas **7.03:1** | `#F4A596` / canvas **9.24:1** | ≥4.5 and underline in running text. |
| Selected option text/background | `#762319` / `#F3DCD2` **7.89:1** | `#FFE9DF` / `#563229` **9.54:1** | ≥4.5; add border/check mark. |
| Success text/status background | `#276B42` / `#E7F4EA` **5.67:1** | `#A8D6AC` / `#203529` **8.04:1** | ≥4.5. |
| Warning text/status background | `#84500C` / `#FFF1D9` **6.01:1** | `#F3C47B` / `#3A2A18` **8.52:1** | ≥4.5. |
| Danger text/status background | `#AA2925` / `#FCE9E5` **5.87:1** | `#F5A59D` / `#432522` **7.04:1** | ≥4.5. |
| Info text/status background | `#1C5F7A` / `#E6F2F7` **6.20:1** | `#A7D4EA` / `#203644` **7.92:1** | ≥4.5. |
| Interactive border on surface | `#907D68` / `#FFFDF9` **3.89:1** | `#8A7562` / `#211C18` **3.86:1** | ≥3. Default subtle border is decorative and **does not** meet this role. |
| Focus ring on canvas | `#A43225` / canvas **6.42:1** | `#F4A596` / canvas **9.24:1** | ≥3 non-text. Preserve visible offset against adjacent fills. |
| Selected border on selected bg | `#A43225` / `#F3DCD2` **5.22:1** | `#E58C7A` / `#563229` **4.44:1** | ≥3 non-text. |

Disabled controls may be lower contrast only when truly unavailable, but their state must also be conveyed semantically (`disabled`, explanatory text if needed). No content text is made faint merely to look disabled. Contrast is not waived for placeholders that carry instructions.

## 4. Consolidated token registry: typography, spacing, size, radius, elevation, layers, borders, motion and layout

### 4.1 Type scale

`type.*` uses CSS pixels at a 16px root equivalent; implementations should use relative units so browser text resizing works. Sizes are mobile / ≥960px desktop; `=` means unchanged. Baloo 2 retains expressive display/H1/H2 work; **Be Vietnam Pro** owns all essential UI/body labels and H3/H4; **Dancing Script** remains an optional short brand accent. Decorative/script text must never contain unique essential information: actions, status, price, navigation and instructions must not depend on it. If a decorative phrase visually duplicates meaningful nearby text, avoid exposing a confusing duplicate to assistive technology; keep the meaningful original accessible, and do not blindly add duplicate screen-reader-only copy. Font fallbacks must cover Vietnamese glyphs. Do not apply uppercase letter-spacing to long Vietnamese text or remove diacritics. No arbitrary 13.5/14.5px roles.

| Token | Light / dark value (family; size/line-height; weight) | Usage / do | Don't |
| --- | --- | --- | --- |
| `type.display-xl` | Baloo 2; **48/56 → 64/72**; 700 | One short marketing hero, ≤2 lines; smaller mobile role preserves reflow. | Use in admin or as a long paragraph. |
| `type.display` | Baloo 2; **40/48 → 52/60**; 700 | Campaign/product storytelling heading. | Stack with another display heading nearby. |
| `type.h1` | Baloo 2; **32/40 → 40/48**; 700 | One page title. | Use purely to enlarge unrelated text. |
| `type.h2` | Baloo 2; **28/36 → 32/40**; 700 | Major section heading. | Skip heading levels visually or semantically. |
| `type.h3` | Be Vietnam Pro; **24/32 =**; 600 | Subsection or card-group heading. | Substitute with decorative script. |
| `type.h4` | Be Vietnam Pro; **20/28 =**; 600 | Small section/panel heading. | Use for ordinary labels. |
| `type.body-lg` | Be Vietnam Pro; **18/28 =**; 400 | Intro/lead copy, not every paragraph. | Make long reading lines >72ch. |
| `type.body` | Be Vietnam Pro; **16/24 =**; 400 | Default reading and primary form content. | Shrink for density. |
| `type.body-sm` | Be Vietnam Pro; **14/22 =**; 400 | Secondary admin copy, compact supporting text. | Put long articles or legal copy here. |
| `type.label` | Be Vietnam Pro; **14/20 =**; 600 | Fields, tabs, buttons, table headers. | Use low-contrast muted color for required controls. |
| `type.caption` | Be Vietnam Pro; **12/18 =**; 500 | Timestamps/noncritical microcopy only; must still meet contrast. | Use for instructions, errors or body paragraphs. |
| `type.eyebrow` | Be Vietnam Pro; **12/18 =**; 700 | Short page category above H1; sentence case for VI/EN. | All-caps lengthy Vietnamese sentences. |
| `type.accent` | Dancing Script; **24/32 =**; 600 | Optional short decorative phrase; when it duplicates nearby meaningful copy purely for decoration, hide only the decorative duplicate from assistive technology. | Convey unique actions, status, price, navigation or instructions; add redundant screen-reader text. |

Vietnamese acceptance: use correct diacritics and line breaking; allow headings/buttons to wrap rather than clip; test common long labels at 200% zoom and both languages. Body line length target **45–72 characters** on wide reading surfaces; use `content` width below. In navigation, prefer shorter approved copy instead of reducing the font below its token.

### 4.2 Spacing scale and usage

Base rhythm is 4px. These tokens apply in both themes; no light/dark spacing variant. Distances are **between content boxes**, not a mandate to pad every nested surface.

| Token | Light / dark | Usage / do | Don't |
| --- | --- | --- | --- |
| `space.0` | 0px | True adjacency/reset. | Use to crowd independent controls. |
| `space.0_5` | 2px | Micro optical alignment only. | Use for field grouping. |
| `space.1` | 4px | Icon-to-tight-label, control→help/error. | Separate page sections. |
| `space.2` | 8px | Form label→control, icon+text, tightly related metadata. | Use between unrelated cards. |
| `space.3` | 12px | Button/icon cluster, compact admin row detail. | Replace touch target padding. |
| `space.4` | 16px | Card inner groups, mobile grid gap, related controls. | Pad an entire hero with only 16px. |
| `space.5` | 20px | Adjacent FormFields, compact toolbar groups. | Invent 18/22px one-offs. |
| `space.6` | 24px | Default card padding, component-group gap. | Nest several 24px pads without need. |
| `space.8` | 32px | Major card group, mobile page-header→content, admin section. | Use inside dense table cells. |
| `space.10` | 40px | Admin page section or wide layout separation. | Replace paragraph rhythm. |
| `space.12` | 48px | Public mobile section break. | Force in a compact dialog. |
| `space.16` | 64px | Public desktop section break; mobile hero vertical space. | Add to every subheading. |
| `space.20` | 80px | Public wide hero transition only. | Apply to operational screens. |
| `space.24` | 96px | Rare campaign hero outer rhythm at ≥960px. | Make default page spacing. |

Concrete compositions: FormField **label→control 8px**, **control→description/error 4px**, **adjacent fields 20px**; card title→body 12px and card content groups 16px; public sections 48px mobile/64px desktop; admin sections 32px compact/40px wide; dialog header→body 16px, body→actions 24px. If one-off optical adjustment is necessary, document it locally instead of minting a global token.

### 4.3 Control size, radius and border tokens

| Token | Light / dark value | Usage / do | Don't |
| --- | --- | --- | --- |
| `control.sm` | 36px visual height; 12px horizontal padding; 16px icon; 14px label | Desktop-dense admin toolbar only; maintain 44×44px effective touch target when touch-capable. | Use for primary mobile CTA. |
| `control.md` | 44px height; 16px padding; 18px icon; 14px label | Default buttons/fields/nav controls. | Shrink because label is long. |
| `control.lg` | 52px height; 20px padding; 20px icon; 16px label | Primary public/studio/checkout CTA. | Use on every admin action. |
| `radius.none` | 0px | Paper edge/print layout when intentional. | Randomly square one button. |
| `radius.subtle` | 4px | Badge, small marker. | Use as card default. |
| `radius.control` | 8px | Buttons, inputs, menus. | Create one-off 10/11px control radii. |
| `radius.card` | 12px | Cards and media frames. | Nest rounded cards unnecessarily. |
| `radius.large` | 16px | Dialog, feature surface/large media frame. | Make all surfaces pill-like. |
| `radius.pill` | 9999px | Compact selection chip/lozenge only. | Use for long text buttons or section containers. |
| `radius.circle` | 50% | Avatar/icon circle with square bounds. | Use circle as a status cue alone. |
| `border.subtle` | 1px `color.border` | Decorative divider. | Depend on it for active field boundary. |
| `border.default` | 1px `color.border-strong` | Field/control edge. | Remove on hover if control would disappear. |
| `border.strong` | 2px `color.border-strong` | Selected structural edge when not using selected role. | Substitute for keyboard focus. |
| `border.interactive` | 1px `color.border-strong`; hover can 2px without layout shift using inset ring | Interactive card/chip boundary. | Change actual box width and shift layout. |
| `border.focus` | 2px outer `color.focus`, 2px offset | `:focus-visible` on controls and cards. | Hide behind overflow/overlay. |
| `border.destructive` | 1–2px `color.danger` | Destructive confirmation/invalid control with text/icon. | Use on harmless warning copy. |

The preferred mobile pointer target is **44×44 CSS px** (including the actual hit area, not merely the visual glyph). This is a LumiCal design choice stronger than the [WCAG 2.2 AA 24×24px minimum with exceptions](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Inline links may use their text line box; adjacent icon actions need sufficient spacing. Icon-only buttons are at least 44×44 on mobile and 40×40 on desktop, with an accessible name.

### 4.4 Elevation and motion tokens

| Token | Light value | Dark value | Usage / do | Don't |
| --- | --- | --- | --- | --- |
| `elevation.0` | `none` | `none` | Flat section, most cards on contrasting canvas. | Add shadow just to decorate. |
| `elevation.1` | `0 1px 2px rgb(41 34 29 / 0.06)` | `0 1px 2px rgb(0 0 0 / 0.30)` | Subtle separation on hover or raised surface. | Rely on dark shadow without surface difference. |
| `elevation.2` | `0 8px 24px -12px rgb(41 34 29 / 0.18)` | `0 8px 24px -12px rgb(0 0 0 / 0.45)` | Visual depth on a floating card/menu; stacking uses `layer.*`. | Stack many elevated cards. |
| `elevation.3` | `0 16px 40px -12px rgb(41 34 29 / 0.25)` | `0 16px 40px -12px rgb(0 0 0 / 0.55)` | Visual depth on a popover or sheet; stacking uses `layer.*`. | Put on static body sections. |
| `elevation.4` | `0 24px 64px -16px rgb(41 34 29 / 0.34)` | `0 24px 64px -16px rgb(0 0 0 / 0.65)` | Visual depth on modal/dialog panel; stacking uses `layer.*`. | Treat as a marketing ornament. |
| `elevation.brand-accent` | `4px 4px 0 rgb(41 34 29 / 0.16)` | `4px 4px 0 rgb(0 0 0 / 0.38)` | At most one deliberate marketing/product highlight per section. | Use on admin controls, forms or dialogs. |
| `motion.fast` | 120ms | 120ms | Hover/focus color or border response. | Delay focus visibility. |
| `motion.standard` | 180ms | 180ms | Menu/toolbar state and card emphasis. | Scale every card on hover. |
| `motion.enter` | 240ms | 240ms | Modal/page disclosure entrance. | Animate from far offscreen. |
| `motion.exit` | 160ms | 160ms | Modal/menu exit. | Hold a closed control in the tab order. |
| `motion.slow` | 320ms | 320ms | Optional branded reveal/AR media transition. | Delay content or feedback. |
| `ease.standard` | `cubic-bezier(0.2, 0, 0, 1)` | same | Most state transitions. | Add spring bounce to errors/payment. |
| `ease.emphasized` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | same | Controlled hero/immersive reveal. | Use for every control. |

Functional feedback (pressed, loading, saved, found target) is immediate and never animation-only. Menus use ≤180ms and a short fade/translate ≤4px; dialogs ≤240ms, translate ≤8px; cards change color/border/elevation but do not scale by default. Page-level motion belongs only to storytelling and must not block reading. AR scanning can show a looping indicator, but also shows explicit text and a static reduced-motion alternative. Under `prefers-reduced-motion: reduce`, nonessential transitions/loops are removed (0–1ms), essential state changes remain legible and no information depends on motion.

### 4.5 Semantic layer / z-index tokens

`layer.*` determines paint order, **not visual elevation**: a shadow does not bring a component above a sticky header, and a high z-index does not make it visually raised. Use only these global layer roles; keep small internal stacking (for example media controls over a preview) inside the owning component's local stacking context rather than minting global values.

| Token | Approved value (both themes) | Usage / do | Don't |
| --- | --- | --- | --- |
| `layer.base` | `0` | Normal page flow and local component roots. | Assign new global z-index values to ordinary cards. |
| `layer.sticky` | `20` | Sticky public/admin header, workspace save bar. | Let a sticky bar cover a modal or focused field. |
| `layer.dropdown` | `40` | Menu, popover and tooltip above ordinary/sticky content. | Use for a full-screen dialog. |
| `layer.toast` | `50` | Routine global toast above menus, below blocking overlays/dialogs. | Surface a hidden or unrelated toast over a modal by default. |
| `layer.overlay` | `60` | Modal/drawer backdrop or immersive AR/media shell over app navigation. | Put primary dialog content at backdrop depth. |
| `layer.modal` | `80` | Dialog and modal drawer/sheet content above its backdrop, header and immersive shell. | Raise all floating controls to modal depth. |

When a modal or immersive AR overlay is active, queue unrelated global toasts until it closes. A toast that is *intentionally required inside* an active modal belongs in that modal's local stacking context (and must be accessible there), not in a new arbitrary global layer. Menus/tooltips opened inside a modal or drawer likewise belong to that surface's local stacking context, not a body-level `layer.dropdown` portal behind its backdrop. An AR/media immersive shell consumes `layer.overlay`; its status and camera controls stack locally. If a blocking help/permission dialog opens above it, place that dialog's backdrop later within the overlay layer and its panel at `layer.modal`. A nonmodal desktop inspector stays in normal flow, not `layer.modal`. Portals and local stacking contexts must be tested so a sticky header never covers a dialog and a menu appears above its trigger/content.

### 4.6 Icon and layout tokens

Use Lucide-style line icons with **2px stroke**, `icon.sm 16px`, `icon.md 20px`, `icon.lg 24px`; leading/trailing button icon follows control size (16/18/20px). Icon+label gap is `space.2` (8px), standalone icon in an informational tile has ≥12px gap to copy. Decorative icons are hidden from assistive tech; icon-only actions have a localized accessible name independently of any supplemental Tooltip. Do not rely on icon shape alone for warnings or navigation.

| Token | Light / dark value | Usage / do | Don't |
| --- | --- | --- | --- |
| `layout.page-max` | 1200px | Public page/header/footer main content. | Stretch reading text to this width. |
| `layout.content-max` | 720px | Articles, policy/help and long-form paragraphs (45–72ch target). | Use for multi-column catalog. |
| `layout.admin-max` | 1440px | Admin data canvas. | Force public pages to admin density. |
| `layout.workspace-max` | 1600px | Studio/editor tools + preview. | Make the preview 1600px wide. |
| `layout.gutter-compact` | 16px | <600px viewport; retains 288px content at 320px. | Remove gutter to fit a desktop table. |
| `layout.gutter-medium` | 24px | 600–959px. | Add fixed side panel that leaves tiny canvas. |
| `layout.gutter-wide` | 32px | ≥960px. | Pad a 720px article twice. |
| `breakpoint.medium` | 600px | Two-column simple grids only when content fits. | Use device names as behavior rules. |
| `breakpoint.wide` | 960px | Desktop navigation, catalog 3-column, studio multi-pane. | Assume all 960px screens have room for every rail. |
| `breakpoint.large` | 1280px | Optional wider admin/studio arrangement. | Add more columns without content need. |

Layout primitives: **AppCanvas** fills viewport with `color.canvas`; **PageContainer** clamps to page/admin/workspace max with current gutter; **ContentContainer** clamps reading width; **Section** gives semantic heading and vertical rhythm; **Stack** is vertical gap; **Cluster** wraps inline controls with 8–12px gap; **Grid** uses content-minimum widths rather than device labels. All primitives must permit 320px reflow and 200% browser zoom/text resize. Full-bleed imagery may break out visually, but its controls/copy stay within the container.

## 5. Responsive behavior contract

Breakpoints are **layout thresholds**, not device labels: compact `<600px`, medium `600–959px`, wide `960–1279px`, large `≥1280px`. Test at 320, 375, 600, 768, 960, 1280 and 1440 CSS px, in VI/EN, light/dark and 200% browser zoom/text resize. At 320px, content must reflow without horizontal page scroll; exceptions such as an image canvas or data visualization require a named contained scrolling region with an accessible explanation. This follows the [WCAG reflow criterion](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

| Region | Compact | Medium | Wide / large |
| --- | --- | --- | --- |
| Public navigation | Brand, one high-priority CTA if room, labeled menu trigger; opened menu is a keyboard-operable panel with clear close/location. | Same or short inline links only if they fit without truncation. | Short top-level links; account/language/theme in predictable utility area; no crowded second row. |
| Page header | H1/support/CTA stack; CTA full-width only if it helps thumb access. | Support and CTA may align side by side if text stays readable. | Purpose/title lead, actions align to edge; never more than one primary. |
| Catalog cards/grid | One card per row; filters in a labeled drawer or stacked disclosure, active filters visible and removable. | Two columns if minimum card width ≥260px. | Three columns at ≥960px; four only at large width with sufficient image/text space. |
| Forms | One column, labels above controls, 44px default controls; summary/status not hidden. | Two columns only for naturally paired short inputs. | Wider layout allowed; reading/form column ≤720px. |
| Dialog | 16px edge inset, width `min(100%-32px, 560px)`, max-height `100dvh-32px`, internal scroll; actions may stack. | Same with 24px inset. | Max 560px standard; longer task becomes page, not oversized modal. |
| Studio | Preview first, month/tools in labeled horizontal scroll or sheet, inspector as drawer; save/status sticky but not obscuring canvas. | Preview + one collapsible tool area, no three cramped panes. | Two/three panes when canvas retains useful width; only ≥1280px use simultaneous tool rail (~240px), preview and inspector (~320px). |
| Checkout | Progress/context → form → order summary → payment action; summary accessible before commitment. | Summary can appear after form but remains near CTA. | Form and sticky summary two-column; payment state never hidden below a fixed footer. |
| Admin | Filter drawer/toolbar wraps, data list/card rows with label-value pairs and explicit actions. | Use table only if columns fit; otherwise list transformation. | Dense table with sortable headers and pagination. No horizontal **page** scroll. |
| AR/media viewer | Camera/preview maximizes safe viewport; status/control overlay has safe-area padding, high-contrast scrim, explicit exit/fallback. | Controls reposition to avoid covering target. | Media and instructions can sit side by side; avoid tiny camera preview. |

`Stack` order is semantic DOM order; do not rely on CSS reordering to move the only error/status or primary action away from its reading sequence. Orientation changes and virtual keyboard opening must not hide save/pay/exit controls. A sticky footer must reserve space in the scroll container.

## 6. Page-composition patterns (structure, not final screen designs)

| Pattern | Required order and hierarchy | Key behavior |
| --- | --- | --- |
| Public marketing | PublicHeader → PageHeader (one H1, concise promise) → 2–4 content/feature sections with imagery → single decision CTA → related guidance/footer | Story-driven, spacious; alternate content and imagery without a card for every block; decorative accent no more than once per section. |
| Catalog | PageHeader → filter/sort controls and active-filter summary → result count → responsive result grid → pagination/empty state | Filter changes announce count; keep sort distinct from filter; clear-all in empty state; card action consistent. |
| Detail | Breadcrumb → product/template hero and preview → concise attributes/configuration → trust/help → primary CTA | CTA follows enough information to decide; specs use structured list, not pill forest. |
| Studio/editor | Workspace header (title, back, save/status) → month/tool navigation → canvas/preview → inspector/options → contextual validation | Canvas is the focal object; controls grouped by task and progressively disclosed; unsaved/error status persistent. |
| Checkout | Progress/context → order summary/price breakdown → delivery form → gateway choice/approval → processing/result | Summary before final approval, no deceptive “paid” message from browser event; preserve entered data on retry. |
| Account | PageHeader → account navigation → current task section(s) → contextual actions/status | Organize by projects/orders/settings; avoid admin density. |
| Admin | AdminShell → PageHeader → toolbar/search/filters → data region (table/list) → pagination/empty state → detail/action | Compact and scannable; severity/status column uses words; destructive operations separated. |

Blog/article pages, if the P2 editorial capability is approved, use **ContentContainer** and the public pattern with readable prose width; AR/scan uses a focused immersive shell with exit/status rather than the normal marketing header. These are page-composition exceptions, not separate design systems.

## 7. Component hierarchy and behavior specification

```text
Foundations   color · type · spacing · radius · elevation · layers · borders · motion · icons · layout
    ↓
Primitives    Button · IconButton · Input · Textarea · Select · Checkbox · Radio · Switch
              Badge · Chip · Divider
    ↓
Composites    FormField · Surface/Card · Dialog · Drawer/Sheet · Menu · Tooltip
              Breadcrumb · Tabs · Alert · Toast · EmptyState · Pagination · Table
              SearchField · FileField
    ↓
Layouts       Container · PageHeader · Section · Stack · Cluster · Grid · AdminShell
    ↓
Feature-owned TemplateCard · CalendarPreview · MonthSelector · MediaSlot
              SpecialDateMarker · OrderSummary · ArticleCard · ARScannerUI
    ↓
Screens       assembled against use-case contracts
```

Foundations through layouts belong to Design System v2. Feature-owned components may be documented in its examples but live with their business feature because they understand templates, months, orders or AR states. A generic `Card` does not know price, project ownership or payment status.

### 7.1 Button and IconButton

Variants are **primary, secondary, outline, ghost, destructive**. A green “success” button is not a general variant; successful outcomes use status/result patterns. Primary uses `color.brand` + `text-inverse`; secondary uses `surface-subtle` + `text-primary` + interactive edge; outline is transparent + interactive edge/text; ghost is transparent + text with hover surface; destructive uses `color.danger` + `text-inverse`. Dark mode uses its corresponding semantic values, including dark ink on light terracotta/danger fill. Links that navigate are links styled as actions, not click-handler buttons.

Sizes: `sm` 36px visual for pointer-dense admin only, `md` 44px default, `lg` 52px for principal public/studio/checkout action. All use `radius.control`; labels never truncate essential verbs or prices. On compact screens, use full-width for a single dominant CTA or stacked dialog actions; do not stretch every toolbar action. Leading/trailing icons use 8px gap and do not replace the label. Icon-only requires its own accessible name, a supplemental tooltip where useful, and a 44px mobile hit area. Loading preserves button width, replaces/adds a spinner with an announced label (“Đang lưu…” / “Saving…”), blocks repeat submission and does **not** signal success. Disabled is native/noninteractive with reason nearby when not self-evident. Hover, pressed, focus and disabled are distinct. Brand/danger hover/active fills come from tokens; computed text contrast remains ≥4.5:1 (dark brand active is **4.70:1**, so do not darken it further without review).

### 7.2 Form controls and FormField

All form controls use `control.md`/`radius.control`, `color.surface`, `text-primary`, `border.default`, `border.focus`; placeholder is optional example text, **not** a label or sole instruction. Focus ring is visible without layout shift. Error uses danger text + icon/word and an associated message; success decoration is used only when explicit validation has occurred. Hover may strengthen the border but not change meaning. Filled is not a separate color scheme. Disabled remains legible enough to identify what is unavailable, with native semantics.

| Control | Specification |
| --- | --- |
| Input | 44px minimum, text remains selectable; `type` appropriate to email/password/phone; no auto-capitalize for email; reveal-password control has name/state. |
| Textarea | Minimum 3 text lines; vertical resize or auto-grow to a reasonable cap; show limit when relevant; error sits after control. |
| Select | Native/select-like semantics for a form value; full-width where labels are long; option labels never rely on color; use custom only if native cannot meet required behavior. |
| Checkbox | Independent boolean; label is one click target; checked/indeterminate shapes visible apart from color. |
| Radio | One choice in a group; visible legend, arrow-key group behavior from native controls; selected option has selected role + check indicator. |
| Switch | Immediate on/off setting only (e.g. contribution gate if P2 is approved), not a one-time submit; label states effect, `role=switch`/checked exposed. |
| SearchField | Search input with explicit label, clear action and submit/instant-result contract; announce result count after change; do not present it as a generic dropdown. |
| FileField | Labeled chooser plus accepted types/max size before selection, progress, retry/cancel, preview/alt where needed; drop zone never the sole input; errors name file and reason. |

**FormField composition:** `Label` (with visible “optional” or “required” as appropriate) → **8px** → control → **4px** → description/help or validation message; next field **20px** below. Description and error may coexist but should not repeat. Use stable control IDs with `for`, `aria-describedby` for help, `aria-invalid` and `aria-errormessage`/description for error. On submit, show a summary for multiple errors, focus the summary or first invalid field, and keep entered data. Icons never replace text. Group radios/checkboxes with `fieldset`/`legend` when one question has several controls.

### 7.3 Surfaces, cards and status vocabulary

**Surface** is a neutral material boundary. **Card** groups one coherent item or action with 24px public/16px admin padding and `radius.card`; default is flat (`elevation.0`) with subtle border or background contrast. **InteractiveCard** is one link/button-like target with visible hover/focus and a clear accessible name; nested independent actions must be separated, not nested interactive elements. **MediaCard** lets imagery lead and gives text a solid/scrim-backed region. **DashboardCard** presents one metric or operational summary with compact rhythm. Use cards for repeated comparable results, an actionable object or a distinct bounded panel. **Do not** use a card around each paragraph, put card inside card without a real hierarchy, or use shadows merely to fill empty space; a heading, divider and whitespace are often enough.

**Badge** is compact *noninteractive* metadata or status: neutral, brand, success, warning, danger, info; label always included. **Chip** is interactive filtering/selection: pressed/selected semantics, selected-bg/text/border and removable state when appropriate; use pill radius only for short chip labels. **Status** is the underlying semantic condition (`pending`, `saved`, `approved`, `failed`, etc.), rendered through word + icon + semantic color and possibly badge/banner. A decorative “new” badge is not a status. Do not color an entire table row as the only status cue. A gold accent is not “warning.”

### 7.4 Dialog, menu, select and tabs

One shared **Dialog** primitive supports standard, confirmation and destructive-confirmation content; no per-feature modal implementation. Open from a named trigger, move focus to heading/first safe control, trap focus while open, close on Escape unless a truly non-dismissible processing state makes that unsafe, restore focus to trigger, and prevent obscured focus. Backdrop click may dismiss a simple informational dialog; it **must not** perform or silently confirm an action. Destructive confirmation names the object/consequence, puts initial focus on Cancel, uses a separate danger button with specific verb, and never makes Enter trigger deletion from an unrelated field. Actions order: on wide screens Cancel/secondary then confirm at end; on compact screens stack with safe Cancel accessible before destructive confirm in DOM order. Long forms use a page or sheet instead of a giant dialog.

**Select** chooses a form value. **Menu** exposes actions and uses button trigger with `aria-expanded`, arrow/Home/End navigation, Escape close and focus return; avoid nesting a menu in a select. “Dropdown” names positioning only and is not a semantic component. **Tabs** are sibling views in one context: `tablist`/`tab`/`tabpanel`, one tab stop, left/right (or orientation-appropriate) arrows, Home/End, visible selected + focus states; choose automatic activation only if panels switch instantly, otherwise Enter/Space. On mobile, tab strip may scroll within itself with visible overflow cue and accessible labels; do not shrink text. Use a segmented control for a small mutually exclusive **value** choice, not a whole page sub-navigation.

### 7.5 Breadcrumb, Tooltip and Drawer/Sheet

**Breadcrumb** is hierarchical navigation for detail/deep pages, not a default ornament on shallow Home or single-level pages. Render a labeled semantic `nav` with an ordered list of ancestors; expose the current page with `aria-current="page"` (as text or a clearly marked current link). Keep the current page and immediate parent understandable on mobile; collapse only middle ancestors behind a labeled, keyboard-operable reveal when space is constrained. Never communicate the path through unlabeled ellipsis alone.

**Tooltip** provides supplemental explanation, not essential instructions, validation or an accessible name. It appears on hover **and** keyboard focus, remains readable while the pointer moves to it when interactive/dismissible, closes on Escape where required and stays within the viewport. An icon-only trigger still has its own accessible name; tooltip text may describe it but cannot be its only name. Prefer visible help text for important information.

**Drawer/Sheet** is a responsive secondary-tools container for mobile filters, studio inspector/tools, and appropriate account/admin controls. A *modal* drawer follows Dialog behavior: named trigger/title, safe initial focus, focus containment, inert background, Escape to close, focus restoration and a backdrop that dismisses only safely (never confirms an action). Contain scrolling within the panel without losing its header/close/action; respect mobile safe-area insets and keyboard opening. It uses `layer.overlay` for backdrop and `layer.modal` for panel. On wide screens, the same content may become a persistent **nonmodal** panel in normal flow: no focus trap, no blocking backdrop and a visible relationship to its workspace. Do not put the primary task or only critical status into a hidden drawer.

### 7.6 Feedback, tables and navigation

| Pattern | When and how |
| --- | --- |
| Inline validation | Field-specific issue immediately after field, with `aria-invalid` and text. Do not replace with toast. |
| Banner/Alert | Page- or section-wide persistent outcome requiring attention; severity role plus icon/heading/copy/action. `role=alert` only for urgent errors; routine guidance is not live-interrupting. |
| Toast | Brief noncritical acknowledgment (e.g. saved) with persistent equivalent if outcome affects navigation; visible long enough to read, pausable/dismissible if actionable. Never sole location of a payment failure or unsaved-work warning. |
| EmptyState | Explain why list is empty and offer one next action or clear-filters action; distinguish no data from failed fetch. |
| Loading/Skeleton/Progress | Skeleton only where structure is predictable; spinner has label; determinate upload/progress uses percentage when known; preserve layout and announce state changes. |
| Success/Error result | Dedicated result for checkout, upload or other major transaction; state, evidence/reference, next action and support/retry. Never infer verified payment from frontend callback. |

**Admin Table:** `type.body-sm` cells and `type.label` headers, minimum 44px row action targets where touch is possible, 12–16px cell padding, one row state at a time (hover, selected, error), sortable column headers as buttons with direction announced, status as label+icon/color, actions in explicit last column, pagination with current page/total and focus retention. At compact widths, switch to a labeled key-value list/card for each row, retain sort/filter/pagination above, and keep critical actions visible; never squeeze the full table into 320px. A genuine tabular financial comparison may have a contained horizontal scroll with heading/instructions, not page overflow.

**Navigation:** Public header prioritizes logo, product discovery, create action and account; move low-priority links to menu/footer. Mobile trigger names the menu and exposes expanded state; active route is conveyed with text/`aria-current`. Account nav is task-based. Admin nav uses clear functional categories and current location, not marketing ornament. Breadcrumbs precede detail H1 and omit the current item as a link or mark it current. Footer groups product/help/about/contact, readable in both themes; supporting legal/project-status copy is secondary but not faint. Skip link reaches main content. Theme/language controls have explicit labels and do not shift layout.

## 8. Feature-owned calendar, AR and payment guidance

These are **not** generic Design System primitives. They consume the foundations/composites above; their business logic belongs to the corresponding feature modules.

| Feature component | V2 design guidance |
| --- | --- |
| `TemplateCard` / `TemplatePreview` | Image/preview leads, name and a few distinguishing attributes follow, price/status visible; one clear action; placeholder has meaningful fallback. Avoid badge clusters. |
| `CalendarPreview` | Preserve physical paper proportions and legible month/date labels; in dark shell it may stay paper-like but needs visible edge and controls. Zoom controls labeled; preview must not be sole way to read content. |
| `MonthSelector` | 12 months as ordered choices with current/complete/error state conveyed by word/shape plus color; horizontal contained scrolling on compact; arrow/keyboard behavior specified with chosen navigation pattern. |
| `MediaSlot` / recipient preview | Show empty/selected/uploading/failed/ready states, type/size guidance, alt/caption controls, remove/retry with confirmation where destructive. Media playback has captions/transcript where applicable. |
| `SpecialDateMarker` | Marker corresponds to readable date/event list; do not encode meaning by tiny colored dot only. |
| `DesignOptionSelector` | Group options with label/explanation and live preview; selected-border/check; controls remain usable without preview. |
| `OrderSummary` / `ArticleCard` | Domain-owned composition; summary spells out price components and payment state, article card preserves reading order/metadata without excessive badges. |

### 8.1 AR/immersive state language

AR is a signature final-product requirement; this specification remains technology-neutral. The camera/immersive shell uses `color.canvas`-compatible scrims, clear exit and static controls outside critical camera target area. Every state has visible text, icon/shape and accessible announcement, not animation alone.

| State | Required message and action |
| --- | --- |
| Instructions | Explain what to point at, lighting/distance help, privacy/camera expectation and a non-AR preview/fallback path. |
| Permission request | Explain why camera is needed **before** browser prompt; explicit Start action. |
| Permission denied | Plain reason and browser-settings guidance; retry after permission change; fallback media view. |
| Loading/initializing | Labeled progress, cancel/exit; no indefinite unlabeled spinner. |
| Scanning | Persistent “Scanning…” status, target guide that does not obscure content, stable exit/help. Reduced motion has static guide. |
| Target found | Distinct confirmation word + icon, short functional transition ≤320ms, then media reveal. |
| Target not found | Gentle actionable tips and Retry; do not label user action as failure. |
| Media reveal | Controls for play/pause, mute, captions/transcript and close/back; no autoplay audio. |
| Unsupported device / runtime failure | Explain limitation, link to accessible non-AR experience, no dead-end error. |

### 8.2 Payment experience states

The gateway direction is **PayPal Sandbox demo**, governed by Business Rules and Architecture. This section defines visual and copy behavior; it does not select an SDK or trust a frontend callback as payment evidence.

| State | UI requirement |
| --- | --- |
| Ready | Show order total/currency, gateway identity and clear “Continue to payment” action; disclose sandbox/demo context when applicable. |
| Redirect/approval | Explain that the user is leaving/approving and will return; preserve order reference and safe return path. |
| Processing | Non-dismissible double-submit guard, labeled progress and “verification in progress”; no premature success copy. |
| Completed | Show success only after **backend-verified** gateway result; show reference, amount and next steps. |
| Cancelled | Neutral message; order state and retry/return choices; do not call it failed or paid. |
| Failed | Plain reason if safe to disclose, contact/support path, no loss of form context. |
| Retry | Clear retry action that cannot accidentally create duplicate order/payment; status and idempotency are backend concerns. |

## 9. First-class themes, accessibility and copy

Light is warm paper with darker terracotta action; dark is warm charcoal/brown with lighter terracotta action and lighter text. Theme is a semantic mapping from the color registry, **not** invert/filter CSS or `.bg-white` remapping. Dark layers use fill and border as well as shadow; hover/selected/focus colors remain distinct. Forms, menus, dialogs, admin data and payment/AR status use the same role mappings. User images and physical calendar paper need not invert. Test images with dark shell edge, captions and controls separately. Respect OS preference on first use and explicit user choice thereafter; avoid a theme flash within the frontend architecture.

**WCAG 2.2 AA is the LumiCal accessibility baseline. Any exception must be explicitly documented, justified, scoped and reviewed.** This is a design and implementation target, **not a claim of certification or conformance**. The stronger LumiCal 44px preferred mobile target remains. Minimum requirements: semantic headings/landmarks; keyboard operation and logical order; visible focus not hidden under sticky UI; text contrast ≥4.5 (large qualifying text ≥3), non-text indicators ≥3; labels and described errors; dialog/drawer focus entry/trap/return; reduced motion; 200% browser zoom/text resize without clipping; 320px reflow; controls usable without hover; accessible names for icon actions independently of tooltips; `aria-live`/status announcements without excessive interruptions; accessible upload progress and payment/AR fallbacks. See [WCAG 2.2](https://www.w3.org/TR/WCAG22/) for the normative criteria. Automated checks are a floor, not proof of usability: review VI/EN copy, keyboard-only paths, screen-reader announcements and real mobile layouts.

Copy voice is warm, simple, human and concise. Vietnamese is the primary editorial voice: correct accents, natural sentence case, no cute euphemism for errors; name the object and action (“Xóa bộ lịch này?”), explain consequence and recovery. English should convey the same meaning naturally, not mirror Vietnamese word order; plan room for expansion. Critical auth, payment, destructive and admin messages are direct and unambiguous. Use verbs on buttons (“Lưu thay đổi” / “Save changes”), not vague “OK”; status describes the system, not an assumed user mistake. Placeholder is not a label. Avoid promises of successful payment or AR recognition until verified. [Frontend Standards](FRONTEND_STANDARDS.md) defines i18n implementation conventions.

## 10. Core component acceptance criteria

These are implementation-review and testing contracts. **Common gate for every visual component:** both themes; VI/EN content without clipping; 320px reflow and 200% browser zoom/text resize; visible focus on any interactive element; no required hover; normal-text contrast ≥4.5:1 and meaningful non-text contrast ≥3:1; reduced-motion behavior where animated. A component passes only if its row-specific criteria **and** the common gate pass. Manual keyboard/screen-reader checks complement automated tests.

| Core component | Additional acceptance criteria to verify |
| --- | --- |
| Button | Native button/link semantics by action; primary/secondary/outline/ghost/destructive and sm/md/lg render; hover/pressed/focus/disabled/loading distinct; loading has announced text and no width shift/double submit; mobile target ≥44px; long label wraps or layout adapts. |
| IconButton | Accessible localized name independent of any tooltip, supplemental tooltip where useful; mobile hit area ≥44px; icon alone not used for an unfamiliar destructive action; focus ring surrounds target, not only glyph. |
| Input | Associated label, correct input type/autocomplete, readable filled/placeholder, focus and error; error ID associated; keyboard typing/paste and disabled semantics work. |
| Textarea | Associated label/limit; multiline keyboard operation; grows/resizes without trapping page scroll; at 320px no horizontal overflow; validation appears after field. |
| Select | Label/value/disabled/error exposed; native or equivalent keyboard selection; options not color-only; long option label readable at 200% zoom. |
| Checkbox | Label toggles input; checked/unchecked/indeterminate visually and semantically distinct; target includes label; grouped checkboxes have legend. |
| Radio | `fieldset`/legend, exactly one selected where required; keyboard arrow selection; selected border/check distinct from focus; error belongs to group. |
| Switch | Labeled effect and on/off state, keyboard Space toggles, `aria-checked`/native equivalent; no toggle for a delayed destructive submit; pending save status shown. |
| Badge | Never focusable unless intentionally a link (then not a Badge); short word accompanies semantic color; wraps/does not clip long localized status. |
| Chip | Button/checkbox semantics fit selection model, pressed/selected exposed; selected and focus visually separate; removal has accessible name; wraps or horizontally contained-scrolls at 320px. |
| Divider | Decorative divider hidden from assistive tech, or labeled separator only where navigation meaning exists; not used as sole section heading. |
| SearchField | Search label, clear control name, Enter behavior, result count announcement, empty query state; async request does not reorder keyboard focus. |
| FileField | Keyboard-accessible chooser independent of drop zone; accepted type/size visible before upload; progress/cancel/retry and file-specific errors announced; preview has alt/caption path. |
| FormField | Label→control 8px, control→help/error 4px, fields 20px; stable ID/`for` and description/error relationships; required/optional visible; errors survive submit and point to exact control. |
| Surface/Card | Uses semantic surface, defined padding/radius/elevation; reading order unchanged in responsive layout; no unnecessary nested card; content on images has tested contrast. |
| InteractiveCard | One clear action and accessible name; entire hit area keyboard-operable; focus/hover/selected distinct; no nested interactive descendants; preview text available without hover. |
| Dialog | Opens from named trigger, initial focus safe, focus trapped, Escape closes/cancels as appropriate, focus restored, background inert, visible title, 320px/max-height scroll; destructive variant defaults focus to Cancel and never confirms on backdrop click. |
| Drawer/Sheet | Modal mode has titled trigger, safe initial focus, focus trap, inert backdrop, Escape and focus restoration; backdrop never confirms an action; panel scrolls without losing close/action, respects mobile safe areas and keyboard; desktop persistent mode has no trap/backdrop and remains in normal flow. |
| Menu | Trigger exposes expanded state; arrow/Home/End/Escape and focus return work; action labels are verbs; no hidden menu item remains in tab order after close. |
| Tooltip | Supplemental information only; shown on hover and focus, dismissible with Escape where required, positioned within viewport; essential instructions exist elsewhere and icon-only trigger has its own accessible name. |
| Breadcrumb | Labeled semantic `nav`/ordered list, ancestors are links and current page is exposed with `aria-current="page"`; no redundant shallow-page trail; mobile collapse preserves current/parent context and uses a labeled keyboard-operable reveal. |
| Tabs | Correct tablist/tab/tabpanel relationships; one tab stop, arrows/Home/End, selected and focus distinct; overflow cue/contained scroll on mobile; panel change does not silently lose form state. |
| Alert/Banner | Text and icon identify severity; urgent errors announced once, routine guidance not repeatedly interrupted; associated recovery action and dismiss behavior defined. |
| Toast | Noncritical only; live region announces once, focus not stolen; dismiss/pause if actionable; duration enough for reading; outcome also findable later when consequential. |
| EmptyState | Differentiates no results/no data/load error; gives one next action; not represented by blank screen or illustration alone. |
| Loading/Skeleton/Progress | Busy region/name announced; skeleton not mistaken for real controls; determinate percent exposed when known; completion announced; no infinite unlabelled spinner. |
| Pagination | Current page/total and next/previous names; disabled boundary semantics; keyboard and focus retention; result range announcement after navigation. |
| Table/DataList | Header associations and sort direction announced; statuses include words; row actions labeled; at 320px switches to key-value list or contained exceptional scroll without losing fields/actions. |
| Container/Section/Stack/Cluster/Grid | Max widths/gutters and scale gaps match registry; 320px reflow, 200% zoom, VI/EN wrap; heading order/DOM reading order remain logical. |
| PageHeader/AdminShell | Exactly one H1 per page, actions secondary to title, skip link/main landmark, nav current location, operational density without smaller primary body text. |

Feature-owned acceptance extends the common gate: `CalendarPreview` has a nonvisual data/list alternative; `MonthSelector` exposes current/complete/error without color alone; `MediaSlot` reports upload/progress/error; `OrderSummary` exposes all price components; `ARScannerUI` exposes every state and a non-AR fallback. Specific business correctness belongs to Business Rules and the tests defined in [Testing Strategy](TESTING_STRATEGY.md).

## 11. Representative product-area composition

This table applies the approved visual patterns to LumiCal's product areas. It does not add capabilities beyond Product Scope.

| Area | Composition guidance | DS components involved |
| --- | --- | --- |
| Home | Public marketing with one principal create CTA, warm material, content-led sections and restrained accents. | PageHeader, Section, Button, MediaCard, public nav. |
| Template catalog | Progressive filter disclosure, active-filter summary, clear availability, results and empty state. | SearchField, Chip, Select, TemplateCard, Pagination, EmptyState. |
| Template detail | Breadcrumb → preview → essential specs → CTA; content before chrome. | Breadcrumb, ContentContainer, Surface, Button, TemplatePreview. |
| Calendar Studio | Preview is focal; tools grouped in inspector, save state persistent, month choices clear. | Tabs/segmented choice, FormField, FileField, Dialog, MonthSelector, CalendarPreview. |
| Checkout | Progress, summary, proportionate demo contact form, gateway state and verified result. | OrderSummary, FormField, Button, Alert, Progress, result pattern. |
| Account | Task-based Project/Order navigation and contextual actions. | PageHeader, account nav, DataList/Card, Badge, EmptyState. |
| Blog (P2 only) | Readable article width and unobtrusive metadata; editorial capability remains optional. | ContentContainer, ArticleCard. |
| AR / scan | Focused immersive shell with explicit camera/target states, exit and authorized fallback. | ARScannerUI, Alert, Progress, IconButton, media controls. |
| Admin | Shared interaction language at compact density, toolbar/data view and responsive lists. | AdminShell, SearchField, Select, Table/DataList, Status, Dialog, Pagination. |

## 12. Governance, anti-patterns and implementation guidance

**Lightweight governance:**

1. Add a token only for a recurring semantic role or a justified system-wide need; first check existing roles. Record its light/dark values, contrast pairs and usage in this registry.
2. Add a component variant only when at least two real use cases share behavior and visual meaning. A one-off campaign accent stays feature-owned and documented; no new “gold success button” variant.
3. A component stays feature-owned if it knows product entities, pricing, months, article content or AR/gateway states. It may compose DS pieces and publish examples; it does not force business data into generic components.
4. Document exceptions with why, scope, owner, contrast/responsive check and revisit date. Any accessibility-baseline exception additionally requires explicit justification and review; it cannot be silently treated as “practical.” Physical paper preview and a single marketing chunky shadow are visual examples; secret global overrides are not.
5. Review token/component changes with a tiny checklist: light/dark, VI/EN, 320px, 200% zoom, keyboard, screen reader, contrast, loading/error/disabled, reduced motion, public/admin density, visual regression snapshot. Keep the decision in a short ADR or document PR note.
6. Prefer named semantic tokens and scale values. An isolated pixel value is allowed only for a measured optical correction or external media requirement and must not create a second invisible system.

**LumiCal anti-patterns to reject:** card inside card without meaningful hierarchy; two primary buttons in one choice; arbitrary 13.5/14.5px type; hard-coded status colors or global z-index values outside `layer.*`; styling dark mode by global `.bg-white` overrides; one-off radii/shadows; every label as a pill; gold used as warning; decorative motion delaying form or payment feedback; unclear icon-only delete/action or Tooltip used as its accessible name; duplicated script text announced twice; desktop admin table squeezed into mobile; marketing animation copied into admin; dense admin toolbar copied onto a public story page; placeholder-only labels; successful payment inferred from a frontend return; AR scanning status shown only as a moving graphic.

**Design System consumption path:**

```text
approved semantic tokens
  → accessible primitives
    → composites and layout patterns
      → feature-owned calendar/content/order/AR components
        → screens and state-specific visual regression tests
```

Build with the semantic registry and shared component contracts rather than accumulating global theme overrides, duplicate control variants, arbitrary font sizes, nested cards or per-feature dialogs. Validate one public page, one form/dialog and one admin data view in both themes and VI/EN before broad rollout.

Product Scope and Business Rules define the AR and sandbox-payment product behavior; [Architecture](ARCHITECTURE.md) defines the integration boundaries. Test the exact font files, Vietnamese glyphs, rendered contrast and component states during implementation. Changes to approved visual decisions require the review process in [Development Workflow](DEV_WORKFLOW.md).

