// On the add form, for a series with an anime: "Watched the anime?" and a
// button per season. Picking one fills in where that season leaves them in
// the manga (placeAfter in lib/afterAnimeText.ts). Nothing at all for a
// series with no answer.
import { useEffect, useState } from "react";
import { getAfterAnime, type AfterAnime } from "../../lib/afterAnime";
import { placeAfter, type AnimeStop } from "../../lib/afterAnimeText";
import { afterAnimeStyles as styles } from "./styles";

export default function WatchedAnime({
  seriesName,
  onPick,
}: {
  seriesName: string;
  // the chapter and volume the season leaves them at; null for one it
  // doesn't say
  onPick: (place: { chapter: number | null; volume: number | null }) => void;
}) {
  // the answer with the series it's for, so another series' is never shown
  const [found, setFound] = useState<{
    asked: string;
    show: AfterAnime;
  } | null>(null);
  // the season they picked, of that series
  const [picked, setPicked] = useState<{ asked: string; label: string } | null>(
    null,
  );
  useEffect(() => {
    const controller = new AbortController();
    getAfterAnime(seriesName, controller.signal)
      .then((show) => setFound({ asked: seriesName, show }))
      .catch(() => {
        // no answer, or it couldn't be asked: the form is as it was
      });
    return () => controller.abort();
  }, [seriesName]);

  const show = found?.asked === seriesName ? found.show : null;
  // a season that covers the whole manga leaves nothing to carry on with
  const seasons = (show?.stops ?? []).filter((stop) => !stop.coversAll);
  if (!seasons.length) return null;

  const pick = (stop: AnimeStop) => {
    setPicked({ asked: seriesName, label: stop.label });
    onPick(placeAfter(stop));
  };
  return (
    <div
      className={styles.watched}
      role="group"
      aria-label="Watched the anime?"
    >
      <span>Watched the anime? Tap your last season:</span>
      {seasons.map((stop) => (
        <button
          key={stop.label}
          type="button"
          className={styles.watchedPick}
          aria-pressed={
            picked?.asked === seriesName && picked.label === stop.label
          }
          onClick={() => pick(stop)}
        >
          {stop.label === "The anime" ? "Yes, all of it" : stop.label}
        </button>
      ))}
    </div>
  );
}
