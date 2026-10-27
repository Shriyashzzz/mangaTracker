import { NavLink } from "react-router";
import { seriesPath } from "../../lib/prices";
import { pricesStyles as styles } from "./styles";

// one series: cover, name and a line of facts. Used on the price home
// (popular this season, search results) and the /series index
// the fields a card shows; search hits and index entries both fit
export type SeriesCardData = {
  name: string;
  coverUrl: string | null;
  year?: number | null;
  volumes?: number | null;
  score?: number | null;
  genre?: string;
};

export default function SeriesCard({ series }: { series: SeriesCardData }) {
  return (
    <NavLink
      to={seriesPath(series.name)}
      className={styles.card}
      viewTransition
    >
      <span className={styles.cover}>
        <span className={styles.coverFallback} aria-hidden>
          ?
        </span>
        {series.coverUrl && <img src={series.coverUrl} alt="" loading="lazy" />}
      </span>
      <span className={styles.cardTitle}>{series.name}</span>
      <span className={styles.cardMeta}>
        {[
          series.year,
          series.volumes && `${series.volumes} vols`,
          series.score && `Score ${series.score}`,
          series.genre,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </NavLink>
  );
}
