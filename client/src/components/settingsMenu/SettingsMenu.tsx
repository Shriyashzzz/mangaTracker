import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import {
  CheckIcon,
  ChevronRightIcon,
  CoffeeIcon,
  ImportIcon,
  InfoIcon,
  MoonIcon,
  SettingsIcon,
  ShareIcon,
  SignOutIcon,
  SunIcon,
  TagIcon,
} from "../icons/Icons";
import { SUPPORT_URL, stopAsking } from "../../lib/support";
import {
  BACKGROUNDS,
  currentBackground,
  currentTheme,
  savePrefs,
  useCountry,
} from "../../lib/prefs";
import type { Background } from "../../lib/types";
import clsx from "clsx";
import Avatar from "../avatar/Avatar";
import { useAccount } from "../../store/account";

// one row of the menu: a button or link
const item =
  "flex min-h-11 w-full items-center gap-[0.65rem] rounded-[3px] px-[0.6rem] py-[0.35rem] text-left text-[0.95rem] text-ink-soft transition-[background-color,color] duration-120 ease-[ease] hover:bg-accent-wash hover:text-ink focus-visible:bg-accent-wash focus-visible:text-ink aria-pressed:font-semibold aria-pressed:text-ink [&>svg]:size-[17px] [&>svg]:shrink-0";

// each background in miniature
const thumb =
  "relative grid h-6 w-[34px] shrink-0 place-items-center overflow-hidden rounded-[2px] border-[1.5px] border-line bg-paper";
const THUMBS: Record<Background, string> = {
  // the giant sound effect, outlined
  sfx: "font-['Dela_Gothic_One','Hiragino_Sans',sans-serif] text-[15px] leading-none text-transparent [-webkit-text-stroke:1px_var(--ink-soft)]",
  // a dry-brush ensō, half out of frame
  ink: "before:absolute before:-top-1.5 before:-left-3 before:size-[30px] before:-rotate-20 before:rounded-full before:border-5 before:border-ink before:border-r-transparent before:opacity-55",
  // two sheets of paper, one askew
  pages:
    "bg-paper-2 before:absolute before:inset-x-1.5 before:inset-y-1 before:-rotate-8 before:border before:border-line-soft before:bg-card after:absolute after:inset-x-1.5 after:inset-y-1 after:border after:border-line-soft after:bg-card",
  // slanted panel gutters over a tone
  panels:
    "bg-[linear-gradient(100deg,var(--paper-2)_44%,var(--card)_44%_52%,transparent_52%),repeating-linear-gradient(-45deg,var(--line-soft)_0_1px,var(--paper)_1px_4px)]",
};

const THEME_BUTTON = "menu-theme-button";

// a dashed rule between groups of the menu
const divider = (
  <li
    className="mx-[0.6rem] my-[0.35rem] h-0 border-t-[1.5px] border-dashed border-line-soft"
    aria-hidden
  />
);

// the signed-in head of the menu: their picture, name and settings
const profileRow =
  "flex w-full items-center gap-3 rounded-[3px] px-[0.6rem] py-[0.5rem] transition-colors duration-120 hover:bg-accent-wash focus-visible:bg-accent-wash";

const styles_guestMenu =
  "tap flex items-center gap-1.5 text-[0.95rem] text-ink-soft transition-colors duration-150 hover:text-ink [&_svg]:size-5";

// one drop-down for the less-used bits of the header: light/dark, About and, signed
// in, profile, settings and logging out. Guests have no settings page, so they
// pick their background here
type Props = {
  isSignedIn: boolean | null;
  onLogOut: () => void;
};

