import styles from "./Header.module.css";
import appIcon from "../../assets/appIcon.png";
import { NavLink, useNavigate } from "react-router";
import ThemeToggle from "../../components/themeToggle/ThemeToggle";
import { apiFetch } from "../../lib/api";

export default function Header({ isSignedIn, setIsSignedIn }) {
  const navigator = useNavigate();

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
          <img src={appIcon} alt="" />
          <span>Manga Tracker</span>
        </NavLink>

        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/" end className={navClass} viewTransition>
            {isSignedIn ? "Shelf" : "Home"}
          </NavLink>
          <NavLink to="/about" className={navClass} viewTransition>
            About
          </NavLink>
          {isSignedIn === false && (
            <NavLink to="/signin" className={navClass} viewTransition>
              Sign in
            </NavLink>
          )}
          {isSignedIn && (
            <button className={styles.navLink} onClick={sendLogOutSignal}>
              Log out
            </button>
          )}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
