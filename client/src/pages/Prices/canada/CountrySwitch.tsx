// US or Canada, right where the prices are, for everyone: signed out it's kept
// in this browser, signed in it follows the account like any other setting
import { savePrefs, useCountry } from "../../../lib/prefs";
import { useAuth } from "../../../store/auth";

export type Country = "us" | "ca";

export default function CountrySwitch() {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const country = useCountry();
  return (
    <div
      className="inline-flex border-[1.5px] border-line text-[0.85rem]"
      role="group"
      aria-label="Prices from"
    >
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
          className="tap px-3 py-1 font-medium text-ink-soft aria-pressed:bg-ink aria-pressed:text-paper"
          onClick={() => savePrefs({ country: value }, isSignedIn)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
