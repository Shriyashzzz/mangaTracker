import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PlusIcon } from "../../components/icons/Icons";
import { homeStyles as styles } from "./styles";

// The round + on small screens, within reach of a thumb. It slides away while
// they scroll down the shelf and stays away, so it doesn't sit over the
// covers and labels they're reading (coming back when they stopped left it
// over a card's line). It's back as soon as they scroll up, or near the top.
// In a portal: the page's fade-in would otherwise pin it to the page, not
// the screen
const NEAR_THE_TOP = 120;
export default function AddButton({ onClick }: { onClick: () => void }) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > last + 4 && y > NEAR_THE_TOP) setAway(true);
      else if (y < last - 4 || y <= NEAR_THE_TOP) setAway(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return createPortal(
    <button
      type="button"
      className={`${styles.addButton}${away ? ` ${styles.addButtonAway}` : ""}`}
      aria-label="Add manga"
      data-tour="scan"
      onClick={onClick}
    >
      <PlusIcon aria-hidden />
    </button>,
    document.body,
  );
}
