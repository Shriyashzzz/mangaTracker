// A series' name in a small inked caption box, shown while its cover is
// hovered or focused by keyboard (hover only where there's a pointer). For
// rows of bare covers, where the picture alone doesn't say which series it
// is: the New tab's piles, and a shared shelf's top picks and favourites.
//
// The cover's link or button must carry COVER_WITH_CAPTION, and already
// names the series for screen readers (the caption is hidden from them).
// As wide as the name, up to a cap: one line, a long name cut short.

// what the cover's own link or button needs for the caption to follow it
export const COVER_WITH_CAPTION = "group/cover relative";

// always under the cover, never over its art: it drops into place
const CAPTION =
  "pointer-events-none absolute top-full left-1/2 z-10 mt-2 block w-max max-w-44 -translate-x-1/2 -translate-y-1 truncate border-[1.5px] border-line bg-card px-2 py-1 text-center text-[0.76rem] leading-[1.35] font-semibold text-ink opacity-0 shadow-[2px_2px_0_var(--hard-shadow)] transition-[opacity,translate] duration-150 ease-ink group-hover/cover:translate-y-0 group-hover/cover:opacity-100 group-focus-visible/cover:translate-y-0 group-focus-visible/cover:opacity-100 motion-reduce:transition-none";

export default function CoverCaption({ name }: { name: string }) {
  return (
    <span className={CAPTION} aria-hidden>
      {name}
    </span>
  );
}
