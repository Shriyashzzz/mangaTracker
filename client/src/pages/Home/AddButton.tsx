import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PlusIcon } from "../../components/icons/Icons";
import { homeStyles as styles } from "./styles";

// The round + on small screens, within reach of a thumb. It slides away while
// they scroll down the shelf, so it doesn't sit over the covers they're
// reading, and is back as soon as they scroll up or stop. In a portal: the
// page's fade-in would otherwise pin it to the page, not the screen
const ADD_BACK_AFTER_MS = 700;
export default function AddButton({ onClick }: { onClick: () => void }) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > last + 4 && y > 120) setAway(true);
      else if (y < last - 4) setAway(false);
      last = y;
      clearTimeout(timer);
      timer = setTimeout(() => setAway(false), ADD_BACK_AFTER_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return createPortal(
    <button
      type="button"
      className={`${styles.addButton}${away ? ` ${styles.addButtonAway}` : ""}`}
      aria-label="Add manga"
      data-tour="add"
      onClick={onClick}
    >
      <PlusIcon aria-hidden />
    </button>,
    document.body,
  );
}
