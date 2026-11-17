// /after-the-anime  Look a show up by name, or pick one from the series we
// already have an answer for (most popular first), 20 to a page.
import { INDEX_META } from "../../lib/afterAnimeText";
import { useEffect, useState } from "react";
import RangePager from "../../components/rangePager/RangePager";
import { useUrlPages } from "../../components/rangePager/useUrlPages";
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
  const { pageItems, pager } = useUrlPages(shows ?? [], "shows-title");

  return (
    <div className={`${styles.page} fade-in`}>
      <header className={priceStyles.searchHead}>
        <h1 className={priceStyles.title}>
          {/* painted like the home page's "tracked" and "priced", in the accent
              of the door there that leads here */}
          Where does the{" "}
          <span className={priceStyles.accentHit}>anime leave off</span>?
        </h1>
        <p className={priceStyles.sub}>
          Finished a season? Find the chapter and volume to read next.
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
          <h2
            id="shows-title"
            className={`${priceStyles.sectionTitle} scroll-mt-4`}
          >
            Pick a show
          </h2>
          <ul className={priceStyles.grid}>
            {pageItems.map((show) => (
              <li key={show.slug}>
                <SeriesCard
                  series={{ name: show.name, coverUrl: show.coverUrl }}
                  to={afterAnimeCanonicalPath(show.name)}
                />
              </li>
            ))}
          </ul>
          <RangePager {...pager} label="Show pages" />
        </section>
      )}
    </div>
  );
}
