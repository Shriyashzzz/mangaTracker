import { authStyles as styles } from "../../styles/auth";

// the illustrated half of the sign in / sign up spread
type Props = {
  // the big sound effect lettered across the panel
  sfx: string;
  // what the speech bubble says
  line: string;
  // a chapter number drawn in the speed lines, if any. Without one the
  // sound effect sits there instead (on laptops)
  chapter?: string | number;
};

export default function AuthArt({ sfx, line, chapter }: Props) {
  return (
    <div className={`${styles.art} printed`}>
      <div className={styles.speed} aria-hidden>
        {chapter ? (
          <span className={styles.bigCh}>
            <small>ch.</small>
            {chapter}
          </span>
        ) : (
          // no chapter number: on laptops the sound effect takes its place,
          // in the middle of the lines
          <span className={styles.sfxMiddle}>{sfx}</span>
        )}
      </div>
      <span className={chapter ? styles.sfx : styles.sfxPhone} aria-hidden>
        {sfx}
      </span>
      <p className={styles.bubble}>{line}</p>
    </div>
  );
}
