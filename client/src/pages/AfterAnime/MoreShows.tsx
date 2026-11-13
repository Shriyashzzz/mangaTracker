// "More shows" at the foot of a show's page: a few others we have an answer
// for, most popular first. Something to carry on to, and the links search
// engines follow from one show to the next.
import { useEffect, useState } from "react";
import {
  afterAnimeCanonicalPath,
  getAfterAnimeIndex,
  type AfterAnimeShow,
} from "../../lib/afterAnime";
import SeriesCard from "../Prices/SeriesCard";
import { pricesStyles as priceStyles } from "../Prices/styles";

const SHOWN = 6;

export default function MoreShows({ notThis }: { notThis: string }) {
  const [shows, setShows] = useState<AfterAnimeShow[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    getAfterAnimeIndex(controller.signal)
      .then(setShows)
      .catch(() => {
        // the page is whole without it
      });
    return () => controller.abort();
  }, []);

  const others = shows.filter((show) => show.slug !== notThis).slice(0, SHOWN);
  if (!others.length) return null;
  return (
    <section aria-labelledby="more-shows-title">
      <h2 id="more-shows-title" className={priceStyles.sectionTitle}>
        More shows
      </h2>
      <ul className={priceStyles.grid}>
        {others.map((show) => (
          <li key={show.slug}>
            <SeriesCard
              series={{ name: show.name, coverUrl: show.coverUrl }}
              to={afterAnimeCanonicalPath(show.name)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
