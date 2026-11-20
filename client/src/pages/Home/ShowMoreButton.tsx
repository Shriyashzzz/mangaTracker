// "Show 20 more" under a shelf that grows rather than turning pages. With
// `bySelf` (in the app, lib/inApp.ts) it presses itself as it scrolls into
// view, so the shelf reads as one long list; it's still there to tap
import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  className: string;
  bySelf: boolean;
  onShowMore: () => void;
  children: ReactNode;
};

export default function ShowMoreButton({
  className,
  bySelf,
  onShowMore,
  children,
}: Props) {
  const button = useRef<HTMLButtonElement>(null);
  // the newest handler, for a watcher made once
  const latest = useRef(onShowMore);
  useEffect(() => {
    latest.current = onShowMore;
  });

  useEffect(() => {
    if (!bySelf || !button.current) return;
    // a screen's height ahead, so the next rows are there before the end
    const watcher = new IntersectionObserver(
      (seen) => {
        if (seen.some((entry) => entry.isIntersecting)) latest.current();
      },
      { rootMargin: "0px 0px 100% 0px" },
    );
    watcher.observe(button.current);
    return () => watcher.disconnect();
  }, [bySelf]);

  return (
    <button
      ref={button}
      type="button"
      className={className}
      onClick={onShowMore}
    >
      {children}
    </button>
  );
}
