// A short note pinned to the bottom of the screen, a link beside it: "Added
// vol. 2 of Blue Box to your shelf · See it". It goes after a few seconds,
// but not from under someone reading or tabbing to it, and can be swiped
// away. Drawn like the delete note (toastStyles.ts).
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSwipeAway } from "../../lib/useSwipeAway";
import { toastBox } from "./toastStyles";

const SHOWN_MS = 7000;

export default function Toast({
  children,
  onGone,
}: {
  children: ReactNode;
  onGone: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const swipe = useSwipeAway(onGone);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      timer = setTimeout(() => {
        const el = box.current;
        if (el?.matches(":hover") || el?.querySelector(":focus-visible"))
          wait();
        else onGone();
      }, SHOWN_MS);
    };
    wait();
    return () => clearTimeout(timer);
  }, [onGone]);
  return createPortal(
    <div role="status">
      <div ref={box} data-over-add-button {...swipe} className={toastBox}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
