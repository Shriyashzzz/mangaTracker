// US or Canada, in the same switch style as the price pages' sort, right where the prices are, for everyone: signed out it's kept
// in this browser, signed in it follows the account like any other setting
import { savePrefs, useCountry } from "../../../lib/prefs";
import { useAuth } from "../../../store/auth";
import { pricesStyles as styles } from "../styles";

export default function CountrySwitch() {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const country = useCountry();
  return (
    <div className={styles.segmented} role="group" aria-label="Prices from">
      {(
        [
          ["us", "US"],
          ["ca", "Canada"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={country === value}
          onClick={() => savePrefs({ country: value }, isSignedIn)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
