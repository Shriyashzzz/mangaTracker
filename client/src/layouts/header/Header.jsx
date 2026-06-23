import styles from "./Header.module.css";
import appIcon from "../../assets/appIcon.png";
import { NavLink } from "react-router";

export default function Header() {
  return (
    <>
      <header className={styles.head}>
        <NavLink className={styles.appName} to="/" viewTransition>
          <img src={appIcon} alt="" /> <h2>Manga Tracker</h2>
        </NavLink>
        <ul>
          <li>
            {" "}
            <NavLink to="/" viewTransition>
              <button>Home</button>
            </NavLink>
          </li>
          <li>
            <NavLink to="/about" viewTransition>
              <button>About</button>
            </NavLink>
          </li>
          <li>
            <NavLink to="/signin" viewTransition>
              <button>Sign in</button>
            </NavLink>
          </li>
        </ul>
      </header>
    </>
  );
}
