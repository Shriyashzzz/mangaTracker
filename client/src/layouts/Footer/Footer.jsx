import { NavLink } from "react-router";
import topIcon from "../../assets/topIcon.svg";
import styles from "./Footer.module.css";

// styled like the last page of a manga volume
export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.tbc}>To be continued…</p>

        <div className={styles.colophon}>
          <p>
            Drawn up by{" "}
            <a
              href="https://github.com/Shriyashzzz/mangaTracker"
              target="_blank"
              rel="noreferrer"
            >
              Shriyashzzz
            </a>
            , one late night at a time.
          </p>
          <p className={styles.top}>
            <img src={topIcon} alt="" />
            Made while learning through{" "}
            <a
              href="https://www.theodinproject.com/"
              target="_blank"
              rel="noreferrer"
            >
              The Odin Project
            </a>
          </p>
          <p className={styles.links}>
            <NavLink to="/about">About</NavLink>
            <span aria-hidden>·</span>
            <a
              href="https://github.com/Shriyashzzz/mangaTracker"
              target="_blank"
              rel="noreferrer"
            >
              Source
            </a>
            <span aria-hidden>·</span>
            <span>Vol. 1, {new Date().getFullYear()}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
