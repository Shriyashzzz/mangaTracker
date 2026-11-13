// A bar on a series' price page for someone coming from the anime: "Watched
// the anime?" and the way to the series' "after the anime" page, where every
// season has its chapter and volume. It gives no numbers itself.
//
// The page shows it only for a series with an answer, which it knows from
// the series itself (`hasAnimeAnswer`). The bar asks for nothing, so it's
// drawn with the rest of the page and never pushes it down by arriving late.
import { NavLink } from "react-router";
import { afterAnimeCanonicalPath } from "../../lib/afterAnime";
import { afterAnimeStyles as styles } from "./styles";

export default function AfterAnimeBar({ seriesName }: { seriesName: string }) {
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
        to={afterAnimeCanonicalPath(seriesName)}
        className="btn"
        viewTransition
      >
        Find where to start
      </NavLink>
    </aside>
  );
}
