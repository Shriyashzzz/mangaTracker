import { NavLink } from "react-router";
import { seriesPath } from "../../lib/prices";
import styles from "./Prices.module.css";

// one series: cover, name and a line of facts. Used on the price home
// (popular this season, search results) and the /series index
export default function SeriesCard({ series }) {
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
