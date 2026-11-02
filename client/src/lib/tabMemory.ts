// The phones' bottom bar works like an app's: each tab remembers the page it was
// on, so a look at the prices doesn't lose the manga you had open. Per browser
// tab, and only for as long as that tab is open.
export type BarTab = "shelf" | "prices";

const KEY = "barTabs";
export const TAB_HOME: Record<BarTab, string> = { shelf: "/shelf", prices: "/" };

// null: a page that belongs to neither, like About
export const tabOf = (pathname: string): BarTab | null => {
  if (/^\/(shelf|details|add|update|import)(\/|$)/.test(pathname)) return "shelf";
  if (pathname === "/" || /^\/(prices|series)(\/|$)/.test(pathname)) return "prices";
  return null;
};

type Spot = { path: string; y: number };
type Spots = Partial<Record<BarTab, Spot>>;

// sessionStorage can throw in locked-down browsers; the tabs just forget then
const read = (): Spots => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Spots;
  } catch {
    return {};
  }
};
const write = (spots: Spots) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(spots));
  } catch {
    /* ignore */
  }
};

export const readSpot = (tab: BarTab) => read()[tab];

// a new page starts at its top; the same page keeps its scroll
export const notePage = (tab: BarTab, path: string) => {
  const spots = read();
  if (spots[tab]?.path !== path) write({ ...spots, [tab]: { path, y: 0 } });
};

// how far down to go once the page they tapped their way back to has opened
let returningTo: number | null = null;

// the bar was tapped: keep their place here, and note the one they're going to
export const leaveTabFor = (
  tab: BarTab,
  from: BarTab | null,
  fromPath: string,
) => {
  if (tab === from) {
    returningTo = null;
    return;
  }
  const spots = read();
  returningTo = spots[tab]?.y ?? null;
  if (from) write({ ...spots, [from]: { path: fromPath, y: window.scrollY } });
};

export const forgetSpot = (tab: BarTab) => {
  const spots = read();
  delete spots[tab];
  write(spots);
};

export const forgetAllSpots = () => write({});

// pages fill in after they open, so keep trying until the page is tall enough.
// Whoever starts scrolling themselves wins. Returns how to stop early
export const scrollBackIfReturning = () => {
  const y = returningTo;
  returningTo = null;
  if (!y) return undefined;
  const started = performance.now();
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("wheel", stop);
  };
  const step = () => {
    window.scrollTo({ top: y, behavior: "instant" });
    const elapsed = performance.now() - started;
    const arrived = Math.abs(window.scrollY - y) < 2;
    // a little past arriving: the router also scrolls a new page to the top
    if ((arrived && elapsed > 400) || elapsed > 2500) stop();
    else frame = requestAnimationFrame(step);
  };
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("wheel", stop, { passive: true });
  frame = requestAnimationFrame(step);
  return stop;
};
