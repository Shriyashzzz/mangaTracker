import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { CheckIcon, MenuIcon, MoonIcon, SunIcon } from "../icons/Icons";
import {
  BACKGROUNDS,
  currentBackground,
  currentTheme,
  savePrefs,
} from "../../lib/prefs";
import type { Background } from "../../lib/types";
import clsx from "clsx";

// one row of the menu: a button or link
const item =
  "flex min-h-10 w-full items-center gap-[0.65rem] rounded-[3px] px-[0.6rem] py-[0.35rem] text-left text-[0.95rem] text-ink-soft transition-[background-color,color] duration-120 ease-[ease] hover:bg-accent-wash hover:text-ink focus-visible:bg-accent-wash focus-visible:text-ink aria-pressed:font-semibold aria-pressed:text-ink [&>svg]:size-[17px] [&>svg]:shrink-0";

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

// one drop-down for the less-used bits of the header: background,
// light/dark, About, and logging out
type Props = {
  isSignedIn: boolean | null;
  onLogOut: () => void;
};

export default function SettingsMenu({ isSignedIn, onLogOut }: Props) {
  // remembers which page it was opened on, so changing page closes it
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [background, setBackground] = useState(currentBackground);
  const [theme, setTheme] = useState(currentTheme);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
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
      if (!wrapRef.current?.contains(e.target as Node)) close();
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
        className="icon-btn"
        aria-expanded={open}
        aria-controls="settings-menu"
        aria-label="Settings"
        title="Settings"
        onClick={toggle}
      >
        <MenuIcon />
      </button>

      {open && (
        // an inked panel hanging off the header rule
        <ul
          id="settings-menu"
          className="absolute top-[calc(100%+12px)] right-0 z-30 w-[236px] origin-top-right rounded-ink border-[2.5px] border-line bg-card p-[0.4rem] shadow-[0_14px_30px_-14px_rgba(20,14,8,0.45)] animate-drop motion-reduce:animate-none"
        >
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

          <li
            className="mx-[0.6rem] my-[0.35rem] h-0 border-t-[1.5px] border-dashed border-line-soft"
            aria-hidden
          />

          <li>
            <button className={item} onClick={flipTheme}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </li>
          <li>
            <NavLink to="/about" className={item} viewTransition>
              About
            </NavLink>
          </li>
          {isSignedIn && (
            <li>
              <button className={item} onClick={onLogOut}>
                Log out
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
