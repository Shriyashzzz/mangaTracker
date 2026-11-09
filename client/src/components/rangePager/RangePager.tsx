// Splits a long list into pages of `pageSize` and offers a quick-select chip
// per page ("Vol. 1–30", "31–60", ...) plus previous / next. `labelFor`
// turns a page's first and last item into the chip text. Renders nothing
// when everything fits on one page. On phones the chips scroll sideways
// instead of wrapping into a wall.
import { useEffect, useRef, type ReactNode } from "react";
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
  // each page's own address: the chips and arrows become real links (a
  // search engine can follow them to every page), a plain click still
  // changes page in place
  hrefFor?: (page: number) => string;
};

// shared by the chips and the arrow buttons
const pagerButton =
  "h-[34px] upto-720:h-11 shrink-0 rounded-[2px] border-[1.5px] border-line-soft bg-card font-mono text-[0.8rem] whitespace-nowrap text-ink-soft transition-[border-color,color] duration-120 ease-[ease] focus-visible:outline-offset-2";
const stepButton = clsx(
  pagerButton,
  "grid w-[34px] upto-720:w-11 place-items-center p-0 hover:enabled:border-line hover:enabled:text-ink disabled:cursor-default disabled:opacity-40 [&_svg]:size-4",
);

// one pager control: a link when pages have addresses, else a plain button.
// A click with a modifier key (new tab) is left to the browser
function PageControl({
  to,
  go,
  hrefFor,
  disabled,
  className,
  children,
  ...rest
}: {
  to: number;
  go: (page: number) => void;
  hrefFor?: (page: number) => string;
  disabled?: boolean;
  className: string;
  children: ReactNode;
  "aria-label"?: string;
  "aria-current"?: "page";
}) {
  if (hrefFor && !disabled)
    return (
      <a
        href={hrefFor(to)}
        className={className}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button)
            return;
          e.preventDefault();
          go(to);
        }}
        {...rest}
      >
        {children}
      </a>
    );
  return (
    <button
      type="button"
      className={className}
      onClick={() => go(to)}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

export default function RangePager({
  total,
  pageSize = 30,
  page,
  onChange,
  labelFor = (start, end) => `${start}–${end}`,
  label = "Pages",
  hrefFor,
}: Props) {
  const chipsRef = useRef<HTMLUListElement>(null);
  const pages = Math.ceil(total / pageSize);

  // on phones the chips scroll sideways; keep the current one in view
  // (only the chips: scrollIntoView would also drag the whole page to the pager)
  useEffect(() => {
    const chips = chipsRef.current;
    const chip = chips?.querySelector("[aria-current]");
    if (!chips || !chip) return;
    const box = chips.getBoundingClientRect();
    const { left, right } = chip.getBoundingClientRect();
    if (left < box.left) chips.scrollLeft -= box.left - left;
    else if (right > box.right) chips.scrollLeft += right - box.right;
  }, [page]);

  if (pages <= 1) return null;

  const go = (p: number) => onChange(Math.min(Math.max(p, 0), pages - 1));

  return (
    <nav
      className="mt-1 mb-5 flex min-w-0 items-center gap-2"
      aria-label={label}
    >
      <PageControl
        go={go}
        hrefFor={hrefFor}
        to={page - 1}
        className={stepButton}
        disabled={page === 0}
        aria-label="Previous page"
      >
        <ChevronLeftIcon />
      </PageControl>
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
              <PageControl
                go={go}
                hrefFor={hrefFor}
                to={p}
                className={clsx(
                  pagerButton,
                  "inline-flex items-center px-3 hover:border-line hover:text-ink",
                  current && "border-line bg-ink text-paper hover:text-paper",
                )}
                aria-current={current ? "page" : undefined}
              >
                {labelFor(start, end)}
              </PageControl>
            </li>
          );
        })}
      </ul>
      <PageControl
        go={go}
        hrefFor={hrefFor}
        to={page + 1}
        className={stepButton}
        disabled={page === pages - 1}
        aria-label="Next page"
      >
        <ChevronRightIcon />
      </PageControl>
    </nav>
  );
}
