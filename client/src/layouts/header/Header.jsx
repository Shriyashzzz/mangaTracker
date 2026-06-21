import styles from "./Header.module.css";
import appIcon from "../../assets/appIcon.png";
import { NavLink } from "react-router";

export default function Header() {
  return (
    <>
      <header className={styles.head}>
        <NavLink className={styles.appName} to="/">
          <img src={appIcon} alt="" /> <h2>Manga Tracker</h2>
        </NavLink>
        <ul>
          <li>
            {" "}
            <NavLink to="/">
              <button>Home</button>
            </NavLink>
          </li>
          <li>
            <NavLink to="/">
              <button>About</button>
            </NavLink>
          </li>
          <li>
            <NavLink to="/">
              <button>Sign in</button>
            </NavLink>
          </li>
        </ul>
      </header>
    </>
  );
}
