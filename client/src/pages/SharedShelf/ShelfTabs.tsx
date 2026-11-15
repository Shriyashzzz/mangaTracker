// The shared shelf's tabs: Reading, Finished, To read and To get, each a
// stamp in its own colour with how many it holds. All of them fit on the
// first screen; one list shows at a time. (They used to be one long page,
// and a big shelf's Finished and To read sat below everything it's reading.)
// Scrolled past, they stick to the top of the screen, so another list is
// always one tap away.
import { useRef, type ReactNode } from "react";
import { TONES } from "./shareParts";
import type { Tab } from "./sharedShelfView";
import { shareStyles as styles } from "./styles";

export default function ShelfTabs({
  tabs,
  current,
  onPick,
  aside,
}: {
  // the tabs that have anything in them, with their counts
  tabs: { name: Tab; count: number }[];
  current: Tab;
  onPick: (tab: Tab) => void;
  // something small for the room at the right of the tabs on a laptop
  aside?: ReactNode;
}) {
  // where the tabs sit in the page before they stick: a marker just above
  const start = useRef<HTMLDivElement>(null);
  const pick = (tab: Tab) => {
    onPick(tab);
    // scrolled down a list, with the tabs stuck at the top: the new list
    // starts from its first row, tabs still at the top. Not scrolled that
    // far: the page stays where it is
    const marker = start.current;
    if (marker && marker.getBoundingClientRect().top < 0)
      marker.scrollIntoView({ block: "start" });
  };
  return (
    <>
      <div ref={start} className={styles.tabsStart} aria-hidden />
      <div
        className={styles.tabs}
        role="tablist"
        aria-label="What's on the shelf"
      >
        {tabs.map(({ name, count }) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={name === current}
            className={name === current ? styles.tabOn : styles.tab}
            style={{ "--tone": TONES[name] } as React.CSSProperties}
            onClick={() => pick(name)}
          >
            <span className={styles.tabName}>{name}</span>
            <span className={styles.tabCount}>{count}</span>
          </button>
        ))}
        {aside}
      </div>
    </>
  );
}
