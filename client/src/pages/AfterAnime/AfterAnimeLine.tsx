// One line on a series' price page for someone coming from the anime:
// "Watched the anime? See where to start the manga." It gives no numbers,
// only the way to the series' "after the anime" page, where every season is.
// Nothing at all for a series with no answer.
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import {
  afterAnimeCanonicalPath,
  getAfterAnime,
  type AfterAnime,
} from "../../lib/afterAnime";
import { pricesStyles as priceStyles } from "../Prices/styles";

export default function AfterAnimeLine({ seriesName }: { seriesName: string }) {
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
    <p className={priceStyles.partOf}>
      Watched the anime?{" "}
      <NavLink to={afterAnimeCanonicalPath(show.name)} viewTransition>
        See where to start the manga
      </NavLink>
    </p>
  );
}
