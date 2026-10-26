import styles from "../../styles/Auth.module.css";

// the illustrated half of the sign in / sign up spread
export default function AuthArt({ sfx, line, chapter }) {
  return (
    <div className={`${styles.art} printed`}>
      <div className={styles.speed} aria-hidden>
        {chapter && (
          <span className={styles.bigCh}>
            <small>ch.</small>
            {chapter}
          </span>
        )}
      </div>
      <span className={styles.sfx} aria-hidden>
        {sfx}
      </span>
      <p className={styles.bubble}>{line}</p>
    </div>
  );
}
