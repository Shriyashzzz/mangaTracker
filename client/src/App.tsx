// The page frame every route shares: backdrop, header, the page, footer.
// Asks the server once whether someone is signed in (store/auth.ts).
import RestoreOnBack from "./lib/RestoreOnBack";
import { useEffect, useRef } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import "./index.css";
import Header from "./layouts/header/Header";
import Footer from "./layouts/Footer/Footer";
import { inApp } from "./lib/inApp";
import DeletedNote from "./components/deletedNote/DeletedNote";
import SupportPeek from "./components/supportPeek/SupportPeek";
import ImportPeek from "./components/importPeek/ImportPeek";
import Tour from "./components/tour/Tour";
import { isDemo } from "./lib/demo";
import { inPlayApp } from "./lib/playApp";
import { useCountry } from "./lib/prefs";
import { useAuth } from "./store/auth";
import OfflineBar from "./components/offlineBar/OfflineBar";
import OfflineNudge from "./components/offlineBar/OfflineNudge";
import { OnlineOnly } from "./components/offlineBar/NeedsConnection";
import { needsConnection } from "./lib/offline";
import {
  CHANGES_SENT,
  sendChanges,
  startSendingChanges,
} from "./lib/offlineChanges";
import { CAME_BACK, watchForComingBack } from "./lib/comeBack";
import { watchConnection } from "./lib/offline";
import { useShelf } from "./store/shelf";

// whether there's a connection, and changes made offline sent once there is
watchConnection();
if (!isDemo()) startSendingChanges();
// sent: the shelf is asked for again, so it's the server's from now on
window.addEventListener(CHANGES_SENT, () => void useShelf.getState().load());
// back after a while away (lib/comeBack.ts): what's changed since, and
// anything changed offline sent
watchForComingBack();
window.addEventListener(CAME_BACK, () => {
  if (!useAuth.getState().isSignedIn || isDemo()) return;
  void useShelf.getState().load();
  void sendChanges();
});

// The page a tab opened on, for ScrollRestoration below: a key of its own,
// kept in that history entry, so Back to it restores even after a reload of
// a later page (a new load, but the same entry)
const FIRST_PAGE_KEY = (() => {
  const state = (window.history.state ?? {}) as { firstKey?: string };
  if (state.firstKey) return state.firstKey;
  const key = `first:${Date.now()}`;
  window.history.replaceState({ ...state, firstKey: key }, "");
  return key;
})();

const firstPageKey = () =>
  (window.history.state as { firstKey?: string } | null)?.firstKey ??
  FIRST_PAGE_KEY;

// the key a page's scroll is kept under, for both restorers below
const scrollKey = (location: { key: string }) =>
  location.key === "default" ? firstPageKey() : location.key;

export default function App() {
  const check = useAuth((s) => s.check);
  const country = useCountry();
  useEffect(() => {
    check();
  }, [check]);

  // a new page: screen readers and keyboards start at its content, rather than
  // being left on a link that's gone. Not on arrival, and not over a search box
  // the page has just focused for them
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const shownPath = useRef(pathname);
  useEffect(() => {
    if (shownPath.current === pathname) return;
    shownPath.current = pathname;
    if (document.activeElement?.tagName !== "INPUT") {
      main.current?.focus({ preventScroll: true });
    }
  }, [pathname]);

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 bg-card px-4 py-3 font-medium text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:border-[2.5px] focus:border-line"
      >
        Skip to content
      </a>
      <Header />
      <OfflineBar />
      <OfflineNudge />
      <main
        id="main"
        ref={main}
        tabIndex={-1}
        // a wide tablet: the phone layout in a centred column (index.css)
        className="outline-none tablet-wide:mx-auto tablet-wide:w-full tablet-wide:max-w-[50rem]"
      >
        {/* a new country means new prices: the page is drawn again and asks
            for them in that country (lib/country.ts) */}
        {needsConnection(pathname) ? (
          <OnlineOnly path={pathname}>
            <Outlet key={country} />
          </OnlineOnly>
        ) : (
          <Outlet key={country} />
        )}
      </main>
      {/* a website's footer; the app has its pages in the menu */}
      {!inApp() && <Footer />}
      <DeletedNote />
      {/* (no coffee asks inside the Google Play app: lib/playApp.ts) */}
      {isDemo() ? <Tour /> : !inPlayApp() && <SupportPeek />}
      {!isDemo() && <ImportPeek />}
      {/* the page this tab opened on (typed, a link from outside, a reload)
          has the key "default", the same for every page, so it opened at an
          old page's scroll position. It gets a key of this visit's own: it
          opens at the top, and Back to it still restores where they were */}
      <ScrollRestoration getKey={scrollKey} />
      {/* and once the page's content has come: lib/RestoreOnBack.tsx */}
      <RestoreOnBack />
    </>
  );
}
