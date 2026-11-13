// Settings, Account: the recovery email, a backup of the shelf to download,
// signing out, and deleting the account (which asks for the password).
import type { OwnedBook } from "../../lib/books";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { deleteAccount, shelfToCsv, type Account } from "../../lib/account";
import { apiFetch, getJson } from "../../lib/api";
import type { Manga } from "../../lib/types";
import { useAccount } from "../../store/account";
import { useAuth } from "../../store/auth";
import { settingsStyles as styles } from "./styles";

export function AccountTab({ account }: { account: Account }) {
  const logOut = useAuth((s) => s.logOut);
  const saveAccount = useAccount((s) => s.save);
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
      await deleteAccount(password);
      // the session's gone already, so this only tidies up on this device
      await logOut();
      navigate("/", { replace: true, viewTransition: true });
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

      <section className={styles.section} aria-labelledby="set-email">
        <h3 id="set-email" className={styles.heading}>
          Recovery email
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
            Not used yet. When password resets arrive, they'll be sent here.
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

      <section className={styles.section} aria-labelledby="set-export">
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
              That didn't work. Try again.
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
              Enter your password to confirm
            </label>
            <input
              id="delete-password"
              type="password"
              className={styles.input}
              value={password}
              autoComplete="current-password"
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
