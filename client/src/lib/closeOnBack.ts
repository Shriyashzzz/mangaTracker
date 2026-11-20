// Android's back closes what's open before it leaves the screen, as an app's
// does: Select, the shelf's search, a dropdown, the profile menu. Escape on a
// keyboard is the same request. The newest thing open closes first.
//
// Chrome sends both to a CloseWatcher (Chrome 120 and later, as it does for
// the native <dialog>s). Where there's none (Firefox, Safari: no back button
// to catch), Escape still closes the newest one through a list kept here.
import { useEffect, useRef } from "react";

type Watcher = { onclose: (() => void) | null; destroy: () => void };
type WatcherMaker = new () => Watcher;

// without CloseWatcher: what's open, newest last
const openNow: { current: () => void }[] = [];

function onEscape(e: KeyboardEvent) {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  // a native dialog closes itself on Escape
  if (document.querySelector("dialog[open]")) return;
  openNow.at(-1)?.current();
}

// while `open`, the next back (or Escape) calls `close` instead of leaving
export function useCloseOnBack(open: boolean, close: () => void) {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });

  useEffect(() => {
    if (!open) return;
    const Maker = (window as { CloseWatcher?: WatcherMaker }).CloseWatcher;
    if (Maker) {
      const watcher = new Maker();
      watcher.onclose = () => latest.current();
      return () => watcher.destroy();
    }
    openNow.push(latest);
    if (openNow.length === 1) document.addEventListener("keydown", onEscape);
    return () => {
      openNow.splice(openNow.indexOf(latest), 1);
      if (!openNow.length) document.removeEventListener("keydown", onEscape);
    };
  }, [open]);
}
