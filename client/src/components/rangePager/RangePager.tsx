// Splits a long list into pages of `pageSize` and offers a quick-select chip
// per page ("Vol. 1–30", "31–60", ...) plus previous / next. `labelFor`
// turns a page's first and last item into the chip text. Renders nothing
// when everything fits on one page. On phones the chips scroll sideways
// instead of wrapping into a wall.
import { useEffect, useRef } from "react";
import clsx from "clsx";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons/Icons";

type Props = {
  total: number;
  pageSize?: number;
  // the current page, from 0
  page: number;
  onChange: (page: number) => void;
  labelFor?: (start: number, end: number) => string;
  label?: string;
};

// shared by the chips and the arrow buttons
const pagerButton =
  "h-[34px] shrink-0 rounded-[2px] border-[1.5px] border-line-soft bg-card font-mono text-[0.8rem] whitespace-nowrap text-ink-soft transition-[border-color,color] duration-120 ease-[ease] focus-visible:outline-offset-2";
const stepButton = clsx(
  pagerButton,
  "grid w-[34px] place-items-center p-0 hover:enabled:border-line hover:enabled:text-ink disabled:cursor-default disabled:opacity-40 [&_svg]:size-4",
);

export default function RangePager({
  total,
  pageSize = 30,
  page,
  onChange,
  labelFor = (start, end) => `${start}–${end}`,
  label = "Pages",
}: Props) {
  const chipsRef = useRef<HTMLUListElement>(null);
  const pages = Math.ceil(total / pageSize);

  // on phones the chips scroll sideways; keep the current one in view
  useEffect(() => {
    chipsRef.current
      ?.querySelector("[aria-current]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [page]);

  if (pages <= 1) return null;

  const go = (p: number) => onChange(Math.min(Math.max(p, 0), pages - 1));

  return (
    <nav className="mt-1 mb-5 flex min-w-0 items-center gap-2" aria-label={label}>
      <button
        type="button"
        className={stepButton}
        onClick={() => go(page - 1)}
        disabled={page === 0}
        aria-label="Previous page"
      >
        <ChevronLeftIcon />
      </button>
      <ul
        className="flex min-w-0 gap-[0.4rem] overflow-x-auto p-0.5 [scrollbar-color:var(--line-soft)_transparent] [scrollbar-width:thin]"
        ref={chipsRef}
      >
        {Array.from({ length: pages }, (_, p) => {
          const start = p * pageSize;
          const end = Math.min(start + pageSize, total) - 1;
          const current = p === page;
          return (
            <li key={p}>
              <button
                type="button"
                className={clsx(
                  pagerButton,
                  "px-3 hover:border-line hover:text-ink",
                  current && "border-line bg-ink text-paper hover:text-paper",
                )}
                aria-current={current ? "page" : undefined}
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
        className={stepButton}
        onClick={() => go(page + 1)}
        disabled={page === pages - 1}
        aria-label="Next page"
      >
        <ChevronRightIcon />
      </button>
    </nav>
  );
}
