// A bar on a series' price page for someone coming from the anime: "Watched
// the anime?" and the way to the series' "after the anime" page, where every
// season has its chapter and volume. It gives no numbers itself. Nothing at
// all for a series with no answer.
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import {
  afterAnimeCanonicalPath,
  getAfterAnime,
  type AfterAnime,
} from "../../lib/afterAnime";
import { afterAnimeStyles as styles } from "./styles";

export default function AfterAnimeBar({ seriesName }: { seriesName: string }) {
  // the answer with the series it's for, so another series' is never shown
  const [found, setFound] = useState<{
    asked: string;
    show: AfterAnime;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getAfterAnime(seriesName, controller.signal)
      .then((show) => setFound({ asked: seriesName, show }))
      .catch(() => {
        // no answer, or it couldn't be asked: the page is as it was
      });
    return () => controller.abort();
  }, [seriesName]);

  const show = found?.asked === seriesName ? found.show : null;
  if (!show?.stops.length) return null;
  return (
    <aside className={styles.bar} aria-labelledby="after-anime-bar-title">
      <div className={styles.barWords}>
        <h2 id="after-anime-bar-title" className={styles.barTitle}>
          Watched the anime?
        </h2>
        <p className={styles.barText}>
          See which chapter and volume of the manga to start from.
        </p>
      </div>
      <NavLink
        to={afterAnimeCanonicalPath(show.name)}
        className="btn"
        viewTransition
      >
        Find where to start
      </NavLink>
    </aside>
  );
}
