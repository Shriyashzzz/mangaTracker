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
            <button>Home</button>
          </li>
          <li>
            <button>About</button>
          </li>
          <li>
            <button>Sign In</button>
          </li>
        </ul>
      </header>
    </>
  );
}
