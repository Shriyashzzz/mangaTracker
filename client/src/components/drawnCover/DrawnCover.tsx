// A cover drawn from the series' name, for one with no image (or one that
// won't load): a printed panel with the title lettered on it. Each title gets
// its own paper tint, screen pattern and layout, picked from its name, so a
// shelf of them still reads as different books, and the same series always
// looks the same. Fills its box; the lettering scales with it (container
// units). Dimmed in dark mode (index.css, "drawn covers").
import clsx from "clsx";
import type { CSSProperties } from "react";

// muted print paper: cream, warm, cool, rose, sage, straw
const TINTS = [
  "#fbf8f0",
  "#f3e3cf",
  "#e3eaec",
  "#f1dfdc",
  "#e4ecda",
  "#f2ebcc",
];
// the screen printed over it
const PATTERNS = [
  "radial-gradient(var(--dots-strong) 1px, transparent 1.2px) 0 0 / 7px 7px",
  "repeating-linear-gradient(135deg, var(--dots-strong) 0 1px, transparent 1px 7px)",
  "repeating-linear-gradient(0deg, var(--dots-strong) 0 1px, transparent 1px 9px)",
  "radial-gradient(var(--dots-strong) 1.4px, transparent 1.6px) 0 0 / 11px 11px",
  "none",
];

// a stable number from the title
const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export default function DrawnCover({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const h = hash(title.trim().toLowerCase());
  const tint = TINTS[h % TINTS.length]!;
  const pattern = PATTERNS[(h >>> 3) % PATTERNS.length]!;
  // where the lettering sits, and whether the top band is ink or red
  const low = ((h >>> 6) & 1) === 1;
  const red = ((h >>> 7) & 3) === 0;
  const bandWide = ((h >>> 9) & 1) === 1;
  const look: CSSProperties = { background: `${pattern}, ${tint}` };
  return (
    // the container is the box itself; the padding sits on the layer inside,
    // since a container's own padding can't be measured in its own units
    <span
      className={clsx(
        "drawn-cover printed @container absolute inset-0 overflow-hidden",
        className,
      )}
      style={look}
      aria-hidden
    >
      <span
        className={clsx(
          "flex size-full flex-col p-[8cqw]",
          low ? "justify-between" : "justify-start gap-[10cqw]",
        )}
      >
        {/* a printed band across the top, like a volume's publisher strip */}
        <span
          className={clsx(
            "block h-[5cqw]",
            bandWide ? "w-full" : "w-[45%]",
            red ? "bg-accent" : "bg-ink",
          )}
        />
        <span className="line-clamp-5 font-brand text-[clamp(0.45rem,15cqw,2.2rem)] leading-[0.95] tracking-[0.02em] text-balance wrap-anywhere text-ink uppercase">
          {title}
        </span>
        <span
          className={clsx("block h-[2cqw] w-full bg-ink", !low && "mt-auto")}
        />
      </span>
    </span>
  );
}
