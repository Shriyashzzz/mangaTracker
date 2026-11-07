import { NavLink } from "react-router";
import {
  coverSrc,
  hideBrokenCover,
  hidePlaceholderCover,
  novelParts,
  seriesPath,
} from "../../lib/prices";
import { pricesStyles as styles } from "./styles";

// one series: cover, name and a line of facts. Used on the price home
// (popular this season, search results) and the /series index
// the fields a card shows; search hits and index entries both fit
type SeriesCardData = {
  name: string;
  coverUrl: string | null;
  year?: number | null;
  volumes?: number | null;
  score?: number | null;
  genre?: string;
};

export default function SeriesCard({ series }: { series: SeriesCardData }) {
  // "Overlord Light Novel" is shown as Overlord, a light novel
  const shown = novelParts(series.name);
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
        {series.coverUrl && (
          <img
            src={coverSrc(series.coverUrl)}
            alt=""
            loading="lazy"
            onError={hideBrokenCover}
            onLoad={hidePlaceholderCover}
          />
        )}
      </span>
      <span className={styles.cardTitle}>{shown.title}</span>
      <span className={styles.cardMeta}>
        {[
          shown.lightNovel && "Light novel",
          series.year,
          // a manga's count is AniList's, which counts Japan's volumes (the
          // US edition can be fewer, or omnibuses); a novel's is the English
          // list we keep
          series.volumes &&
            (shown.lightNovel
              ? `${series.volumes} vols`
              : `${series.volumes} vols in Japan`),
          // AniList's score, out of 100: not their own stars
          series.score && `AniList ${series.score}%`,
          series.genre,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </NavLink>
  );
}
