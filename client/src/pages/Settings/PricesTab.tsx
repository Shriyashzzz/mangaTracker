// Settings, Prices: ebooks on volume pages, and the country they shop in.
import { useState } from "react";
import { readLocal, useCountry, savePrefs } from "../../lib/prefs";
import { useAuth } from "../../store/auth";
import { settingsStyles as styles } from "./styles";

export function PricesTab() {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const [hideEbooks, setHideEbooks] = useState(
    () => readLocal("hideEbooks") === "yes",
  );
  const country = useCountry();
  return (
    <div className={styles.tabBody}>
      <h2 className={styles.tabTitle}>Prices</h2>
      <label className={styles.row} data-tour="hide-ebooks">
        <input
          type="checkbox"
          checked={hideEbooks}
          onChange={(e) => {
            setHideEbooks(e.target.checked);
            savePrefs(
              { hideEbooks: e.target.checked ? "yes" : "no" },
              isSignedIn,
            );
          }}
        />
        Hide ebooks on volume pages
      </label>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Where you shop</legend>
        {(
          [
            ["us", "United States"],
            [
              "ca",
              "Canada: links to Amazon.ca, Indigo, eBay.ca and Walmart.ca",
            ],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className={styles.row}>
            <input
              type="radio"
              name="country"
              checked={country === value}
              onChange={() => savePrefs({ country: value }, isSignedIn)}
            />
            {label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
