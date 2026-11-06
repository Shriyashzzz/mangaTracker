// The masthead: logo, the two halves of the app (My shelf, Prices; a bar along
// the bottom on phones, with New between them so what's out is a thumb away),
// and the settings menu. Sits on a newspaper-style double rule.
import { useEffect, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import clsx from "clsx";
// same mark as the favicon: a manga volume in an inked panel
import logo from "../../assets/logo.svg";
import SettingsMenu from "../../components/settingsMenu/SettingsMenu";
import { useFromShelf } from "../../lib/fromShelf";
import { probablySignedIn, useAuth } from "../../store/auth";
import { useShelf } from "../../store/shelf";
import { readLocal, useReleaseChecksOn } from "../../lib/prefs";
import { LAST_NEW_COUNT_KEY } from "../../lib/shelf";
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

// one part of the phones' bottom bar: the whole width is the target
const barClass = (active: boolean) =>
  clsx(
    "group flex min-h-14 flex-1 items-center justify-center gap-1.5 font-brand text-[1.2rem] tracking-[1px] uppercase transition-colors duration-150",
    active ? "bg-accent text-on-accent" : "text-ink-soft",
  );
// New's count in the bar: red on paper, paper on red once it's the one open
const barCount =
  "rounded-[3px] bg-accent px-1.5 font-mono text-[0.78rem] leading-[1.35] tracking-normal text-on-accent tabular-nums group-data-on:bg-on-accent group-data-on:text-accent";

export default function Header() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  // opened from a card on the New tab: still part of what they were doing there
  const fromShelf = useFromShelf();
  const { isSignedIn, logOut } = useAuth();
  const here = pathname + search;
  // the shelf's New view has its own place in the phones' bar
  const onNew =
    pathname === "/shelf" && new URLSearchParams(search).get("tab") === "new";
  const checksOn = useReleaseChecksOn();
  const manga = useShelf((s) => s.manga);
  const releases = useShelf((s) => s.releases);
  // what's new, as the shelf counts it: from this visit's checks once there
  // are any, else what the last full check found
  const newCount = useMemo(() => {
    if (manga && Object.keys(releases).length)
      return manga.filter(
        (m) =>
          !m.planned &&
          (releases[m.id]?.hasNewVolume || releases[m.id]?.hasNewChapter),
      ).length;
    return Number(readLocal(LAST_NEW_COUNT_KEY)) || 0;
  }, [manga, releases]);
  const currentTab = fromShelf ? "shelf" : tabOf(pathname);
  // the home page anyone new sees is both halves of the app, so neither lights up
  const guestHome =
    pathname === "/" &&
    !search &&
    (isSignedIn === false || (isSignedIn === null && !probablySignedIn()));
  // the price checker lives at "/", under /prices and at /series
  const onPrices =
    !fromShelf &&
    !guestHome &&
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
    to:
      tab === currentTab
        ? TAB_HOME[tab]
        : (readSpot(tab)?.path ?? TAB_HOME[tab]),
    onClick: () => leaveTabFor(tab, currentTab, here),
  });

  const handleLogOut = async () => {
    if (await logOut()) {
      forgetAllSpots();
      navigate("/", { viewTransition: true });
    }
  };

  // above the page and its floating add button, so the menu hanging off it
  // never ends up underneath them
  return (
    <header className="relative z-30 border-b-[3px] border-double border-line bg-paper">
      <div className="px-gutter mx-auto flex h-[62px] max-w-page items-center gap-4">
        <NavLink
          to={isSignedIn ? "/shelf" : "/"}
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
        <nav
          className="flex items-center gap-[1.4rem] upto-720:hidden"
          aria-label="Main"
        >
          <NavLink
            to="/shelf"
            className={({ isActive }) => linkClass(isActive || fromShelf)}
            viewTransition
          >
            My shelf
          </NavLink>
          <NavLink
            to="/"
            data-tour="tab-prices"
            className={() => linkClass(onPrices)}
            viewTransition
          >
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
          // from New, or back to a shelf last left on New: the shelf itself
          to={
            onNew || /[?&]tab=new/.test(barLink("shelf").to)
              ? "/shelf?tab=all"
              : barLink("shelf").to
          }
          className={() => barClass(currentTab === "shelf" && !onNew)}
          viewTransition
        >
          My shelf
        </NavLink>
        {isSignedIn && checksOn && (
          <NavLink
            to="/shelf?tab=new"
            onClick={() => leaveTabFor("shelf", currentTab, here)}
            data-tour="tab-new"
            className={() => barClass(onNew)}
            data-on={onNew || undefined}
            aria-label={newCount ? `New: ${newCount} series` : "New"}
            viewTransition
          >
            New
            {newCount > 0 && <span className={barCount}>{newCount}</span>}
          </NavLink>
        )}
        <NavLink
          {...barLink("prices")}
          data-tour="tab-prices"
          className={() => barClass(onPrices)}
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
