// "To get": the next volume its owner needs for each series they've
// started, each leading to that volume's prices. A shared shelf as a gift
// list. What's next comes from the server (util/shelf/sharedVolumes.ts).
import { NavLink } from "react-router";
import { dayName } from "../../lib/collector";
import { formatCents, volumePath } from "../../lib/prices";
import { SeriesCover } from "./SeriesSheet";
import type { SharedManga } from "./shareParts";
import { shareStyles as styles } from "./styles";

export default function ToGet({
  manga,
  owner,
}: {
  // the series that have a next volume (shelfNumbers.ts toGetOf)
  manga: SharedManga[];
  owner: string;
}) {
  return (
    <>
      <p className={styles.hint}>
        The next volume {owner} needs for each series. Handy for a gift.
      </p>
      <ul className={styles.rows}>
        {manga.map((m, i) => {
          const next = m.next!;
          return (
            <li key={`${m.name}-${i}`} className={styles.row}>
              <NavLink
                to={volumePath(next.isbn13, next.title)}
                className={styles.getCard}
                viewTransition
              >
                <SeriesCover m={m} className={styles.rowCover} sizes="60px" />
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{m.name}</span>
                  <span className={styles.getNext}>
                    Vol. {next.volume} next
                  </span>
                  {/* when it's out, or what it costs: whichever we know */}
                  {next.comingOut && (
                    <span className={styles.cardMeta}>
                      Out {dayName(next.comingOut)}
                    </span>
                  )}
                  {!next.comingOut && next.fromCents != null && (
                    <span className={styles.getPrice}>
                      from {formatCents(next.fromCents)}
                    </span>
                  )}
                </span>
                <span className={styles.getGo}>
                  {next.comingOut ? "Preorder" : "See prices"}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </>
  );
}
