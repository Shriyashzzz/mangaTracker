// Coming back to the app. An installed app (or a tab left open) stays in
// memory for days: the shelf it shows is the one from when it was last
// looked at, while the laptop may have changed it since. After a minute or
// more away, coming back says so (CAME_BACK), and the shelf and the open
// series' page are asked for again.

// how long away counts as having gone (a glance at another app doesn't)
export const AWAY_MS = 60_000;
export const CAME_BACK = "cameback";

// whether they were away long enough. Pure, so the server's Jest tests it
export const cameBack = (
  hiddenAt: number | null,
  now: number,
  awayMs = AWAY_MS,
) => hiddenAt != null && now - hiddenAt >= awayMs;

export function watchForComingBack() {
  let hiddenAt: number | null = null;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }
    if (cameBack(hiddenAt, Date.now()))
      window.dispatchEvent(new Event(CAME_BACK));
    hiddenAt = null;
  });
}
