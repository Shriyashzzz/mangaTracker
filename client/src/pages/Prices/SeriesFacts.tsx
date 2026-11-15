import type { SeriesInfo } from "../../lib/types";
import { useState } from "react";
import { novelParts } from "../../lib/prices";
import { starsOf } from "./reviews/reviewText";
import { pricesStyles as styles } from "./styles";

// AniList's take on a series: score, popularity, genres and the blurb,
// collapsed to a few lines until you ask for more
export default function SeriesFacts({ info }: { info: SeriesInfo }) {
  const [expanded, setExpanded] = useState(false);
  const long = (info.description?.length ?? 0) > 320;

  return (
    <div className={styles.facts}>
      <ul className={styles.factRow}>
        {info.score != null && (
          <li>
            Rated <strong>★ {starsOf(info.score)}</strong> on AniList
          </li>
        )}
        {info.popularityRank != null && (
          <li>
            <strong>#{info.popularityRank}</strong> most popular there
          </li>
        )}
        {info.volumes != null && (
          <li>
            {/* a manga's count is AniList's, which counts Japan's volumes:
                said, so it doesn't argue with the English count beside it */}
            <strong>{info.volumes}</strong> volumes
            {novelParts(info.name).lightNovel ? "" : " in Japan"}
            {info.status === "FINISHED" ? ", finished" : ""}
          </li>
        )}
        {info.siteUrl && (
          <li>
            <a href={info.siteUrl} target="_blank" rel="noreferrer">
              AniList
            </a>
          </li>
        )}
      </ul>

      {info.genres.length > 0 && (
        <ul className={styles.genres}>
          {info.genres.map((g: string) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      )}

      {info.description && (
        <div>
          <p
            className={`${styles.blurb} ${long && !expanded ? styles.clamped : ""}`}
          >
            {info.description}
          </p>
          {long && (
            <button
              type="button"
              className={styles.textBtn}
              aria-expanded={expanded}
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
