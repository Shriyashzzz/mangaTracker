// Settings, Your shelf: covers or rows, how reading is tracked (by chapter,
// by volume, or both), and the tab and order the shelf opens on.
import { SortMenu } from "../Home/ShelfBar";
import { useState } from "react";
import { SHELF_TABS, SORT_OPTIONS } from "../../lib/account";
import type { ShelfSort } from "../../lib/shelf";
import {
  readLocal,
  shelfViewNow,
  savePrefs,
  useTrackBy,
} from "../../lib/prefs";
import type { ShelfTab } from "../../lib/types";
import { useAuth } from "../../store/auth";
import { settingsStyles as styles } from "./styles";

export function ShelfSettingsTab() {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const [shelfTab, setShelfTab] = useState(
    () => readLocal("shelfTab") ?? "all",
  );
  const [shelfSort, setShelfSort] = useState(
    () => readLocal("shelfSort") ?? "",
  );
  const [shelfView, setShelfView] = useState(() => shelfViewNow());
  const trackBy = useTrackBy();
  return (
    <div className={styles.tabBody}>
      <h2 className={styles.tabTitle}>Your shelf</h2>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Show manga as</legend>
        {(
          [
            ["covers", "Big covers"],
            ["rows", "Compact rows, so more fit on a screen"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={styles.row}
            data-tour={value === "rows" ? "view-rows" : undefined}
          >
            <input
              type="radio"
              name="shelf-view"
              checked={shelfView === value}
              onChange={() => {
                setShelfView(value);
                savePrefs({ shelfView: value }, isSignedIn);
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Track your reading by</legend>
        {(
          [
            ["series", "Let me choose for each series"],
            ["chapters", "Chapters only"],
            ["volumes", "Volumes only"],
            ["both", "Chapters and volumes together"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className={styles.row}>
            <input
              type="radio"
              name="track-by"
              checked={trackBy === value}
              onChange={() => savePrefs({ trackBy: value }, isSignedIn)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className={styles.field}>
        <label htmlFor="shelf-tab">First tab to open</label>
        <div className={styles.pick}>
          <SortMenu
            box
            id="shelf-tab"
            menuLabel="First tab to open"
            options={SHELF_TABS}
            sortBy={shelfTab as ShelfTab}
            onSort={(tab) => {
              setShelfTab(tab);
              savePrefs({ shelfTab: tab }, isSignedIn);
            }}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="shelf-sort">Sorted by</label>
        <div className={styles.pick}>
          <SortMenu
            box
            id="shelf-sort"
            menuLabel="Sorted by"
            options={SORT_OPTIONS}
            sortBy={shelfSort as ShelfSort}
            onSort={(sort) => {
              setShelfSort(sort);
              savePrefs({ shelfSort: sort }, isSignedIn);
            }}
          />
        </div>
      </div>
    </div>
  );
}
