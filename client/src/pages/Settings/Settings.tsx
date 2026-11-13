// Everything about the account in one place, a tab at a time: tabs down the left
// on laptops, across the top on phones. Each tab has its own address, so the back
// gesture steps between them.
import { useEffect } from "react";
import { Navigate, NavLink, useNavigate, useParams } from "react-router";
import { signInPath } from "../../lib/api";
import { usePrivatePage } from "../../lib/seo";
import { useAccount } from "../../store/account";
import { useAuth } from "../../store/auth";
import ProfileTab from "./ProfileTab";
import { AppearanceTab } from "./AppearanceTab";
import { NewReleasesTab } from "./NewReleasesTab";
import { ShelfSettingsTab } from "./ShelfSettingsTab";
import { PricesTab } from "./PricesTab";
import { AccountTab } from "./AccountTab";
import { settingsStyles as styles } from "./styles";

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
