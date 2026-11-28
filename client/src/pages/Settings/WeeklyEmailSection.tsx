// Settings, New releases: the weekly email, on or off. Sent to the account's
// email (Settings, Account) once the link mailed to it is pressed. With no
// email saved yet, the address is typed here and one button starts it all
import { useState, type FormEvent } from "react";
import type { Account } from "../../lib/account";
import { useAccount } from "../../store/account";
import { settingsStyles as styles } from "./styles";

// said when the confirm link was meant to go and didn't
const LINK_NOT_SENT = "We couldn't send the link. Try again in a minute.";

type WeeklyNote = { text: string; failed?: boolean } | null;

export function WeeklyEmailSection({ account }: { account: Account }) {
  const setWeeklyEmail = useAccount((s) => s.weeklyEmail);
  const [weeklyNote, setWeeklyNote] = useState<WeeklyNote>(null);
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
        <StartWeekly note={weeklyNote} onNote={setWeeklyNote} />
      )}
    </section>
  );
}

// no email saved yet: typed here, and one button saves it, switches the
// weekly email on and mails the confirm link. The note is the section's, so
// what happened is still said once the switch has taken this one's place
function StartWeekly({
  note,
  onNote,
}: {
  note: WeeklyNote;
  onNote: (note: WeeklyNote) => void;
}) {
  const startWeeklyEmail = useAccount((s) => s.startWeeklyEmail);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) {
      onNote({ text: "Type your email first.", failed: true });
      return;
    }
    onNote(null);
    setSaving(true);
    try {
      await startWeeklyEmail(address);
      if (useAccount.getState().account?.confirmNotSent)
        onNote({ text: LINK_NOT_SENT, failed: true });
    } catch (error) {
      onNote({ text: (error as Error).message, failed: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.field} onSubmit={start} noValidate>
      <label htmlFor="weekly-email">Your email</label>
      <input
        id="weekly-email"
        type="email"
        className={styles.input}
        value={email}
        autoComplete="email"
        placeholder="you@example.com"
        aria-invalid={note?.failed || undefined}
        onChange={(e) => setEmail(e.target.value)}
      />
      <p className={styles.body}>
        We'll send a link to check it's yours. Press it and the email starts.
      </p>
      <div className={styles.actions}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          Start my weekly email
        </button>
        <span
          className={note?.failed ? styles.failed : styles.saved}
          role="status"
        >
          {note?.text}
        </span>
      </div>
    </form>
  );
}
