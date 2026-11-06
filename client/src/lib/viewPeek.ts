// When Kenji asks someone on big covers whether they'd like compact rows: once
// the shelf has a few series, then every couple of days if they let him duck
// away, and never again once they've tried it or closed him. Kept in this
// browser (components/viewPeek/ViewPeek.tsx reads and writes it), so another
// device might ask once more. Pure, so the server's Jest can test it.

export const VIEW_PEEK_KEY = "viewPeek";
// fewer than this and the two views look much the same, and a new shelf
// has the tour to think about first
export const VIEW_PEEK_MIN_SERIES = 20;
export const ASK_AGAIN_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
// left alone, he ducks away after this
export const VIEW_PEEK_LEAVE_MS = 12_000;

export type ViewPeekState = {
  lastShownAt?: number;
  // they tried it or closed him: no more asking
  done?: boolean;
};

export const readViewPeek = (saved: string | null): ViewPeekState => {
  try {
    const state = JSON.parse(saved ?? "{}") as unknown;
    return state && typeof state === "object" ? (state as ViewPeekState) : {};
  } catch {
    return {};
  }
};

export const canAskAboutView = (
  state: ViewPeekState,
  { series, rows, now }: { series: number; rows: boolean; now: number },
) =>
  !state.done &&
  !rows &&
  series >= VIEW_PEEK_MIN_SERIES &&
  now - (state.lastShownAt ?? 0) >= ASK_AGAIN_AFTER_MS;
