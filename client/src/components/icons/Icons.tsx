// Small inline icon set (stroke icons, 24x24 grid), so we don't pull in an
// icon library. All share one stroke weight so they read as one family.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const SearchIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const SunIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

export const MoonIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);

export const SettingsIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 7h8M18 7h2M4 17h2M12 17h8" />
    <circle cx="15" cy="7" r="3" />
    <circle cx="9" cy="17" r="3" />
  </svg>
);

export const CheckIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const StarIcon = ({
  filled,
  ...props
}: IconProps & { filled?: boolean }) => (
  <svg
    {...base}
    fill={filled ? "currentColor" : "none"}
    strokeWidth={1.6}
    {...props}
  >
    <path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93Z" />
  </svg>
);

export const EyeIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.5 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22" />
  </svg>
);

export const PlusIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

// a chain link: an image link of their own
export const LinkIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </svg>
);

export const ChevronDownIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const ArrowRightIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const CoffeeIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3.5c-.6 1 .6 1.5 0 2.5M12.5 3.5c-.6 1 .6 1.5 0 2.5" />
  </svg>
);

// one arrow up, one down: how the shelf is sorted
export const SortIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M7 4v16M3.5 7.5 7 4l3.5 3.5M17 20V4M13.5 16.5 17 20l3.5-3.5" />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

// a cross drawn with a brush: two strokes, each fat where the brush lands
// and thin where it lifts.
// Filled, not stroked, so the taper holds at any size
export const InkCrossIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M3.1 5.7C3.7 3.7 5.7 3.2 7.2 4.6L20.7 18.3c.6.9-.4 1.9-1.3 1.4L4 8.1C3.1 7.5 2.8 6.6 3.1 5.7Z" />
    <path d="M21 4.1c-.9-1.4-2.8-1.3-3.9 0L3.5 18.8c-.6.9.4 1.9 1.3 1.3L20.5 7.1c.9-.8 1.1-2 .5-3Z" />
  </svg>
);

// a price tag, for where prices come from
export const TagIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
);

// a shopping bag, for the To buy list
export const BagIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M5 8h14l1 13H4z" />
    <path d="M8 8V7a4 4 0 0 1 8 0v1" />
  </svg>
);

// sending something out: sharing a list
export const ShareIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 3v12M7 8l5-5 5 5M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
  </svg>
);

// bringing something in: importing a list
export const ImportIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 3v12M7 10l5 5 5-5M5 19h14" />
  </svg>
);

// a phone with an arrow down into it: "Install the app"
export const InstallIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path d="M12 7v7M9 11l3 3 3-3" />
  </svg>
);

export const InfoIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.5" />
  </svg>
);

export const SignOutIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8M10 12h10M17 9l3 3-3 3" />
  </svg>
);

// a barcode in a viewfinder's corners: scanning a book
export const BarcodeIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M8 9v6M11 9v6M14 9v6M16.5 9v6" />
  </svg>
);

// a torch, for the camera's light
export const TorchIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M8 3h8l-1.5 6h-5zM9.5 9h5l.5 3-2.5 9-2.5-9z" />
  </svg>
);

// lines of type: adding a series by its name
export const TypeIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 7V5h16v2M9 19h6M12 5v14" />
  </svg>
);

// a calendar page with a plus: adding a release to their own calendar
export const CalendarPlusIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5" />
  </svg>
);

// the bottom bar's own (Android app only: layouts/header/Header.tsx)
// books standing on a shelf
export const ShelfIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M3 20h18" />
    <path d="M5 20V6h3v14M10 20V4h3v16" />
    <path d="m15.5 7.2 2.9-.8 3 13.2-2.9.7Z" />
  </svg>
);

export const BellIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </svg>
);

export const PersonIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </svg>
);
