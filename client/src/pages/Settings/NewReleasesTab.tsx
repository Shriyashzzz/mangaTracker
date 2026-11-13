// Settings, New releases: release checks on or off, and what the shelf's New
// tab lists (ReleaseControls).
import { NavLink } from "react-router";
import { useReleaseChecksOn, savePrefs } from "../../lib/prefs";
import { useAuth } from "../../store/auth";
import ReleaseControls from "../NewReleases/ReleaseControls";
import { settingsStyles as styles } from "./styles";

export function NewReleasesTab() {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const checksOn = useReleaseChecksOn();
  return (
    <div className={styles.tabBody}>
      <h2 className={styles.tabTitle}>New releases</h2>
      <label className={styles.row}>
        <input
          type="checkbox"
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
    </div>
  );
}
