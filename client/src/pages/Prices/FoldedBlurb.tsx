import { useLayoutEffect, useRef, useState } from "react";
import { pricesStyles as styles } from "./styles";

// A description folded to three lines, "… Read more" right after the last
// word that fits, as the app has it: never across a gap at the line's end
// when the third line is a short one. Opened, "Show less" follows the text.
// For a series' blurb (SeriesFacts) and a volume's (VolumeFacts)
const LINES = 3;

export default function FoldedBlurb({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // how much of the text fits with "… Read more" after it, at this width
  const [fits, setFits] = useState<{ text: string; length: number } | null>(
    null,
  );
  const measure = useRef<HTMLParagraphElement>(null);
  const long = text.length > 320;
  const folded = long && !expanded;

  useLayoutEffect(() => {
    const box = measure.current;
    if (!folded || !box) return;
    const fit = () => setFits({ text, length: fittingLength(box, text) });
    fit();
    // a new width (a turned phone, a resized window) fits more or less
    const watch = new ResizeObserver(fit);
    watch.observe(box);
    return () => watch.disconnect();
  }, [folded, text]);

  if (!long) return <p className={styles.blurb}>{text}</p>;
  const toggle = (
    <button
      type="button"
      className={folded ? styles.readMore : styles.textBtn}
      aria-expanded={expanded}
      onClick={() => setExpanded((e) => !e)}
    >
      {folded ? (
        <>
          <span aria-hidden="true">… </span>
          <u>Read more</u>
        </>
      ) : (
        "Show less"
      )}
    </button>
  );
  const shown = fits?.text === text ? fits.length : null;
  return (
    <div className={styles.blurbWrap}>
      {!folded ? (
        <>
          <p className={styles.blurb}>{text}</p>
          {toggle}
        </>
      ) : shown == null ? (
        // the first moment, before it's measured: the plain three lines
        <p className={`${styles.blurb} ${styles.clamped}`}>{text}</p>
      ) : (
        <p className={styles.blurb}>
          {/* its own dots dropped, so the "…" isn't "sword.....": */}
          {text
            .slice(0, shown)
            .trimEnd()
            .replace(/[.…]+$/, "")}
          {toggle}
        </p>
      )}
      {/* where the fit is tried: the same width and type, unseen */}
      <p
        ref={measure}
        aria-hidden="true"
        className={`${styles.blurb} invisible absolute inset-x-0 top-0`}
      />
    </div>
  );
}

// the most of the text, ending on a whole word, that with "… Read more"
// after it still fits in three lines of the box
function fittingLength(box: HTMLParagraphElement, text: string) {
  const most = parseFloat(getComputedStyle(box).lineHeight) * LINES + 1;
  const fitsIn = (length: number) => {
    box.textContent = `${text.slice(0, length).trimEnd()}… Read more`;
    return box.offsetHeight <= most;
  };
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fitsIn(middle)) low = middle;
    else high = middle - 1;
  }
  box.textContent = "";
  // back to the end of a word, so none is cut in half
  const wordEnd = text.slice(0, low + 1).search(/\s\S*$/);
  return wordEnd > 0 ? wordEnd : low;
}
