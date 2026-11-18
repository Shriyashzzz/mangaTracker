// One earlier season of an "after the anime" page: what to start at, and
// what to buy to carry on (SeasonBuy). The latest season isn't a panel: it's
// the page's own opening (AfterAnimeShow). The words are
// lib/afterAnimeText.ts.
import AnswerWords from "./AnswerWords";
import type { VolumeOffers } from "../../lib/afterAnime";
import {
  afterLabel,
  endText,
  keepNumbers,
  seasonAnchor,
  startText,
  type AnimeStop,
} from "../../lib/afterAnimeText";
import type { SeriesVolume } from "../../lib/types";
import FixForm from "./FixForm";
import SeasonBuy from "./SeasonBuy";
import SeasonNotes from "./SeasonNotes";
import { afterAnimeStyles as styles } from "./styles";

export default function SeasonPanel({
  stop,
  seriesName,
  // the series' English volumes; null while they load
  volumes,
  // each volume's saved buy link, by ISBN
  offers,
  seriesCoverUrl,
}: {
  stop: AnimeStop;
  seriesName: string;
  volumes: SeriesVolume[] | null;
  offers: Record<string, VolumeOffers>;
  seriesCoverUrl: string | null;
}) {
  // "" for a season that only names the volume to start from
  const where = endText(stop);
  return (
    <section className={styles.season} id={seasonAnchor(stop)}>
      <div className={styles.seasonWords}>
        {/* one heading, on two lines: the season, then the answer */}
        <h2 className={styles.seasonHeading}>
          <span className={styles.seasonTitle}>
            {keepNumbers(afterLabel(stop))}
          </span>
          <span className="sr-only">: </span>
          <span className={styles.start}>
            <AnswerWords text={keepNumbers(startText(stop))} />
          </span>
        </h2>
        {where && <p className={styles.end}>{keepNumbers(where)}</p>}
        <SeasonNotes stop={stop} />
      </div>

      <div className={styles.volumes}>
        <SeasonBuy
          stop={stop}
          seriesName={seriesName}
          volumes={volumes}
          offers={offers}
          seriesCoverUrl={seriesCoverUrl}
        />
      </div>

      <FixForm seriesName={seriesName} season={stop.label} />
    </section>
  );
}
