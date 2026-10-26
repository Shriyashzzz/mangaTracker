import styles from "./Mascot.module.css";

// Shiori, the app's chibi reader (an original character, drawn here so it
// themes with the page). `mood` swaps the face and the little extras.
// moods: confused | panic | happy
export default function Mascot({ mood = "happy", className = "" }) {
  return (
    <svg
      className={`${styles.mascot} ${className}`}
      viewBox="0 0 140 160"
      aria-hidden
    >
      {/* body + the manga volume being read */}
      <path className={styles.skin} d="M34 158c2-24 16-36 36-36s34 12 36 36Z" />
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

      {/* head */}
      <circle className={styles.skin} cx="70" cy="70" r="42" />

      {/* spiky hair */}
      <path
        className={styles.hair}
        d="M27 72c-4-22 6-42 26-50 4-12 18-16 26-8 12-6 28 2 30 14 14 6 20 24 14 42-6-12-14-18-22-20 2 8 0 14-4 18-2-10-8-16-16-20-2 10-8 16-16 18 2-8 0-14-4-18-8 6-12 14-14 24-4-6-6-12-6-18-6 4-10 10-14 18Z"
      />

      {/* cheeks */}
      <ellipse className={styles.blush} cx="44" cy="88" rx="7" ry="4" />
      <ellipse className={styles.blush} cx="96" cy="88" rx="7" ry="4" />

      {mood === "confused" && (
        <g>
          {/* one eye wide, one squinting */}
          <ellipse className={styles.eye} cx="54" cy="76" rx="7" ry="9" />
          <circle className={styles.shine} cx="56" cy="72" r="2.5" />
          <path className={styles.line} d="M80 76h14" />
          <path className={styles.line} d="M62 98c4-3 8 3 12 0s6 2 8 0" />
          <text className={styles.sfx} x="104" y="34">
            ?
          </text>
        </g>
      )}

      {mood === "panic" && (
        <g>
          {/* spiral eyes, wobbly mouth, sweat drop */}
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
            d="M110 52c4 6 6 10 6 13a6 6 0 0 1-12 0c0-3 2-7 6-13Z"
          />
          <text className={styles.sfx} x="14" y="36">
            !?
          </text>
        </g>
      )}

      {mood === "happy" && (
        <g>
          {/* closed happy eyes, big grin, sparkles */}
          <path className={styles.line} d="M46 80q8-10 16 0" />
          <path className={styles.line} d="M78 80q8-10 16 0" />
          <path className={styles.mouth} d="M56 96h28q-2 14-14 14t-14-14Z" />
          <path
            className={styles.spark}
            d="M114 28l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"
          />
          <path
            className={styles.spark}
            d="M22 46l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"
          />
        </g>
      )}
    </svg>
  );
}
