// The masthead: logo, the two halves of the app (My shelf, Prices; a bar along
// the bottom on phones, with New between them so what's out is a thumb away),
// and the settings menu. Sits on a newspaper-style double rule.
import { useEffect, useMemo } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import clsx from "clsx";
// same mark as the favicon: a manga volume in an inked panel
import logo from "../../assets/logo.svg";
import {
  BagIcon,
  BellIcon,
  PersonIcon,
  ShelfIcon,
  TagIcon,
} from "../../components/icons/Icons";
import SettingsMenu from "../../components/settingsMenu/SettingsMenu";
import { inApp, isTabScreen } from "../../lib/inApp";
import AppBackBar from "./AppBackBar";
import { useFromShelf } from "../../lib/fromShelf";
import { probablySignedIn, useAuth } from "../../store/auth";
import { useShelf } from "../../store/shelf";
import { loadToBuyOnce, useToBuy } from "../../store/toBuy";
import { isDemo } from "../../lib/demo";
import { readLocal, useReleaseChecksOn } from "../../lib/prefs";
import { LAST_NEW_COUNT_KEY } from "../../lib/shelf";
import { shownNewCount } from "../../lib/releaseMath";
import { editionReleases } from "../../lib/editionNews";
import { showOnIcon } from "../../lib/alerts";
import { offlineLink, useIsOffline } from "../../lib/offline";
import {
  forgetAllSpots,
  forgetSpot,
  leaveTabFor,
  leaveTabForTop,
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

// the To buy list's count, beside its link in the top bar: green, To buy's
// colour, a tally of the list. Red stays New's: something new to look at
const topCount =
  "ml-1.5 rounded-[3px] bg-ok px-1.5 font-mono text-[0.78rem] leading-[1.35] text-paper tabular-nums";

export default function Header() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  // opened from a card on the New tab: still part of what they were doing there
  const fromShelf = useFromShelf();
  const { isSignedIn, logOut } = useAuth();
  // prices and New need a connection: greyed out without one
  const offline = useIsOffline();
  const here = pathname + search;
  // the shelf's New view has its own place in the phones' bar
  const onNew =
    pathname === "/shelf" && new URLSearchParams(search).get("tab") === "new";
  // what NavLink called active for /shelf: the shelf and anything under it
  const onShelfPage = pathname === "/shelf" || pathname.startsWith("/shelf/");
  const checksOn = useReleaseChecksOn();
  const manga = useShelf((s) => s.manga);
  const releases = useShelf((s) => s.releases);
  const outcomes = useShelf((s) => s.outcomes);
  // the same count the shelf's New tab shows
  const newCount = useMemo(() => {
    const saved = readLocal(LAST_NEW_COUNT_KEY);
    return (
      shownNewCount(
        manga ?? [],
        // (a series collected as an edition is read in its books)
        editionReleases(manga ?? [], releases),
        outcomes,
        saved ? Number(saved) : null,
      ) ?? 0
    );
  }, [manga, releases, outcomes]);
  // the installed app's icon says it too (lib/alerts.ts)
  useEffect(() => {
    if (isSignedIn && !isDemo()) showOnIcon(newCount);
  }, [newCount, isSignedIn]);
  // the To buy list's link and count: signed-in readers only (the practice
  // tour has no list)
  const showToBuy = Boolean(isSignedIn) && !isDemo();
  const toBuyCount = useToBuy((s) => s.list?.items.length ?? 0);
  useEffect(() => {
    if (showToBuy) loadToBuyOnce();
  }, [showToBuy]);
  const onToBuy = pathname === "/to-buy";
  const toBuyLabel = toBuyCount ? `To buy: ${toBuyCount} volumes` : "To buy";
  const currentTab = fromShelf ? "shelf" : tabOf(pathname);
  // the home page anyone new sees is both halves of the app, so neither lights up
  const guestHome =
    pathname === "/" &&
    !search &&
    (isSignedIn === false || (isSignedIn === null && !probablySignedIn()));
  // A visitor without an account on someone's shared shelf gets no bottom
  // bar: "My shelf" there means nothing to them, and the page is its
  // owner's. The top bar's menu still has the way in
  const onSomeonesShelf =
    pathname.startsWith("/u/") &&
    (isSignedIn === false || (isSignedIn === null && !probablySignedIn()));
  // the price checker lives at "/", under /prices, at /series and /deals
  const onPrices =
    !fromShelf &&
    !guestHome &&
    (pathname === "/" ||
      pathname.startsWith("/prices") ||
      pathname.startsWith("/series") ||
      pathname.startsWith("/deals"));

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

  // My shelf in the phones' bar. From New, or back to a shelf last left on
  // New, it's the shelf itself (All), opened at its top
  const remembered = barLink("shelf");
  const toAll = onNew || /[?&]tab=new/.test(remembered.to);
  const shelfLink = toAll
    ? {
        to: "/shelf?tab=all",
        onClick: () => leaveTabForTop("shelf", currentTab, here),
      }
    : remembered;

  const handleLogOut = async () => {
    if (await logOut()) {
      forgetAllSpots();
      navigate("/", { viewTransition: true });
    }
  };

  // above the page and its floating add button, so the menu hanging off it
  // never ends up underneath them
  return (
    <header className="masthead relative z-30 border-b-[3px] border-double border-line bg-paper">
      <div className="px-gutter mx-auto flex h-[62px] max-w-page items-center gap-4">
        {/* in the app, a screen below the tabs: back and its name */}
        {inApp() && !isTabScreen(pathname) ? (
          <AppBackBar />
        ) : (
          // the shelf, signed in or not (signed out, it's what the site is
          // for, with the way to start one): "Prices" is the price search
          <NavLink
            to="/shelf"
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
        )}

        {/* phones have it at the bottom, within reach of a thumb */}
        <nav
          className="flex items-center gap-[1.4rem] upto-720:hidden"
          aria-label="Main"
        >
          {/* aria-current from the same test as the look: NavLink's own
              ignores the query and treats every /prices page as off */}
          <Link
            to="/shelf"
            className={linkClass(onShelfPage || fromShelf)}
            aria-current={onShelfPage || fromShelf ? "page" : undefined}
            viewTransition
          >
            My shelf
          </Link>
          <Link
            to="/"
            className={linkClass(onPrices)}
            aria-current={onPrices ? "page" : undefined}
            viewTransition
            {...offlineLink(offline)}
          >
            Prices
          </Link>
          {showToBuy && (
            <Link
              to="/to-buy"
              className={linkClass(onToBuy)}
              aria-current={onToBuy ? "page" : undefined}
              aria-label={toBuyLabel}
              viewTransition
              {...offlineLink(offline)}
            >
              To buy
              {toBuyCount > 0 && <span className={topCount}>{toBuyCount}</span>}
            </Link>
          )}
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

        {/* on a phone the top bar has no links: To buy sits beside the menu */}
        {showToBuy && (
          <Link
            to="/to-buy"
            className={clsx(
              "tap hidden min-h-11 min-w-11 items-center justify-center upto-720:flex",
              onToBuy ? "text-ink" : "text-ink-soft",
            )}
            aria-current={onToBuy ? "page" : undefined}
            aria-label={toBuyLabel}
            viewTransition
            {...offlineLink(offline)}
          >
            {/* a shopping bag stands for the words here: the bar is short on room */}
            <BagIcon className="size-[22px]" />
            {toBuyCount > 0 && <span className={topCount}>{toBuyCount}</span>}
          </Link>
        )}
        <SettingsMenu isSignedIn={isSignedIn} onLogOut={handleLogOut} />
      </div>

      {/* out of the way while the keyboard is up */}
      {!onSomeonesShelf && (
        <nav
          className="bottom-bar fixed inset-x-0 bottom-0 z-20 hidden border-t-[3px] border-double border-line bg-paper pb-[env(safe-area-inset-bottom)] upto-720:flex [body:has(input:focus,textarea:focus,select:focus)_&]:hidden!"
          aria-label="Main"
          // the tab of the screen already open: back to its top, as an
          // Android app's bar does, rather than the same screen again
          onClickCapture={(e) => {
            const link = (e.target as Element).closest("a");
            if (!link) return;
            const to = new URL(link.href);
            if (to.pathname + to.search !== pathname + search) return;
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <Link
            {...shelfLink}
            className={barClass(currentTab === "shelf" && !onNew)}
            aria-current={currentTab === "shelf" && !onNew ? "page" : undefined}
            viewTransition
          >
            <span className="bar-icon hidden">
              <ShelfIcon />
            </span>
            <span className="bar-label">My shelf</span>
          </Link>
          {isSignedIn && checksOn && (
            <Link
              to="/shelf?tab=new"
              onClick={() => leaveTabForTop("shelf", currentTab, here)}
              data-tour="tab-new"
              className={barClass(onNew)}
              aria-current={onNew ? "page" : undefined}
              data-on={onNew || undefined}
              aria-label={newCount ? `New: ${newCount} series` : "New"}
              viewTransition
              {...offlineLink(offline)}
            >
              <span className="bar-icon hidden">
                <BellIcon />
                {newCount > 0 && <span className="bar-badge">{newCount}</span>}
              </span>
              <span className="bar-label">New</span>
              {newCount > 0 && (
                <span className={`${barCount} bar-count`}>{newCount}</span>
              )}
            </Link>
          )}
          <Link
            {...barLink("prices")}
            className={barClass(onPrices)}
            aria-current={onPrices ? "page" : undefined}
            viewTransition
            {...offlineLink(offline)}
          >
            <span className="bar-icon hidden">
              <TagIcon />
            </span>
            <span className="bar-label">Prices</span>
          </Link>
          {isSignedIn === false && (
            <NavLink
              to="/signin"
              className={({ isActive }) => barClass(isActive)}
              viewTransition
            >
              <span className="bar-icon hidden">
                <PersonIcon />
              </span>
              <span className="bar-label">Sign in</span>
            </NavLink>
          )}
        </nav>
      )}
    </header>
  );
}
