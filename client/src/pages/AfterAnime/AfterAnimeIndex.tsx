// /after-the-anime  Look a show up by name, or pick one from the series we
// already have an answer for (most popular first).
import { INDEX_META } from "../../lib/afterAnimeText";
import { useEffect, useState } from "react";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import {
  afterAnimeCanonicalPath,
  afterAnimePath,
  getAfterAnimeIndex,
  type AfterAnimeShow,
} from "../../lib/afterAnime";
import { usePageMeta } from "../../lib/seo";
import SeriesCard from "../Prices/SeriesCard";
import SeriesSearchBox from "../Prices/SeriesSearchBox";
import { pricesStyles as priceStyles } from "../Prices/styles";
import { afterAnimeStyles as styles } from "./styles";

const seasonsText = (count: number) =>
  count === 1 ? "1 season" : `${count} seasons`;

export default function AfterAnimeIndex() {
  // null while loading; an empty list when it couldn't load (the search
  // still works without it)
  const [shows, setShows] = useState<AfterAnimeShow[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getAfterAnimeIndex(controller.signal)
      .then(setShows)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setShows([]);
      });
    return () => controller.abort();
  }, []);

  usePageMeta(INDEX_META);

  return (
    <div className={`${styles.page} fade-in`}>
      <header className={priceStyles.searchHead}>
        <h1 className={priceStyles.title}>Where does the anime leave off?</h1>
        <p className={priceStyles.sub}>
          Finished a season? Look the show up to see which chapter of the manga
          to start at, which volume that's in, and what it costs.
        </p>
        <SeriesSearchBox
          autoFocus
          goTo={afterAnimePath}
          placeholder="Search an anime or manga"
        />
      </header>

      {shows === null && (
        <div aria-busy="true" aria-label="Loading">
          <SlowLoadQuote />
          <div className={priceStyles.grid}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className={`skeleton ${priceStyles.cardSkeleton}`} />
            ))}
          </div>
        </div>
      )}

      {shows && shows.length > 0 && (
        <section aria-labelledby="shows-title">
          <h2 id="shows-title" className={priceStyles.sectionTitle}>
            Shows we can answer
          </h2>
          <ul className={priceStyles.grid}>
            {shows.map((show) => (
              <li key={show.slug}>
                <SeriesCard
                  series={{
                    name: show.name,
                    coverUrl: show.coverUrl,
                    genre: show.seasons ? seasonsText(show.seasons) : undefined,
                  }}
                  to={afterAnimeCanonicalPath(show.name)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
