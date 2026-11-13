// Settings, Appearance: the theme (light, dark, or the device's) and the
// page background. Each choice is saved the moment it's picked.
import { useState } from "react";
import {
  BACKGROUNDS,
  currentBackground,
  readLocal,
  savePrefs,
} from "../../lib/prefs";
import type { Background } from "../../lib/types";
import { useAuth } from "../../store/auth";
import { settingsStyles as styles } from "./styles";

const THEME_LABELS = {
  light: "Light",
  dark: "Dark",
  system: "Same as my device",
};

export function AppearanceTab() {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  // nothing saved means it follows the device
  const [theme, setTheme] = useState(() => readLocal("theme") ?? "system");
  const [background, setBackground] = useState(currentBackground);
  return (
    <div className={styles.tabBody}>
      <h2 className={styles.tabTitle}>Appearance</h2>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Theme</legend>
        {(["light", "dark", "system"] as const).map((value) => (
          <label key={value} className={styles.row}>
            <input
              type="radio"
              name="theme"
              checked={theme === value}
              onChange={() => {
                setTheme(value);
                savePrefs({ theme: value }, isSignedIn);
              }}
            />
            {THEME_LABELS[value]}
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Background</legend>
        {BACKGROUNDS.map((b) => (
          <label key={b.id} className={styles.row}>
            <input
              type="radio"
              name="background"
              checked={background === b.id}
              onChange={() => {
                setBackground(b.id as Background);
                savePrefs({ background: b.id }, isSignedIn);
              }}
            />
            {b.label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
