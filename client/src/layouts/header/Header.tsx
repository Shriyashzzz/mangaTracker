// The masthead: logo, the two halves of the app (My shelf, Prices; a bar along
// the bottom on phones), and the settings menu. Sits on a newspaper-style double rule.
import { useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import clsx from "clsx";
// same mark as the favicon: a manga volume in an inked panel
import logo from "../../assets/logo.svg";
import SettingsMenu from "../../components/settingsMenu/SettingsMenu";
import { useAuth } from "../../store/auth";
import {
  forgetAllSpots,
  forgetSpot,
  leaveTabFor,
  notePage,
  readSpot,
  scrollBackIfReturning,
  TAB_HOME,
  tabOf,
  type BarTab,
} from "../../lib/tabMemory";

const linkClass = (active: boolean) =>
  clsx(
    "tap relative py-1 text-[0.95rem] transition-colors duration-150 hover:text-ink",
    active ? "squiggle text-ink" : "text-ink-soft",
  );

// one side of the phones' bottom bar: the whole width is the target
const barClass = (active: boolean) =>
  clsx(
    "grid min-h-11 flex-1 place-items-center font-brand text-[1.05rem] tracking-[1px] uppercase transition-colors duration-150",
    active ? "bg-accent text-on-accent" : "text-ink-soft",
  );

export default function Header() {
  const navigate = useNavigate();
  const { pathname, search, state } = useLocation();
  // opened from a card on the New tab: still part of what they were doing there
  const fromShelf = Boolean((state as { fromShelf?: boolean } | null)?.fromShelf);
  const { isSignedIn, logOut } = useAuth();
  const here = pathname + search;
  const currentTab = fromShelf ? "shelf" : tabOf(pathname);
  // the price checker lives at "/", under /prices and at /series
  const onPrices =
    !fromShelf &&
    (pathname === "/" ||
    pathname.startsWith("/prices") ||
    pathname.startsWith("/series"));

  // the page each tab is on, as they move around. A guest's shelf pages only
  // lead to signing in, so those aren't worth going back to
  useEffect(() => {
    if (fromShelf) return;
    if (currentTab && (currentTab !== "shelf" || isSignedIn)) {
      notePage(currentTab, here);
    }
  }, [currentTab, fromShelf, here, isSignedIn]);

  // someone else's pages shouldn't be waiting after a sign out
  useEffect(() => {
    if (isSignedIn === false) forgetSpot("shelf");
  }, [isSignedIn]);

  useEffect(() => scrollBackIfReturning(), [here]);

  // the tab you're on goes to its top page; the other goes back to where you were
  const barLink = (tab: BarTab) => ({
    to: tab === currentTab ? TAB_HOME[tab] : (readSpot(tab)?.path ?? TAB_HOME[tab]),
    onClick: () => leaveTabFor(tab, currentTab, here),
  });

  const handleLogOut = async () => {
    if (await logOut()) {
      forgetAllSpots();
      navigate("/", { viewTransition: true });
    }
  };

  return (
    <header className="relative z-10 border-b-[3px] border-double border-line bg-paper">
      <div className="px-gutter mx-auto flex h-[62px] max-w-page items-center gap-4">
        <NavLink
          to="/"
          viewTransition
          className="tap group mr-auto flex items-center gap-[0.55rem] font-brand text-[1.6rem] leading-none tracking-[1px]"
        >
          <img
            src={logo}
            alt=""
            className="size-[30px] transition-transform duration-250 ease-ink group-hover:-rotate-10"
          />
          <span>Manga Tracker</span>
        </NavLink>

        {/* phones have it at the bottom, within reach of a thumb */}
        <nav className="flex items-center gap-[1.4rem] upto-720:hidden" aria-label="Main">
          <NavLink
            to="/shelf"
            className={({ isActive }) => linkClass(isActive || fromShelf)}
            viewTransition
          >
            My shelf
          </NavLink>
          <NavLink to="/" className={() => linkClass(onPrices)} viewTransition>
            Prices
          </NavLink>
          {isSignedIn === false && (
            <NavLink
              to="/signin"
              className={({ isActive }) => linkClass(isActive)}
              viewTransition
            >
              Sign in
            </NavLink>
          )}
        </nav>

        <SettingsMenu isSignedIn={isSignedIn} onLogOut={handleLogOut} />
      </div>

      {/* out of the way while the keyboard is up */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 hidden border-t-[3px] border-double border-line bg-paper pb-[env(safe-area-inset-bottom)] upto-720:flex [body:has(input:focus,textarea:focus,select:focus)_&]:hidden!"
        aria-label="Main"
      >
        <NavLink
          {...barLink("shelf")}
          className={() => barClass(currentTab === "shelf")}
          viewTransition
        >
          My shelf
        </NavLink>
        <NavLink
          {...barLink("prices")}
          className={() => barClass(currentTab === "prices")}
          viewTransition
        >
          Prices
        </NavLink>
        {isSignedIn === false && (
          <NavLink
            to="/signin"
            className={({ isActive }) => barClass(isActive)}
            viewTransition
          >
            Sign in
          </NavLink>
        )}
      </nav>
    </header>
  );
}
