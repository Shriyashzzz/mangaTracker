// "Show box sets": under a volume's price list when any box set holds it.
// On unless turned off; the choice is kept in this browser and, signed in,
// on the account (Settings → Prices has the same switch)
import { savePrefs, useBoxSetsShown } from "../../lib/prefs";
import { useAuth } from "../../store/auth";
import { pricesStyles as styles } from "./styles";

export default function BoxSetToggle({ count }: { count: number }) {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const shown = useBoxSetsShown();
  if (!count) return null;
  return (
    <label className={`tap ${styles.boxSetToggle}`}>
      <input
        type="checkbox"
        checked={shown}
        onChange={(e) =>
          savePrefs(
            { hideBoxSets: e.target.checked ? "no" : "yes" },
            isSignedIn,
          )
        }
      />
      Show box sets ({count})
    </label>
  );
}
