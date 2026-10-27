// Five stars. Read-only when no onChange is passed; otherwise a radio group
// where clicking the current rating clears it.
import { useState } from "react";
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
      className={clsx(SIZES[size], n <= shown ? "text-star" : "text-star-off")}
    />
  );

  if (!onChange) {
    return (
      <span
        className="inline-flex items-center gap-0.5"
        aria-label={current ? `Rated ${current} out of 5` : "Not rated"}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n}>{star(n)}</span>
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
          className="grid place-items-center rounded-md p-0.5 transition-transform duration-150 ease-ink hover:scale-115 active:scale-92"
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
