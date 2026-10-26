import { useState } from "react";
import styles from "./Prices.module.css";

// AniList's take on a series: score, popularity, genres and the blurb,
// collapsed to a few lines until you ask for more
export default function SeriesFacts({ info }) {
  const [expanded, setExpanded] = useState(false);
  const long = info.description?.length > 320;

  return (
    <div className={styles.facts}>
      <ul className={styles.factRow}>
        {info.score != null && (
          <li>
            Score <strong>{info.score}</strong>
          </li>
        )}
        {info.popularityRank != null && (
          <li>
            Popularity <strong>#{info.popularityRank}</strong>
          </li>
        )}
        {info.volumes != null && (
          <li>
            <strong>{info.volumes}</strong> volumes
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

      {info.genres?.length > 0 && (
        <ul className={styles.genres}>
          {info.genres.map((g) => (
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
