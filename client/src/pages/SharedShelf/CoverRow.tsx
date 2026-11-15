// A row of covers to swipe along, at the top of a shared shelf, under a
// stamp: the series its owner picked for the top, or their five-star ones.
// Each opens its sheet.
import CoverCaption, {
  COVER_WITH_CAPTION,
} from "../../components/coverCaption/CoverCaption";
import { StarIcon } from "../../components/icons/Icons";
import { SeriesCover } from "./SeriesSheet";
import type { SharedManga } from "./shareParts";
import { shareStyles as styles } from "./styles";

// a row, not a second shelf: the rest are in the lists
const MOST = 12;

export default function CoverRow({
  title,
  note,
  manga,
  stars = false,
  onOpen,
}: {
  // on the stamp: "Top picks", "Favourites"
  title: string;
  // beside it, small: who picked them, or why they're here
  note: string;
  manga: SharedManga[];
  // five stars under each cover
  stars?: boolean;
  onOpen: (m: SharedManga) => void;
}) {
  return (
    <section className={styles.favs} aria-labelledby="share-cover-row">
      <div className={styles.favsHead}>
        <h2 id="share-cover-row" className={styles.favsName}>
          {title}
        </h2>
        <span className={styles.rowNote}>{note}</span>
      </div>
      <ul className={styles.favStrip}>
        {manga.slice(0, MOST).map((m, i) => (
          <li key={`${m.name}-${i}`} className={styles.favTile}>
            <button
              type="button"
              className={`${styles.fanCard} ${COVER_WITH_CAPTION}`}
              aria-haspopup="dialog"
              aria-label={`${m.name}. Open`}
              onClick={() => onOpen(m)}
            >
              <SeriesCover m={m} className={styles.favCover} sizes="76px" />
              {/* which series, on hover: under the cover (the row keeps
                  room below for it, since it scrolls sideways) */}
              <CoverCaption name={m.name} />
            </button>
            {stars && (
              <span className={styles.favStars} aria-hidden>
                {Array.from({ length: 5 }, (_, n) => (
                  <StarIcon key={n} filled />
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
