// The page frame every route shares: backdrop, header, the page, footer.
// Asks the server once whether someone is signed in (store/auth.ts).
import { useEffect, useRef } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import "./index.css";
import Backdrop from "./components/backdrop/Backdrop";
import Header from "./layouts/header/Header";
import Footer from "./layouts/Footer/Footer";
import { useAuth } from "./store/auth";

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
      <ScrollRestoration />
    </>
  );
}
