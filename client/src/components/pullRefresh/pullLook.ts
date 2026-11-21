// Which look the app's swipe to refresh takes (PullRefresh.tsx): Kenji, or
// now and then the comic burst, never on someone's first pull and never two
// in a row. Kept in localStorage, so it holds across visits
export type Look = "kenji" | "burst";
const SEEN_KEY = "pullSeen";
const LAST_KEY = "pullLast";
// how often the burst turns up
const BURST_ODDS = 1 / 6;

// picked as a pull begins (lib/usePullToRefresh.ts onStart), kept to its end
export function pickLook(): Look {
  try {
    const seen = localStorage.getItem(SEEN_KEY) === "yes";
    const last = localStorage.getItem(LAST_KEY);
    const look: Look =
      seen && last !== "burst" && Math.random() < BURST_ODDS
        ? "burst"
        : "kenji";
    localStorage.setItem(SEEN_KEY, "yes");
    localStorage.setItem(LAST_KEY, look);
    return look;
  } catch {
    return "kenji";
  }
}
