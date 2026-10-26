import { useState } from "react";
import { StarIcon } from "../icons/Icons";
import styles from "./StarRating.module.css";

// read-only when no onChange is passed
export default function StarRating({ value = 0, onChange, size = "md" }) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value || 0;
  const interactive = typeof onChange === "function";

  if (!interactive) {
    return (
      <span
        className={`${styles.stars} ${styles[size]}`}
        aria-label={value ? `Rated ${value} out of 5` : "Not rated"}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <StarIcon
            key={n}
            filled={n <= shown}
            className={n <= shown ? styles.on : styles.off}
          />
        ))}
      </span>
    );
  }

  return (
    <div
      className={`${styles.stars} ${styles[size]}`}
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={styles.starBtn}
          onMouseEnter={() => setHovered(n)}
          onFocus={() => setHovered(n)}
          onBlur={() => setHovered(0)}
          // clicking the current rating clears it, same as the old MUI behaviour
          onClick={() => onChange(n === value ? 0 : n)}
        >
          <StarIcon
            filled={n <= shown}
            className={n <= shown ? styles.on : styles.off}
          />
        </button>
      ))}
    </div>
  );
}
