import styles from "./Mascot.module.css";

// Kenji, the app's chibi reader: a shonen-style boy in a hoodie with his
// nose in a manga (an original character, drawn here so it themes with the
// page). `mood` swaps the face and the little extras.
// moods: confused | panic | happy
export default function Mascot({ mood = "happy", className = "" }) {
  return (
    <svg
      className={`${styles.mascot} ${className}`}
      viewBox="0 0 140 160"
      aria-hidden
    >
      {/* hoodie, collar and drawstrings */}
      <path className={styles.skin} d="M34 158c2-24 16-36 36-36s34 12 36 36Z" />
      <path className={styles.line} d="M56 126l14 12 14-12" />
      <path className={styles.thin} d="M63 132v14M77 132v14" />

      {/* the manga volume being read */}
      <rect
        className={styles.book}
        x="44"
        y="118"
        width="52"
        height="36"
        rx="2"
        transform="rotate(-6 70 136)"
      />
      <path
        className={styles.ink}
        d="M70 121v31"
        transform="rotate(-6 70 136)"
      />

      {/* ears, then the head over them */}
      <circle className={styles.skin} cx="29" cy="78" r="7" />
      <circle className={styles.skin} cx="111" cy="78" r="7" />
      <circle className={styles.skin} cx="70" cy="70" r="42" />

      {/* short spiky shonen hair: spikes up top, a jagged fringe, short sides */}
      <path
        className={styles.hair}
        d="M28 70C24 46 34 30 46 26L40 9l18 13 4-18 12 16 12-14 2 18 16-10-6 18c12 8 16 22 14 38l-8-12-6 8-6-14-8 10-8-12-8 10-8-12-8 12-6-10-8 14Z"
      />

      {mood === "confused" && (
        <g>
          {/* one brow up, one down; one eye wide, one squinting */}
          <path className={styles.brow} d="M45 60q9-8 18-2" />
          <path className={styles.brow} d="M78 64l16-3" />
          <ellipse className={styles.eye} cx="54" cy="76" rx="7" ry="9" />
          <circle className={styles.shine} cx="56" cy="72" r="2.5" />
          <path className={styles.line} d="M80 76h14" />
          <path className={styles.line} d="M62 98c4-3 8 3 12 0s6 2 8 0" />
          <text className={styles.sfx} x="106" y="40">
            ?
          </text>
        </g>
      )}

      {mood === "panic" && (
        <g>
          {/* worried brows, spiral eyes, wobbly mouth, sweat drop */}
          <path className={styles.brow} d="M44 62l17-6" />
          <path className={styles.brow} d="M79 56l17 6" />
          <path
            className={styles.line}
            d="M54 76m-8 0a8 8 0 1 0 8-8a5 5 0 1 0 4 5"
          />
          <path
            className={styles.line}
            d="M86 76m-8 0a8 8 0 1 0 8-8a5 5 0 1 0 4 5"
          />
          <path
            className={styles.mouth}
            d="M58 100q4-6 8 0t8 0t8 0v6q-12 6-24 0Z"
          />
          <path
            className={styles.sweat}
            d="M112 54c4 6 6 10 6 13a6 6 0 0 1-12 0c0-3 2-7 6-13Z"
          />
          <text className={styles.sfx} x="10" y="40">
            !?
          </text>
        </g>
      )}

      {mood === "happy" && (
        <g>
          {/* raised brows, closed happy eyes, big grin, sparkles */}
          <path className={styles.brow} d="M44 64q9-6 18-1" />
          <path className={styles.brow} d="M78 63q9-5 18 1" />
          <path className={styles.line} d="M46 80q8-10 16 0" />
          <path className={styles.line} d="M78 80q8-10 16 0" />
          <path className={styles.mouth} d="M56 96h28q-2 14-14 14t-14-14Z" />
          <path
            className={styles.spark}
            d="M118 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"
          />
          <path
            className={styles.spark}
            d="M18 48l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"
          />
        </g>
      )}
    </svg>
  );
}
