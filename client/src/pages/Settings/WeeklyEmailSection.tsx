// Settings, New releases: the weekly email, on or off. Sent to the account's
// email (Settings, Account) once the link mailed to it is pressed
import { useState } from "react";
import type { Account } from "../../lib/account";
import { useAccount } from "../../store/account";
import { settingsStyles as styles } from "./styles";

// said when the confirm link was meant to go and didn't
const LINK_NOT_SENT = "We couldn't send the link. Try again in a minute.";

export function WeeklyEmailSection({ account }: { account: Account }) {
  const setWeeklyEmail = useAccount((s) => s.weeklyEmail);
  const [weeklyNote, setWeeklyNote] = useState<{
    text: string;
    failed?: boolean;
  } | null>(null);
  const [weeklySaving, setWeeklySaving] = useState(false);
  // on, off, or on again to mail the confirm link once more
  const switchWeekly = async (on: boolean, said: string) => {
    setWeeklyNote(null);
    setWeeklySaving(true);
    try {
      await setWeeklyEmail(on);
      // on, but the confirm link didn't go: said, never "check your inbox"
      if (useAccount.getState().account?.confirmNotSent)
        setWeeklyNote({ text: LINK_NOT_SENT, failed: true });
      else setWeeklyNote({ text: said });
    } catch (error) {
      setWeeklyNote({ text: (error as Error).message, failed: true });
    } finally {
      setWeeklySaving(false);
    }
  };
  // waiting for the address to be confirmed. Just now the link didn't go:
  // the note says that instead (the button to send it again stays)
  const waitingToConfirm =
    account.weeklyEmail && !account.emailConfirmed && !account.confirmNotSent;

  return (
    <section className={styles.section} aria-labelledby="set-weekly">
      <h3 id="set-weekly" className={styles.heading}>
        Weekly email
      </h3>
      <p className={styles.body}>
        New volumes for your shelf, and price drops on your To buy list. Only
        sent when there's news.
      </p>
      {account.recoveryEmail ? (
        <>
          <label className={styles.row}>
            <input
              type="checkbox"
              // an on/off setting: Android's switch in the app (index.css)
              className="app-switch"
              checked={account.weeklyEmail}
              disabled={weeklySaving}
              onChange={(e) =>
                switchWeekly(
                  e.target.checked,
                  e.target.checked
                    ? account.emailConfirmed
                      ? "It's on."
                      : "Check your inbox."
                    : "It's off.",
                )
              }
            />
            Send me the weekly email
          </label>
          {waitingToConfirm && (
            <p className={styles.body}>
              Almost there: press Start my weekly email in the email to{" "}
              <strong>{account.recoveryEmail}</strong>. No email? Send the link
              again.
            </p>
          )}
          {account.weeklyEmail && account.emailConfirmed && (
            <p className={styles.body}>
              Sent to <strong>{account.recoveryEmail}</strong>.
            </p>
          )}
          <div className={styles.actions}>
            {account.weeklyEmail && !account.emailConfirmed && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={weeklySaving}
                onClick={() => switchWeekly(true, "Sent again.")}
              >
                Send the link again
              </button>
            )}
            <span
              className={weeklyNote?.failed ? styles.failed : styles.saved}
              role="status"
            >
              {weeklyNote?.text}
            </span>
          </div>
        </>
      ) : (
        <p className={styles.body}>
          Save an email under Account to switch it on.
        </p>
      )}
    </section>
  );
}
