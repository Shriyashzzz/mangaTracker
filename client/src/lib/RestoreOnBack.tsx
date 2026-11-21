// Back to a page puts it as it was: the folds that were open, open again,
// and the scroll where it was. The scroll is kept here, as they scroll, for
// the page's place in the history (lib/visitState.ts): React Router's own
// record is taken after the page transition has already put the next page
// at the top, so it keeps 0. Most pages draw their content once its data
// comes, so this waits for the page to grow tall enough, opens the folds,
// then scrolls. It gives up once they touch the screen themselves, or after
// a few seconds
import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router";
import {
  historyEntry,
  readVisit,
  stillFresh,
  visitKey,
  writeVisit,
} from "./visitState";

const GIVE_UP_MS = 5000;

const folds = () => [
  ...document.querySelectorAll<HTMLDetailsElement>("main details"),
];

// the scroll, noted for the page on screen as it changes
function useNoteScroll() {
  useEffect(() => {
    let frame = 0;
    const note = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        writeVisit(
          visitKey(window.location.pathname, "scroll"),
          Math.round(window.scrollY),
        ),
      );
    };
    window.addEventListener("scroll", note, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", note);
    };
  }, []);
}

export default function RestoreOnBack() {
  useNoteScroll();
  const location = useLocation();
  const back = useNavigationType() === "POP";
  const { pathname } = location;

  // the folds open now, noted as they're opened and closed
  useEffect(() => {
    const key = visitKey(pathname, "folds");
    const note = (e: Event) => {
      if (!(e.target instanceof HTMLDetailsElement)) return;
      const open = folds().flatMap((d, i) => (d.open ? [i] : []));
      writeVisit(key, open);
    };
    document.addEventListener("toggle", note, true);
    return () => document.removeEventListener("toggle", note, true);
  }, [pathname]);

  // the time they leave this page, for its place's 5 minutes (visitState.ts)
  useEffect(() => {
    const entry = historyEntry();
    const leave = () =>
      writeVisit(visitKey(pathname, "leftAt", entry), Date.now());
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
    // once per arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    if (!back) return;
    // away too long: the page as if opened fresh, at its top (React Router
    // would still put back its own idea of the place)
    if (!stillFresh(pathname)) {
      window.scrollTo(0, 0);
      return;
    }
    const y = readVisit<number>(visitKey(pathname, "scroll")) ?? 0;
    const open = readVisit<number[]>(visitKey(pathname, "folds")) ?? [];
    if (!y && !open.length) return;

    let done = false;
    let foldsOpened = !open.length;
    const stop = () => {
      done = true;
      grows.disconnect();
      window.clearTimeout(timer);
      for (const event of ["touchstart", "wheel", "keydown"])
        window.removeEventListener(event, stop);
    };
    const tryNow = () => {
      if (done) return;
      if (!foldsOpened) {
        const all = folds();
        if (all.length > Math.max(...open)) {
          for (const i of open) if (all[i]) all[i].open = true;
          foldsOpened = true;
        }
      }
      const reachable =
        document.documentElement.scrollHeight - window.innerHeight;
      if (foldsOpened && reachable >= y - 2) {
        window.scrollTo(0, y);
        stop();
      }
    };
    const grows = new ResizeObserver(tryNow);
    grows.observe(document.body);
    const timer = window.setTimeout(stop, GIVE_UP_MS);
    for (const event of ["touchstart", "wheel", "keydown"])
      window.addEventListener(event, stop, { passive: true });
    requestAnimationFrame(tryNow);
    return stop;
    // once per arrival: the location's key names it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  return null;
}
