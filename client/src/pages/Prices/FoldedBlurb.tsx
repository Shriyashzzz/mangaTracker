import { useState } from "react";
import { pricesStyles as styles } from "./styles";

// A description folded to three lines, its "Read more" at the end of the
// third line itself (on a patch of the page's colour over the cut-off
// words), as the app has it. Opened, "Show less" follows the text. For a
// series' blurb (SeriesFacts) and a volume's (VolumeFacts)
export default function FoldedBlurb({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 320;
  const folded = long && !expanded;
  return (
    <div className={styles.blurbWrap}>
      <p className={`${styles.blurb} ${folded ? styles.clamped : ""}`}>
        {text}
      </p>
      {long && (
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
      )}
    </div>
  );
}
