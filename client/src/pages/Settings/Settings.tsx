// The private side of the account: how the site looks and behaves for them.
import { useEffect, useState, type FormEvent } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  deleteAccount,
  getAccount,
  saveAccount,
  SHELF_TABS,
  shelfToCsv,
  SORT_OPTIONS,
  type Account,
} from "../../lib/account";
import { apiFetch, signInPath } from "../../lib/api";
import {
  BACKGROUNDS,
  currentBackground,
  currentTheme,
  readLocal,
  savePrefs,
} from "../../lib/prefs";
import { usePrivatePage } from "../../lib/seo";
import type { Background, Manga, ShelfTab } from "../../lib/types";
import { useAuth } from "../../store/auth";
import ReleaseControls from "../NewReleases/ReleaseControls";
import { settingsStyles as styles } from "./styles";

export default function SettingsPage() {
  usePrivatePage("Settings");
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const logOut = useAuth((s) => s.logOut);
  const navigate = useNavigate();

  const [theme, setTheme] = useState(currentTheme);
  const [background, setBackground] = useState(currentBackground);
  const [hideEbooks, setHideEbooks] = useState(() => readLocal("hideEbooks") === "yes");
  const [shelfTab, setShelfTab] = useState(() => readLocal("shelfTab") ?? "all");
  const [shelfSort, setShelfSort] = useState(() => readLocal("shelfSort") ?? "");

  const [account, setAccount] = useState<Account | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [emailNote, setEmailNote] = useState<{ text: string; failed?: boolean } | null>(null);
  const [exportFailed, setExportFailed] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isSignedIn === false) navigate(signInPath("/settings"), { replace: true });
    if (!isSignedIn) return;
    const controller = new AbortController();
    getAccount(controller.signal)
      .then((found) => {
        setAccount(found);
        setEmail(found.recoveryEmail ?? "");
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLoadFailed(true);
      });
    return () => controller.abort();
  }, [isSignedIn, navigate]);

  if (!isSignedIn) {
    return <div className={`skeleton ${styles.page} min-h-96`} aria-busy="true" aria-label="Loading" />;
  }

  const saveEmail = async (e: FormEvent) => {
    e.preventDefault();
    setEmailNote(null);
    try {
      setAccount(await saveAccount({ recoveryEmail: email.trim() || null }));
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
      const url = URL.createObjectURL(
        new Blob([shelfToCsv(manga)], { type: "text/csv;charset=utf-8" }),
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
    <article className={`${styles.page} fade-in`}>
      <h1 className={styles.title}>Settings</h1>

      <section className={styles.section} aria-labelledby="set-look">
        <h2 id="set-look" className={styles.heading}>
          Appearance
        </h2>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Theme</legend>
          {(["light", "dark"] as const).map((value) => (
            <label key={value} className={styles.row}>
              <input
                type="radio"
                name="theme"
                checked={theme === value}
                onChange={() => {
                  setTheme(value);
                  savePrefs({ theme: value }, isSignedIn);
                }}
              />
              {value === "light" ? "Light" : "Dark"}
            </label>
          ))}
        </fieldset>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Background</legend>
          {BACKGROUNDS.map((b) => (
            <label key={b.id} className={styles.row}>
              <input
                type="radio"
                name="background"
                checked={background === b.id}
                onChange={() => {
                  setBackground(b.id as Background);
                  savePrefs({ background: b.id }, isSignedIn);
                }}
              />
              {b.label}
            </label>
          ))}
        </fieldset>
      </section>

      <section className={styles.section} aria-labelledby="set-new">
        <h2 id="set-new" className={styles.heading}>
          What shows up in New
        </h2>
        <p className={styles.body}>
          <NavLink to="/new-releases" className={styles.link} viewTransition>
            How this works
          </NavLink>
        </p>
        <ReleaseControls />
      </section>

      <section className={styles.section} aria-labelledby="set-shelf">
        <h2 id="set-shelf" className={styles.heading}>
          Your shelf
        </h2>
        <div className={styles.field}>
          <label htmlFor="shelf-tab">Opens on</label>
          <select
            id="shelf-tab"
            className={styles.select}
            value={shelfTab}
            onChange={(e) => {
              setShelfTab(e.target.value);
              savePrefs({ shelfTab: e.target.value as ShelfTab }, isSignedIn);
            }}
          >
            {SHELF_TABS.map((tab) => (
              <option key={tab.value} value={tab.value}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="shelf-sort">Sorted by</label>
          <select
            id="shelf-sort"
            className={styles.select}
            value={shelfSort}
            onChange={(e) => {
              setShelfSort(e.target.value);
              savePrefs({ shelfSort: e.target.value }, isSignedIn);
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="set-prices">
        <h2 id="set-prices" className={styles.heading}>
          Prices
        </h2>
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={hideEbooks}
            onChange={(e) => {
              setHideEbooks(e.target.checked);
              savePrefs({ hideEbooks: e.target.checked ? "yes" : "no" }, isSignedIn);
            }}
          />
          Hide ebooks on volume pages
        </label>
      </section>

      <section className={styles.section} aria-labelledby="set-account">
        <h2 id="set-account" className={styles.heading}>
          Account
        </h2>
        {account && (
          <p className={styles.body}>
            Signed in as <strong>{account.username}</strong>.
          </p>
        )}
        {loadFailed ? (
          <p className={styles.failed} role="alert">
            Couldn't load your account. Refresh to try again.
          </p>
        ) : (
          <form className={styles.field} onSubmit={saveEmail} noValidate>
            <label htmlFor="recovery-email">Recovery email (optional)</label>
            <input
              id="recovery-email"
              type="email"
              className={styles.input}
              value={email}
              autoComplete="email"
              disabled={!account}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className={styles.body}>
              For getting back into your account. Password resets aren't ready
              yet, so saving one here can't recover your account for now.
            </p>
            <div className={styles.actions}>
              <button type="submit" className="btn btn-secondary" disabled={!account}>
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
        )}
      </section>

      <section className={styles.section} aria-labelledby="set-export">
        <h2 id="set-export" className={styles.heading}>
          Export my list
        </h2>
        <p className={styles.body}>
          A spreadsheet file of everything on your shelf, notes included.
        </p>
        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={exportList}>
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
        <h2 id="set-delete" className={styles.heading}>
          Delete my account
        </h2>
        <p className={styles.body}>
          This removes your account and your whole shelf for good. There's no
          undo, so download your list first if you might want it.
        </p>
        {confirming ? (
          <form className={styles.field} onSubmit={confirmDelete}>
            <label htmlFor="delete-password">Enter your password to confirm</label>
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
    </article>
  );
}
