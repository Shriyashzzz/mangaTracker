import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { CheckIcon, MenuIcon, MoonIcon, SunIcon } from "../icons/Icons";
import {
  BACKGROUNDS,
  currentBackground,
  currentTheme,
  savePrefs,
} from "../../lib/prefs";
import styles from "./SettingsMenu.module.css";

// one drop-down for the less-used bits of the header: background,
// light/dark, About, and logging out
export default function SettingsMenu({ isSignedIn, onLogOut }) {
  // remembers which page it was opened on, so changing page closes it
  const [openOn, setOpenOn] = useState(null);
  const [background, setBackground] = useState(currentBackground);
  const [theme, setTheme] = useState(currentTheme);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
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
    const onPointer = (e) => {
      if (!wrapRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => {
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

  const pickBackground = (id) => {
    setBackground(id);
    savePrefs({ background: id }, isSignedIn);
  };

  const flipTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    savePrefs({ theme: next }, isSignedIn);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
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
        <ul id="settings-menu" className={styles.menu}>
          <li className={styles.group}>
            <p className={styles.groupLabel} id="bg-label">
              Background
            </p>
            <ul className={styles.backgrounds} aria-labelledby="bg-label">
              {BACKGROUNDS.map((b) => (
                <li key={b.id}>
                  <button
                    className={styles.item}
                    aria-pressed={background === b.id}
                    onClick={() => pickBackground(b.id)}
                  >
                    <span
                      className={`${styles.thumb} ${styles[b.id]}`}
                      aria-hidden
                    >
                      {b.id === "sfx" && "ド"}
                    </span>
                    {b.label}
                    {background === b.id && (
                      <CheckIcon className={styles.check} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </li>

          <li className={styles.rule} aria-hidden />

          <li>
            <button className={styles.item} onClick={flipTheme}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </li>
          <li>
            <NavLink to="/about" className={styles.item} viewTransition>
              About
            </NavLink>
          </li>
          {isSignedIn && (
            <li>
              <button className={styles.item} onClick={onLogOut}>
                Log out
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
