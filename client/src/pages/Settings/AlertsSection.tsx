// Settings, Account: alerts on this device. One switch, per device: the
// browser asks its own question only after it's tapped. On an iPhone in
// Safari, alerts only work in the installed app, so it says that, with the
// way to install. Nothing at all where alerts aren't set up (lib/alerts.ts).
import { useEffect, useState } from "react";
import { inApp } from "../../lib/inApp";
import InstallAppButton from "../../components/installApp/InstallAppButton";
import { alertsWay, switchAlertsOff, switchAlertsOn } from "../../lib/alerts";
import type { AlertsWay } from "../../lib/alertsWay";
import { settingsStyles as styles } from "./styles";
import { orOffline } from "../../lib/offline";

export function AlertsSection() {
  // null while it's being worked out
  const [way, setWay] = useState<AlertsWay | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; failed?: boolean } | null>(
    null,
  );
  useEffect(() => {
    void alertsWay().then(setWay);
  }, []);

  if (!way || way === "hidden") return null;

  const flip = async (on: boolean) => {
    setBusy(true);
    setNote(null);
    if (on) {
      const now = await switchAlertsOn();
      if (now === "failed") {
        setNote({
          text: orOffline("That didn't work. Try again."),
          failed: true,
        });
        setWay("off");
      } else {
        setWay(now);
        if (now === "on") setNote({ text: "On for this device." });
      }
    } else {
      await switchAlertsOff();
      setWay("off");
      setNote({ text: "Off for this device." });
    }
    setBusy(false);
  };

  return (
    <section className={styles.section} aria-labelledby="set-alerts">
      <h3 id="set-alerts" className={styles.heading}>
        Alerts on this device
      </h3>
      <p className={styles.body}>
        A volume for your shelf the day it's out, and price drops on your To buy
        list.
      </p>
      {way === "installFirst" && (
        <>
          <p className={styles.body}>
            On iPhone, alerts work in the app. Install it, open it, and switch
            them on there.
          </p>
          <div className={styles.actions}>
            <InstallAppButton className="btn btn-secondary">
              Install the app
            </InstallAppButton>
          </div>
        </>
      )}
      {way === "unsupported" && (
        <p className={styles.body}>This browser can't show alerts.</p>
      )}
      {way === "blocked" && (
        <>
          <p className={styles.body}>
            Alerts are blocked for Manga Tracker. To allow them:
          </p>
          {inApp() ? (
            <ul className={styles.plainList}>
              <li>Android: Settings, Apps, Manga Tracker, Notifications.</li>
              <li>iPhone: Settings, Notifications, Manga Tracker.</li>
            </ul>
          ) : (
            <ul className={styles.plainList}>
              <li>
                Chrome or Edge: the icon left of the address, then
                Notifications, Allow.
              </li>
              <li>Safari on a Mac: Settings, Websites, Notifications.</li>
              <li>
                The app on iPhone: Settings, Notifications, Manga Tracker.
              </li>
            </ul>
          )}
          <p className={styles.body}>Then come back here.</p>
        </>
      )}
      {(way === "on" || way === "off") && (
        <>
          <label className={styles.row}>
            <input
              type="checkbox"
              // an on/off setting: Android's switch in the app (index.css)
              className="app-switch"
              checked={way === "on"}
              disabled={busy}
              onChange={(e) => void flip(e.target.checked)}
            />
            Send alerts to this device
          </label>
          <div className={styles.actions}>
            <span
              className={note?.failed ? styles.failed : styles.saved}
              role="status"
            >
              {note?.text}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