export default function SettingsMenu({ isSignedIn, onLogOut }: Props) {
  const avatar = useAccount((s) => s.account?.avatar);
  const name = useAccount(
    (s) => s.account?.displayName || s.account?.defaultName,
  );
  const loadAccount = useAccount((s) => s.load);
  const clearAccount = useAccount((s) => s.clear);
  // the button is their picture, so it needs the account from the start
  useEffect(() => {
    if (isSignedIn) loadAccount();
    else if (isSignedIn === false) clearAccount();
  }, [isSignedIn, loadAccount, clearAccount]);
  // remembers which page it was opened on, so changing page closes it
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [background, setBackground] = useState(currentBackground);
  const [theme, setTheme] = useState(currentTheme);
  const country = useCountry();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  // gone once the page changes, so coming back doesn't find it still open
  if (openOn && openOn !== pathname) setOpenOn(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);

  // the account's preferences can arrive after sign in, so re-read on open
  const toggle = () => {
    if (!open) {
      setBackground(currentBackground());
      setTheme(currentTheme());
    }
    setOpenOn(open ? null : pathname);
  };

  // close on a click outside or Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      // the tour opens it to point inside, and closes it when the step ends. A
      // tap on Kenji closing it first moves him out from under their finger
      const onTour = (e.target as Element | null)?.closest?.(
        ".tour-bubble, .tour-dock",
      );
      if (!onTour && !wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickBackground = (id: Background) => {
    setBackground(id);
    savePrefs({ background: id }, isSignedIn);
  };

  const flipTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    savePrefs({ theme: next }, isSignedIn);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={buttonRef}
        className={isSignedIn ? "tap rounded-full" : styles_guestMenu}
        aria-expanded={open}
        aria-controls="settings-menu"
        aria-label="Menu"
        data-tour="menu"
        title="Menu"
        onClick={toggle}
      >
        {isSignedIn ? (
          <Avatar id={avatar} className="w-9" />
        ) : (
          <>
            <SettingsIcon />
            Menu
          </>
        )}
      </button>

      {open && (
        // an inked panel hanging off the header rule
        <ul
          id="settings-menu"
          // choosing anything closes it, except light/dark: there the change
          // shows right away, and people may want to flip it back
          onClick={(e) => {
            const choice = (e.target as HTMLElement).closest("a, button");
            if (
              choice &&
              choice.id !== THEME_BUTTON &&
              !choice.closest("[data-keep-open]")
            ) {
              close();
            }
          }}
          className="absolute top-[calc(100%+12px)] right-0 z-30 w-[236px] origin-top-right rounded-ink border-[2.5px] border-line bg-card p-[0.4rem] shadow-[0_14px_30px_-14px_rgba(20,14,8,0.45)] animate-drop motion-reduce:animate-none"
        >
          {/* signed in, this lives on the settings page with everything else */}
          {!isSignedIn && (
            <>
              <li className="pb-[0.15rem]">
                <p
                  className="px-[0.6rem] pt-[0.4rem] pb-[0.3rem] font-brand text-[1.05rem] leading-none tracking-[0.04em]"
                  id="bg-label"
                >
                  Background
                </p>
                <ul aria-labelledby="bg-label">
                  {BACKGROUNDS.map((b) => (
                    <li key={b.id}>
                      <button
                        className={item}
                        aria-pressed={background === b.id}
                        onClick={() => pickBackground(b.id)}
                      >
                        <span className={clsx(thumb, THUMBS[b.id])} aria-hidden>
                          {b.id === "sfx" && "ド"}
                        </span>
                        {b.label}
                        {background === b.id && (
                          <CheckIcon className="ml-auto text-accent" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>

              {divider}
            </>
          )}

          {/* who's signed in, and the way to everything about them */}
          {isSignedIn && (
            <>
              <li>
                <NavLink to="/settings" className={profileRow} viewTransition>
                  <Avatar id={avatar} className="w-10 shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-ink">
                      {name ?? "Your profile"}
                    </span>
                    <span className="text-[0.82rem] text-ink-soft">
                      Profile and settings
                    </span>
                  </span>
                  <ChevronRightIcon className="ml-auto size-4 shrink-0 text-ink-soft" />
                </NavLink>
              </li>
              {divider}
              <li>
                <NavLink
                  to="/settings/profile#share"
                  className={item}
                  viewTransition
                >
                  <ShareIcon />
                  Share my list
                </NavLink>
              </li>
              {/* laptops have this one on the shelf */}
              <li className="hidden upto-720:block">
                <NavLink
                  to="/import"
                  className={item}
                  // the tour opens this menu on phones and points here
                  data-tour="import-link"
                  viewTransition
                >
                  <ImportIcon />
                  Import your list
                </NavLink>
              </li>
              {divider}
            </>
          )}

          <li>
            <button id={THEME_BUTTON} className={item} onClick={flipTheme}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </li>
          {/* where prices come from; stays open, like light/dark */}
          <li>
            <button
              type="button"
              className={item}
              data-keep-open
              aria-pressed={country === "ca"}
              onClick={() =>
                savePrefs(
                  { country: country === "ca" ? "us" : "ca" },
                  isSignedIn,
                )
              }
            >
              <TagIcon />
              Canadian prices
              {country === "ca" && (
                <CheckIcon className="ml-auto text-accent" />
              )}
            </button>
          </li>
          {divider}
          <li>
            <NavLink to="/about" className={item} viewTransition>
              <InfoIcon />
              About
            </NavLink>
          </li>
          <li>
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noreferrer"
              className={item}
              onClick={stopAsking}
            >
              <CoffeeIcon />
              Support me
            </a>
          </li>
          {isSignedIn && (
            <>
              {divider}
              <li>
                <button className={item} onClick={onLogOut}>
                  <SignOutIcon />
                  Sign out
                </button>
              </li>
            </>
          )}
        </ul>
      )}
    </div>
  );
}
