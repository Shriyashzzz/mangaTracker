import type { SeriesInfo } from "../../lib/types";
import { novelParts } from "../../lib/prices";
import { starsOf } from "./reviews/reviewText";
import FoldedBlurb from "./FoldedBlurb";
import { pricesStyles as styles } from "./styles";

// AniList's take on a series: score, popularity, genres and the blurb,
// collapsed to a few lines until you ask for more. `completeInEnglish`: its
// last volume in English, when a trusted source marks it (Series)
export default function SeriesFacts({
  info,
  completeInEnglish = null,
}: {
  info: SeriesInfo;
  completeInEnglish?: number | null;
}) {
  return (
    <div className={styles.facts}>
      <ul className={styles.factRow}>
        {info.score != null && (
          <li>
            Rated <strong>★ {starsOf(info.score)}</strong>
          </li>
        )}
        {/* with a rank, its "AniList" is the link; without one, the link
            stands beside the rating it comes from */}
        {info.siteUrl && info.popularityRank == null && (
          <li>
            <a href={info.siteUrl} target="_blank" rel="noreferrer">
              AniList
            </a>
          </li>
        )}
        {info.popularityRank != null && (
          <li>
            <strong>#{info.popularityRank}</strong> most popular on{" "}
            {info.siteUrl ? (
              <a href={info.siteUrl} target="_blank" rel="noreferrer">
                AniList
              </a>
            ) : (
              "AniList"
            )}
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
        {completeInEnglish != null && (
          <li>
            Complete in English, <strong>{completeInEnglish}</strong>{" "}
            {completeInEnglish === 1 ? "volume" : "volumes"}
          </li>
        )}
      </ul>

      {info.genres.length > 0 && (
        <ul className={styles.genres}>
          {info.genres.map((g: string) => (
            <li key={g} className={styles.genre}>
              {g}
            </li>
          ))}
        </ul>
      )}

      {info.description && <FoldedBlurb text={info.description} />}
    </div>
  );
}
