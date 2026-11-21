// the shelf's dropdown list: its heading, then the choices; a bottom sheet
// in the app (index.css .app-sheet). Used by SortMenu and Buy next's Got it
import type { ReactNode } from "react";
import { shelfBarStyles as styles } from "./shelfBarStyles";

export const Menu = ({
  label,
  alignRight,
  children,
}: {
  label: string;
  alignRight?: boolean;
  children: ReactNode;
}) => (
  <ul
    className={`${alignRight ? styles.menuRight : styles.menu} app-sheet`}
    aria-label={label}
  >
    <li className={styles.menuHead} aria-hidden>
      {label}
    </li>
    {children}
  </ul>
);
