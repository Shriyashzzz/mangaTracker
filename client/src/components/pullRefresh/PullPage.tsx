// A page that refreshes with a pull down from its top, in the app (Android's
// swipe to refresh: lib/usePullToRefresh.ts): the indicator (Kenji, or now
// and then the comic burst: pullLook.ts), and the page moving down after the
// finger and springing back once let go. The shelf and To buy use it
import { useState, type ReactNode } from "react";
import { usePullToRefresh } from "../../lib/usePullToRefresh";
import PullRefresh from "./PullRefresh";
import { pickLook, type Look } from "./pullLook";

export default function PullPage({
  refresh,
  className,
  children,
}: {
  // what the pull asks for again
  refresh: () => Promise<unknown>;
  className: string;
  children: ReactNode;
}) {
  const [look, setLook] = useState<Look>("kenji");
  const pulling = usePullToRefresh(refresh, () => setLook(pickLook()));
  return (
    <>
      {/* outside the page it pulls down: inside, its fixed place would move
          with the page */}
      <PullRefresh
        pull={pulling.pull}
        busy={pulling.busy}
        ready={pulling.ready}
        look={look}
      />
      <div
        className={className}
        style={
          pulling.pull > 0
            ? {
                transform: `translateY(${pulling.pull}px)`,
                transition: pulling.dragging
                  ? "none"
                  : "transform 260ms cubic-bezier(0.2, 0, 0, 1)",
              }
            : undefined
        }
      >
        {children}
      </div>
    </>
  );
}
