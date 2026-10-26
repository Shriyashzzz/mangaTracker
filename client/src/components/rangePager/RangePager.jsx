import { ChevronLeftIcon, ChevronRightIcon } from "../icons/Icons";
import styles from "./RangePager.module.css";

// splits a long list into pages of `pageSize` and offers a quick-select chip
// per page ("Vol. 1–30", "31–60", ...) plus previous / next. `labelFor`
// turns a page's first and last item into the chip text. Renders nothing
// when everything fits on one page
export default function RangePager({
  total,
  pageSize = 30,
  page,
  onChange,
  labelFor = (start, end) => `${start}–${end}`,
  label = "Pages",
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  const go = (p) => onChange(Math.min(Math.max(p, 0), pages - 1));

  return (
    <nav className={styles.pager} aria-label={label}>
      <button
        type="button"
        className={styles.step}
        onClick={() => go(page - 1)}
        disabled={page === 0}
        aria-label="Previous page"
      >
        <ChevronLeftIcon />
      </button>
      <ul className={styles.chips}>
        {Array.from({ length: pages }, (_, p) => {
          const start = p * pageSize;
          const end = Math.min(start + pageSize, total) - 1;
          return (
            <li key={p}>
              <button
                type="button"
                className={p === page ? styles.active : ""}
                aria-current={p === page ? "page" : undefined}
                onClick={() => go(p)}
              >
                {labelFor(start, end)}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className={styles.step}
        onClick={() => go(page + 1)}
        disabled={page === pages - 1}
        aria-label="Next page"
      >
        <ChevronRightIcon />
      </button>
    </nav>
  );
}
