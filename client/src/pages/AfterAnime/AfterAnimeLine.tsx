// One short line on a series' price page for someone coming from the anime:
// "After the anime (Season 2): start at chapter 138, vol. 16." It links to
// the series' "after the anime" page, where every season is. Only what's
// certain is said (shortLine); nothing at all for a series with no answer.
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import {
  afterAnimeCanonicalPath,
  getAfterAnime,
  type AfterAnime,
} from "../../lib/afterAnime";
import { shortLine } from "../../lib/afterAnimeText";
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
  // the latest season is the one most people have just finished
  const latest = show?.stops[show.stops.length - 1];
  const line = latest ? shortLine(latest) : null;
  if (!show || !line) return null;
  return (
    <p className={priceStyles.partOf}>
      {line.lead}{" "}
      <NavLink to={afterAnimeCanonicalPath(show.name)} viewTransition>
        {line.answer}
      </NavLink>
      .
    </p>
  );
}
