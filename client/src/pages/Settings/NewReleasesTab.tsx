// Settings, New releases: release checks on or off, what the shelf's New
// tab lists (ReleaseControls), alerts on this device (AlertsSection), and
// the weekly email (WeeklyEmailSection).
import { NavLink } from "react-router";
import { useReleaseChecksOn, savePrefs } from "../../lib/prefs";
import { useAccount } from "../../store/account";
import { useAuth } from "../../store/auth";
import ReleaseControls from "../NewReleases/ReleaseControls";
import { AlertsSection } from "./AlertsSection";
import { settingsStyles as styles } from "./styles";
import { WeeklyEmailSection } from "./WeeklyEmailSection";

export function NewReleasesTab() {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const checksOn = useReleaseChecksOn();
  // signed in: their account, for the weekly email
  const account = useAccount((s) => s.account);
  return (
    <div className={styles.tabBody}>
      <h2 className={styles.tabTitle}>New releases</h2>
      <label className={styles.row}>
        <input
          type="checkbox"
          // an on/off setting: Android's switch in the app (index.css)
          className="app-switch"
          checked={checksOn}
          onChange={(e) =>
            savePrefs(
              { releaseChecks: e.target.checked ? "on" : "off" },
              isSignedIn,
            )
          }
        />
        Check for new volumes and chapters
      </label>
      {checksOn ? (
        <>
          <p className={styles.body}>
            What your shelf's New tab lists.{" "}
            <NavLink
              to="/new-releases"
              className={`tap ${styles.link}`}
              viewTransition
            >
              How this works
            </NavLink>
          </p>
          <ReleaseControls />
        </>
      ) : (
        <p className={styles.body}>
          Off. Your shelf has no New tab, and manga pages don't show new
          releases or next chapter dates. Prices still work.
        </p>
      )}
      {/* how they're told, on this device and by email, beside what
          they're told about */}
      {account && <AlertsSection />}
      {account && <WeeklyEmailSection account={account} />}
    </div>
  );
}
