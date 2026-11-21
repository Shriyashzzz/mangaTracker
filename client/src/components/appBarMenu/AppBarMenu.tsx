// A screen's ⋮ menu in the app's top bar (layouts/header/Header.tsx keeps a
// spot for it at the far right, as Android apps do): what a screen does that
// isn't its main job, like a series' Edit details and Delete. The list is the
// shelf's own menu (pages/Home/Menu.tsx), a bottom sheet in the app. Shown
// only in the app; the website keeps its buttons
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MoreIcon } from "../icons/Icons";
import { inApp } from "../../lib/inApp";
import { Menu } from "../../pages/Home/Menu";
import { useMenu } from "../../pages/Home/useMenu";
import { shelfBarStyles as menuStyles } from "../../pages/Home/shelfBarStyles";

export type BarMenuItem = {
  label: string;
  onSelect: () => void;
  // a choice that takes something away ("Delete series"): in red
  danger?: boolean;
  disabled?: boolean;
};

// the top bar's spot (Header.tsx)
export const APP_BAR_SPOT = "app-bar-actions";

export default function AppBarMenu({
  label,
  items,
}: {
  // what the menu is about, for screen readers: "Vagabond"
  label: string;
  items: BarMenuItem[];
}) {
  const { open, setOpen, ref } = useMenu();
  // the spot is in the header, drawn before this screen
  const [spot, setSpot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setSpot(document.getElementById(APP_BAR_SPOT)),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  if (!inApp() || !spot) return null;
  return createPortal(
    <div ref={ref} className={menuStyles.sortWrap}>
      <button
        type="button"
        className="tap grid size-11 place-items-center"
        aria-label={`More for ${label}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <MoreIcon className="size-6" aria-hidden />
      </button>
      {open && (
        <Menu label={label} alignRight>
          {items.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                className={menuStyles.sortOption}
                // red for one that takes something away, over the
                // option's own ink
                style={item.danger ? { color: "var(--accent-ink)" } : undefined}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </Menu>
      )}
    </div>,
    spot,
  );
}
