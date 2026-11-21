// A New card drawn under an answer, so the words are shown as the tab says
// them (Home/shelfViews.ts newsFor): the cover, the series, what's next and
// how far behind, and where they are. Drawn in the site's own shapes;
// nothing in it can be pressed. A chapter card can carry the line its list
// opens with (Home/ReleaseModal.tsx)
import { newReleasesStyles as styles } from "./styles";

type Props = {
  // what's on the drawn cover
  cover: string;
  // "Vol. 13 next", "Ch. 219 next", "Vol. 30 in Japan"
  news: string;
  // "2 volumes behind"
  behind?: string;
  // "You own up to vol. 12"
  yours: string;
  // the line a tapped chapter card opens with
  opens?: string;
  // for screen readers: the whole card in words
  label: string;
};

export default function CardSketch({
  cover,
  news,
  behind,
  yours,
  opens,
  label,
}: Props) {
  return (
    <span className={styles.sketch} role="img" aria-label={label}>
      <span className={styles.picRow}>
        <span className={styles.picBook}>{cover}</span>
        <span className={styles.picWords}>
          <b>Your series</b>
          <span className={styles.picNews}>
            {news}
            {behind && <span className={styles.sketchBehind}> · {behind}</span>}
          </span>
          <span className={styles.sketchYours}>{yours}</span>
        </span>
        <span className={styles.picHide}>Hide</span>
      </span>
      {opens && <span className={styles.sketchOpens}>{opens}</span>}
    </span>
  );
}
