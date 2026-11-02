// Five stars. Read-only when no onChange is passed; otherwise a radio group
// where clicking the current rating clears it.
import { useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import { StarIcon } from "../icons/Icons";

type Props = {
  value?: number | null;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
};

const SIZES = { sm: "size-3.5", md: "size-5", lg: "size-[30px]" };

export default function StarRating({ value = 0, onChange, size = "md" }: Props) {
  const [hovered, setHovered] = useState(0);
  const current = value ?? 0;
  const shown = hovered || current;

  const star = (n: number) => (
    <StarIcon
      filled={n <= shown}
      // inked like the drawings, so a gold star holds up on pale paper
      className={clsx(
        SIZES[size],
        n <= shown ? "stroke-line text-star" : "text-star-off",
      )}
    />
  );

  // a radio group moves with the arrow keys, as one tab stop
  const moveWithArrows = (e: KeyboardEvent<HTMLButtonElement>, n: number) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = Math.min(5, Math.max(1, n + step));
    onChange?.(next);
    const stars = e.currentTarget.parentElement?.children;
    (stars?.[next - 1] as HTMLElement | undefined)?.focus();
  };

  if (!onChange) {
    return (
      <span
        className="inline-flex items-center gap-0.5"
        role="img"
        aria-label={current ? `Rated ${current} out of 5` : "Not rated"}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          // flex, so no browser can sit a star on its text baseline instead
          <span key={n} className="flex">
            {star(n)}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-0.5"
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === current}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          tabIndex={n === (current || 1) ? 0 : -1}
          onKeyDown={(e) => moveWithArrows(e, n)}
          className="grid min-h-11 min-w-11 place-items-center rounded-md transition-transform duration-150 ease-ink hover:scale-115 active:scale-92"
          onMouseEnter={() => setHovered(n)}
          onFocus={() => setHovered(n)}
          onBlur={() => setHovered(0)}
          onClick={() => onChange(n === current ? 0 : n)}
        >
          {star(n)}
        </button>
      ))}
    </div>
  );
}
