// The page frame every route shares: backdrop, header, the page, footer.
// Asks the server once whether someone is signed in (store/auth.ts).
import { useEffect, useRef } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import "./index.css";
import Backdrop from "./components/backdrop/Backdrop";
import Header from "./layouts/header/Header";
import Footer from "./layouts/Footer/Footer";
import DeletedNote from "./components/deletedNote/DeletedNote";
import SupportPeek from "./components/supportPeek/SupportPeek";
import ImportPeek from "./components/importPeek/ImportPeek";
import Tour from "./components/tour/Tour";
import TourOffer from "./components/tour/TourOffer";
import { isDemo } from "./lib/demo";
import { useAuth } from "./store/auth";

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

export default function App() {
  const check = useAuth((s) => s.check);
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
      <Backdrop />
      <Header />
      <main id="main" ref={main} tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <Footer />
      <DeletedNote />
      {isDemo() ? <Tour /> : <SupportPeek />}
      {!isDemo() && <ImportPeek />}
      {!isDemo() && <TourOffer />}
      {/* the page this tab opened on (typed, a link from outside, a reload)
          has the key "default", the same for every page, so it opened at an
          old page's scroll position. It gets a key of this visit's own: it
          opens at the top, and Back to it still restores where they were */}
      <ScrollRestoration
        getKey={(location) =>
          location.key === "default" ? firstPageKey() : location.key
        }
      />
    </>
  );
}
