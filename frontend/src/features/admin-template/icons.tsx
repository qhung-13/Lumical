// Inline SVG icons for the I04-P04 Admin Templates experience — same visual
// language as the I13 admin icons (one stroke width per layer, vector-only,
// decorative unless given a visible label).
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { readonly size?: number };

function base({ size = 20, ...props }: IconProps, children: React.ReactNode, strokeWidth = 2) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const IconTemplates = (p: IconProps) => base(p, <><rect x="3" y="3" width="18" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>);
export const IconOrders = (p: IconProps) => base(p, <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M8 11h8" /><path d="M8 15h5" /></>);
export const IconUsers = (p: IconProps) => base(p, <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);
export const IconBell = (p: IconProps) => base(p, <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>);
export const IconGear = (p: IconProps) => base(p, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>);
export const IconAlertTriangle = (p: IconProps) => base(p, <><path d="M10.3 4.3 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>);
export const IconCheckCircle = (p: IconProps) => base(p, <><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></>, 2.5);
export const IconCheck = (p: IconProps) => base(p, <path d="m5 12.5 4.5 4.5L19 7" />, 2.5);
export const IconRefresh = (p: IconProps) => base(p, <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></>);
export const IconArchive = (p: IconProps) => base(p, <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /></>);
export const IconInfo = (p: IconProps) => base(p, <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>);
export const IconAlertCircle = (p: IconProps) => base(p, <><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></>);
export const IconChevronLeft = (p: IconProps) => base(p, <path d="m14 6-6 6 6 6" />);
export const IconChevronRight = (p: IconProps) => base(p, <path d="m10 6 6 6-6 6" />);
export const IconChevronDown = (p: IconProps) => base(p, <path d="m6 9 6 6 6-6" />);
export const IconArrowRight = (p: IconProps) => base(p, <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>);
export const IconPlus = (p: IconProps) => base(p, <><path d="M12 5v14" /><path d="M5 12h14" /></>);
