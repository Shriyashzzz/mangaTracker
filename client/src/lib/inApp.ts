// Whether Manga Tracker is running as an app: the Google Play app (opened
// with its own referrer, lib/playApp.ts) or added to a home screen (it opens
// standalone, lib/install.ts). Inside it, it behaves like one: no website
// footer, a back arrow with the screen's name in place of breadcrumbs, the
// shelf scrolling on rather than paging, no pull-to-reload. The website is
// unchanged. Marked on <html> as "in-app" so styles can follow it too
import { runsAsApp } from "./install";
import { inPlayApp } from "./playApp";

export const inApp = () => runsAsApp() || inPlayApp();

// called once as the page starts, after the Play app's referrer is noted
export function markInApp() {
  if (!inApp()) return;
  document.documentElement.classList.add("in-app");
  hideTheBrowser();
}

// where words are typed: their own menu (paste) and selection stay
const TYPING = 'input, textarea, [contenteditable="true"]';
const typing = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest(TYPING));

// Nothing that says it's a web page inside Chrome (index.css html.in-app
// has the rest: no text selection, no picture dragging): no long-press menu
// on a link or picture ("Open in new tab", "Download image"), no offer to
// translate the page (the Japanese titles can set it off), and no pinch to
// zoom, as no Android app zooms (Android's own Magnification still does)
function hideTheBrowser() {
  document.addEventListener(
    "contextmenu",
    (e) => {
      if (!typing(e.target)) e.preventDefault();
    },
    { capture: true },
  );
  document.addEventListener(
    "dragstart",
    (e) => {
      if (!typing(e.target)) e.preventDefault();
    },
    { capture: true },
  );
  const root = document.documentElement;
  root.setAttribute("translate", "no");
  const noTranslate = document.createElement("meta");
  noTranslate.name = "google";
  noTranslate.content = "notranslate";
  document.head.append(noTranslate);
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport)
    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
    );
}

// the bottom bar's tabs' own screens, where the app keeps the logo; any
// other screen has a back arrow and its name (layouts/header/AppBackBar.tsx)
const TAB_SCREENS = new Set(["/", "/shelf", "/prices", "/to-buy"]);
export const isTabScreen = (pathname: string) => TAB_SCREENS.has(pathname);

// In the app a menu opens as a bottom sheet over a dimmed screen
// (index.css .app-sheet): the tap on the dimmed part that closes it only
// closes it, never also opening the card under the finger. Only that tap's
// own click is stopped (the same thing pressed), and only until the next
// press: a later tap anywhere works as ever
export function swallowClosingTap(pressed: EventTarget | null) {
  if (!inApp() || !(pressed instanceof Node)) return;
  const stop = (e: Event) => {
    if (e.target instanceof Node && pressed.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
    forget();
  };
  const forget = () => {
    document.removeEventListener("click", stop, { capture: true });
    document.removeEventListener("pointerdown", forget, { capture: true });
  };
  document.addEventListener("click", stop, { capture: true });
  // the next press is a new tap: nothing of this one is stopped then
  window.setTimeout(
    () =>
      document.addEventListener("pointerdown", forget, {
        capture: true,
        once: true,
      }),
    0,
  );
}
