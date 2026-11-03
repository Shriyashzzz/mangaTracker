// Everything about the account in one place, a tab at a time: tabs down the left
// on laptops, across the top on phones. Each tab has its own address, so the back
// gesture steps between them.
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, NavLink, useNavigate, useParams } from "react-router";
import {
  deleteAccount,
  SHELF_TABS,
  shelfToCsv,
  SORT_OPTIONS,
  type Account,
} from "../../lib/account";
import { apiFetch, signInPath } from "../../lib/api";
import {
  BACKGROUNDS,
  currentBackground,
  readLocal,
  useCountry,
  useReleaseChecksOn,
  savePrefs,
} from "../../lib/prefs";
import { usePrivatePage } from "../../lib/seo";
import type { Background, Manga, ShelfTab } from "../../lib/types";
import { useAccount } from "../../store/account";
import { useAuth } from "../../store/auth";
import ReleaseControls from "../NewReleases/ReleaseControls";
import ProfileTab from "./ProfileTab";
import { settingsStyles as styles } from "./styles";

const THEME_LABELS = {
  light: "Light",
  dark: "Dark",
  system: "Same as my device",
};

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "new-releases", label: "New releases" },
  { id: "shelf", label: "Your shelf" },
  { id: "prices", label: "Prices" },
  { id: "account", label: "Account" },
];

export default function SettingsPage() {
  usePrivatePage("Settings");
  const { tab = "profile" } = useParams();
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const navigate = useNavigate();
  const account = useAccount((s) => s.account);
  const loadFailed = useAccount((s) => s.loadFailed);
  const load = useAccount((s) => s.load);

  useEffect(() => {
    if (isSignedIn === false) {
      navigate(signInPath(`/settings/${tab}`), { replace: true });
    }
    if (isSignedIn) load();
  }, [isSignedIn, navigate, tab, load]);

  if (!TABS.some((t) => t.id === tab))
    return <Navigate to="/settings" replace />;

  if (!isSignedIn) {
    return (
      <div
        className={`skeleton ${styles.page} min-h-96`}
        aria-busy="true"
        aria-label="Loading"
      />
    );
  }

  const needsAccount = tab === "profile" || tab === "account";

  return (
    <article className={`${styles.page} fade-in`}>
      <h1 className={styles.title}>Settings</h1>
      <div className={styles.layout}>
        <nav className={styles.tabs} aria-label="Settings">
          {TABS.map((t) => (
            <NavLink
              key={t.id}
              to={`/settings/${t.id}`}
              className={t.id === tab ? styles.tabActive : styles.tab}
              aria-current={t.id === tab ? "page" : undefined}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.panel}>
          {needsAccount && !account ? (
            loadFailed ? (
              <p className={styles.failed} role="alert">
                Couldn't load your account. Refresh to try again.
              </p>
            ) : (
              <div
                className="skeleton min-h-80"
                aria-busy="true"
                aria-label="Loading"
              />
            )
          ) : (
            <>
              {tab === "profile" && account && <ProfileTab account={account} />}
              {tab === "appearance" && <AppearanceTab />}
              {tab === "new-releases" && <NewReleasesTab />}
              {tab === "shelf" && <ShelfSettingsTab />}
              {tab === "prices" && <PricesTab />}
              {tab === "account" && account && <AccountTab account={account} />}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function AppearanceTab() {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  // nothing saved means it follows the device
  const [theme, setTheme] = useState(() => readLocal("theme") ?? "system");
  const [background, setBackground] = useState(currentBackground);
  return (
    <div className={styles.tabBody}>
      <h2 className={styles.tabTitle}>Appearance</h2>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Theme</legend>
        {(["light", "dark", "system"] as const).map((value) => (
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
            {THEME_LABELS[value]}
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
    </div>
  );
}

function NewReleasesTab() {
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

function ShelfSettingsTab() {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const [shelfTab, setShelfTab] = useState(
    () => readLocal("shelfTab") ?? "all",
  );
  const [shelfSort, setShelfSort] = useState(
    () => readLocal("shelfSort") ?? "",
  );
  const [shelfView, setShelfView] = useState(
    () => readLocal("shelfView") ?? "covers",
  );
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
          {SHELF_TABS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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
    </div>
  );
}

function PricesTab() {
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

function AccountTab({ account }: { account: Account }) {
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
            For getting back into your account. Password resets aren't ready
            yet, so saving one here can't recover your account for now.
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
