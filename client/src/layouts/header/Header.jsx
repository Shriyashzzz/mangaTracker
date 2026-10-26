import styles from "./Header.module.css";
// same mark as the favicon: a manga volume in an inked panel
import logo from "../../assets/logo.svg";
import { NavLink, useLocation, useNavigate } from "react-router";
import SettingsMenu from "../../components/settingsMenu/SettingsMenu";
import { apiFetch } from "../../lib/api";

export default function Header({ isSignedIn, setIsSignedIn }) {
  const navigator = useNavigate();
  const { pathname } = useLocation();
  const onPrices = pathname === "/" || pathname.startsWith("/prices");

  const sendLogOutSignal = async () => {
    const response = await apiFetch("/logout");
    if (response.status == 200) {
      setIsSignedIn(false);
      navigator("/", { viewTransition: true });
    } else {
      setIsSignedIn(true);
    }
  };

  const navClass = ({ isActive }) =>
    isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;

  return (
    <header className={styles.head}>
      <div className={styles.inner}>
        <NavLink className={styles.appName} to="/" viewTransition>
          <img src={logo} alt="" />
          <span>Manga Tracker</span>
        </NavLink>

        <nav className={styles.nav} aria-label="Main">
          <NavLink
            to="/"
            className={() => navClass({ isActive: onPrices })}
            viewTransition
          >
            Prices
          </NavLink>
          <NavLink to="/shelf" className={navClass} viewTransition>
            My shelf
          </NavLink>
          {isSignedIn === false && (
            <NavLink to="/signin" className={navClass} viewTransition>
              Sign in
            </NavLink>
          )}
        </nav>

        <SettingsMenu isSignedIn={isSignedIn} onLogOut={sendLogOutSignal} />
      </div>
    </header>
  );
}
