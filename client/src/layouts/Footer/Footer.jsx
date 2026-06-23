import githubIcon from "../../assets/github.svg";
import topIcon from "../../assets/topIcon.png";

import styles from "./Footer.module.css";
export default function Footer() {
  return (
    <>
      <footer className={styles.footer}>
        <a
          className={styles.footerlink}
          href="https://github.com/Shriyashzzz/mangaTracker"
          target="_blank"
        >
          <img src={githubIcon} alt="github icon" className={styles.icon} />
          <p>Shriyashzzz</p>
        </a>
        <div className={styles.stackUsed}>
          <img src={topIcon} className={styles.topIcon} alt="" />
        </div>
      </footer>
    </>
  );
}
