// Comparing shelves, for a visitor without an account: a note in the hand
// face with a small stamp of a button, in one spot that never moves. What
// it says follows what they've done:
//
//   not comparing      "Have some of these too?"     [Compare shelves]
//   comparing, none    "Tap “I have this” on yours"  [Done]
//   comparing, some    "You have 3 of these"         [Start my shelf]  Not now
//
// (It used to be a line here and a box above the tabs that appeared when
// the line was pressed: one popped in as the other went.)
//
// It's drawn in two places and shown in one: at the right of the tabs on a
// laptop, where the row has room to spare, and under the search on a
// narrower screen (`where` picks which).
import { NavLink } from "react-router";
import { shareStyles as styles } from "./styles";

// the arrow from the note to its button
const Arrow = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 40 20" fill="none" aria-hidden>
    {/* a curve to the tip, then the head's two barbs back from it */}
    <path
      d="M2 12c8-8 20-9 31-2M33 10l-3.4-6.1M33 10l-7-.6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function CompareNote({
  where,
  isComparing,
  have,
  signUpPath,
  onCompare,
  onStop,
}: {
  where: "tabs" | "tools";
  // they've pressed "Compare shelves": rows have "I have this"
  isComparing: boolean;
  // how many of this shelf's series they've marked as theirs too
  have: number;
  // where "Start my shelf" goes: sign-up, then back to this shelf
  signUpPath: string;
  onCompare: () => void;
  onStop: () => void;
}) {
  const place =
    where === "tabs" ? styles.compareNoteInTabs : styles.compareNoteInTools;

  if (!isComparing)
    return (
      <p className={place}>
        <span className={styles.compareAsk}>Have some of these too?</span>
        <Arrow className={styles.compareArrow} />
        <button
          type="button"
          className={styles.compareStamp}
          onClick={onCompare}
        >
          Compare shelves
        </button>
      </p>
    );

  if (have === 0)
    return (
      <p className={place}>
        <span className={styles.compareAsk}>Tap “I have this” on yours</span>
        <button type="button" className={styles.compareStamp} onClick={onStop}>
          Done
        </button>
      </p>
    );

  return (
    <p className={place}>
      <span className={styles.compareAsk}>You have {have} of these</span>
      <Arrow className={styles.compareArrowWide} />
      <NavLink to={signUpPath} className={styles.compareStampGo} viewTransition>
        Start my shelf
      </NavLink>
      <button type="button" className={styles.compareStop} onClick={onStop}>
        Not now
      </button>
    </p>
  );
}
