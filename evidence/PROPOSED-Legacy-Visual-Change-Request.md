# Proposed legacy visual direction for I00–I06

**Status** PENDING LEAD APPROVAL. The isolated branch is the review prototype. `docs/DESIGN_SYSTEM.md` remains the published authority.

| Decision | Proposed implementation |
| --- | --- |
| Semantic palette | Scope light/dark Canvas `#FBF6EC / #1B1815`, Surface `#FFFFFF / #211C18`, Raised `#FFFFFF / #2C261E`, Subtle `#F5EDDD / #28221D`, and ink `#2A231C / #F7EFE3` to product and Admin surfaces. Use warm inverse ink `#FBF6EC` on utility and Admin rail `#221D17`. |
| Text and borders | Secondary `#514738 / #E4D9CA`, muted `#6D5F50 / #B9AA98`, decorative border `#E8DDCA / #4B4034`, interactive border `#978268 / #907D68`. The proposed muted light value is darker than the legacy `#8A7C6B` to preserve contrast. |
| Actions and focus | Brand `#B93729 / #EF9489`, brand/link ink `#A63225 / #FFB0A7`, hover `#9C2C20 / #FFB0A7`, pressed `#862619 / #E28174`, inverse ink `#FFFFFF / #2A231C`, focus `#A63225 / #EF9489`. Use warm inverse focus on the dark utility and Admin rail. |
| Selection and accent | Selected surface `#F7E3DC / #482A27`, ink `#862619 / #FFDED7`, border `#A63225 / #EF9489`. Use `#E2A0B4` for the footer rule and confine pink, sky, and gold to decoration. Success, info, danger, and warning retain their semantic roles. |
| Typography and identity | Keep local Baloo 2 at 700 for headings and Be Vietnam Pro at 400, 600, and 700 for body and controls. Set the Home title to 34px below 768px and 52px at 768px and above, both at 1.08 line height and with a terracotta second line. Use the supplied LumiCal wordmark and inverse mark. A closer match to legacy script lettering would require separate approval for a self-hosted Dancing Script 600–700 decorative accent. The prototype uses the bundled heading face. |
| Radius, surface, and depth | Use 10px controls, 14px cards, and a 26px hero frame. Use a 5px by 6px hard shadow only on the hero frame, the scoped soft card shadow and a 22px stripe repeat. Retain 44px primary touch targets. |
| Layout and breakpoints | Use 16px outer gutters below 768px and 24px above, with a 1200px content width. Use 640px for two-column card grids, 768px for showcase and supporting panels, 1024px for desktop navigation, split hero, Catalog rail, split sign-in and Admin rail, and 1280px for the Catalog and Admin three-column grids. The compact menu expands in flow. |
| Motion | Use static hero texture, calendar framing, native FAQ disclosure, and immediate focus. Retain the existing `--motion-fast` 120ms color transitions and its 0ms reduced-motion value. Leave the legacy looping orbs, AR animation, route-entry fades, and menu height animation outside this proposal. |

The palette and typography proposals are scoped in `frontend/src/design-system/foundations/legacy-ui.module.css` and the corresponding feature CSS. Product and Admin authorization, actual publication states, prices, project revisions, and media status continue to use V2 contracts. The proposal depends on lead visual and accessibility review across the captured widths and themes.
