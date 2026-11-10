// Back from a release's price page (its row or its Preorder link) to the
// list it was in: the page as they left it, rather than folded up at the
// top. Only then: those links note where they were, and only a Back to that
// same page uses it.
// Folds that should come back open carry data-keep; a list showing all of
// its releases carries data-keep-all
import { useEffect } from "react";
import { useNavigationType } from "react-router";

const KEY = "preorderReturn";
type Spot = { path: string; y: number; open: string[]; all: string[] };

const here = () => window.location.pathname + window.location.search;

export function rememberSpot() {
  const spot: Spot = {
    path: here(),
    y: window.scrollY,
    open: [
      ...document.querySelectorAll<HTMLDetailsElement>("details[data-keep]"),
    ]
      .filter((d) => d.open)
      .map((d) => d.dataset.keep!),
    all: [...document.querySelectorAll<HTMLElement>("[data-keep-all]")].map(
      (e) => e.dataset.keepAll!,
    ),
  };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(spot));
  } catch {
    // storage off: Back just opens the page as usual
  }
}

// the spot noted for this page, if any
function spotHere(): Spot | null {
  try {
    const spot = JSON.parse(
      sessionStorage.getItem(KEY) ?? "null",
    ) as Spot | null;
    return spot?.path === here() ? spot : null;
  } catch {
    return null;
  }
}

// a list that was showing all of its releases shows them all again
export function useWasShowingAll(keep: string | undefined) {
  const back = useNavigationType() === "POP";
  return () => Boolean(keep && back && spotHere()?.all.includes(keep));
}

// once the page's releases are in (ready), its folds opened and the scroll
// put back; the note is used once, whichever way they arrived
export function useReturnSpot(ready: boolean) {
  const back = useNavigationType() === "POP";
  useEffect(() => {
    if (!ready) return;
    const spot = spotHere();
    if (!spot) return;
    sessionStorage.removeItem(KEY);
    if (!back) return;
    for (const d of document.querySelectorAll<HTMLDetailsElement>(
      "details[data-keep]",
    ))
      if (spot.open.includes(d.dataset.keep!)) d.open = true;
    requestAnimationFrame(() => window.scrollTo(0, spot.y));
  }, [ready, back]);
}
