import styles from "./Header.module.css";
import appIcon from "../../assets/appIcon.png";
export default function Header() {
  return (
    <>
      <header className={styles.head}>
        <div className={styles.appName}>
          <img src={appIcon} alt="" /> <h2>Manga Tracker</h2>
        </div>

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
