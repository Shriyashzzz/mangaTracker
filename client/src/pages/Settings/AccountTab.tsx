// Settings, Account: how they sign in (SignInSection), the email, the weekly
// email sent to it, a backup of the shelf to download, signing out, and
// deleting the account (which asks for the password, or for an account made
// with Google and no password, the username).
import type { OwnedBook } from "../../lib/books";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { deleteAccount, shelfToCsv, type Account } from "../../lib/account";
import { apiFetch, getJson } from "../../lib/api";
import type { Manga } from "../../lib/types";
import { useAccount } from "../../store/account";
import { useAuth } from "../../store/auth";
import { settingsStyles as styles } from "./styles";
import { AlertsSection } from "./AlertsSection";
import { SignInSection } from "./SignInSection";
import { orOffline } from "../../lib/offline";

// said when the confirm link was meant to go and didn't
const LINK_NOT_SENT = "We couldn't send the link. Try again in a minute.";

export function AccountTab({ account }: { account: Account }) {
  const logOut = useAuth((s) => s.logOut);
  const saveAccount = useAccount((s) => s.save);
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
  const navigate = useNavigate();
  const [email, setEmail] = useState(account.recoveryEmail ?? "");
  const [emailNote, setEmailNote] = useState<{
    text: string;
    failed?: boolean;
  } | null>(null);
  const [exportFailed, setExportFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const saveEmail = async (e: FormEvent) => {
    e.preventDefault();
    setEmailNote(null);
    try {
      await saveAccount({ recoveryEmail: email.trim() || null });
      setEmailNote({ text: email.trim() ? "Saved." : "Removed." });
      // a new address with the weekly email on: its confirm link didn't go
      if (useAccount.getState().account?.confirmNotSent)
        setWeeklyNote({ text: LINK_NOT_SENT, failed: true });
    } catch (error) {
      setEmailNote({ text: (error as Error).message, failed: true });
    }
  };

  const exportList = async () => {
    setExportFailed(false);
    try {
      const res = await apiFetch("/api/manga");
      if (!res.ok) throw new Error(res.statusText);
      const { manga } = (await res.json()) as { manga: Manga[] };
      // without them the backup is still whole in every other way
      const { books } = await getJson<{
        books: (OwnedBook & { mangaId: number })[];
      }>("/api/manga/books").catch(() => ({ books: [] }));
      const bySeries: Record<number, OwnedBook[]> = {};
      for (const book of books) (bySeries[book.mangaId] ??= []).push(book);
      const url = URL.createObjectURL(
        new Blob([shelfToCsv(manga, bySeries)], {
          type: "text/csv;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "manga-tracker-shelf.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportFailed(true);
    }
  };

  const confirmDelete = async (e: FormEvent) => {
    e.preventDefault();
    setDeleteError("");
    setDeleting(true);
    try {
      // what proves it's them: the password, or with none their username
      await deleteAccount(
        account.hasPassword ? { password } : { username: password },
      );
      // the session's gone already, so this only tidies up on this device
      await logOut();
      // the home page says it's done, so it doesn't end in silence
      navigate("/", {
        replace: true,
        viewTransition: true,
        state: { accountDeleted: true },
      });
    } catch (error) {
      setDeleteError((error as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className={styles.tabBody}>
      <h2 className={styles.tabTitle}>Account</h2>
      <p className={styles.body}>
        Signed in as <strong>{account.username}</strong>.
      </p>

      <SignInSection account={account} />

      <section className={styles.section} aria-labelledby="set-email">
        <h3 id="set-email" className={styles.heading}>
          Email
        </h3>
        <form className={styles.field} onSubmit={saveEmail} noValidate>
          <label htmlFor="recovery-email">Email (optional)</label>
          <input
            id="recovery-email"
            type="email"
            className={styles.input}
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className={styles.body}>
            For password resets and the weekly email.
          </p>
          <div className={styles.actions}>
            <button type="submit" className="btn btn-secondary">
              Save email
            </button>
            <span
              className={emailNote?.failed ? styles.failed : styles.saved}
              role="status"
            >
              {emailNote?.text}
            </span>
          </div>
        </form>
      </section>

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
                <strong>{account.recoveryEmail}</strong>. No email? Send the
                link again.
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
          <p className={styles.body}>Save an email above to switch it on.</p>
        )}
      </section>

      <AlertsSection />

      <section
        className={styles.section}
        aria-labelledby="set-export"
        data-tour="export"
      >
        <h3 id="set-export" className={styles.heading}>
          Export my list
        </h3>
        <p className={styles.body}>
          A spreadsheet file of everything on your shelf, notes included.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportList}
          >
            Download my list
          </button>
          {exportFailed && (
            <span className={styles.failed} role="alert">
              {orOffline("That didn't work. Try again.")}
            </span>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="set-delete">
        <h3 id="set-delete" className={styles.heading}>
          Delete my account
        </h3>
        <p className={styles.body}>
          This removes your account and your whole shelf for good. There's no
          undo, so download your list first if you might want it.
        </p>
        {confirming ? (
          <form className={styles.field} onSubmit={confirmDelete}>
            <label htmlFor="delete-password">
              {account.hasPassword
                ? "Enter your password to confirm"
                : `Type your username, ${account.username}, to confirm`}
            </label>
            <input
              id="delete-password"
              type={account.hasPassword ? "password" : "text"}
              className={styles.input}
              value={password}
              autoComplete={account.hasPassword ? "current-password" : "off"}
              autoFocus
              aria-invalid={Boolean(deleteError)}
              aria-describedby={deleteError ? "delete-error" : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            {deleteError && (
              <p id="delete-error" className={styles.failed} role="alert">
                {deleteError}
              </p>
            )}
            <div className={styles.actions}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={deleting || !password}
              >
                {deleting ? "Deleting…" : "Delete everything"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={deleting}
                onClick={() => {
                  setConfirming(false);
                  setPassword("");
                  setDeleteError("");
                }}
              >
                Keep my account
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirming(true)}
            >
              Delete my account
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
