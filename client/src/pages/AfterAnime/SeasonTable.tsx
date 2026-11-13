// Every season of a long show at a glance: "You watched", "Start at
// chapter", "Buy volume". The volume opens its own price page. Only for a
// long show (the page decides): on a short one the panels say it all.
import { NavLink } from "react-router";
import {
  buyVolume,
  seasonAnchor,
  tableRow,
  type AnimeStop,
} from "../../lib/afterAnimeText";
import { seriesCanonicalPath, volumePath } from "../../lib/prices";
import type { SeriesVolume } from "../../lib/types";
import { bookFor } from "./bookFor";
import { afterAnimeStyles as styles } from "./styles";

// a season's "Buy volume" cell: the volume, as a link to its price page. A
// season with nothing to buy next gets a dash. One with no volume on record
// goes to the series' page, where every volume is. A volume not in the
// English list (or while the list loads) points to the season's panel, which
// says so
function VolumeCell({
  stop,
  seriesName,
  volumes,
}: {
  stop: AnimeStop;
  seriesName: string;
  volumes: SeriesVolume[] | null;
}) {
  if (stop.coversAll) return <span aria-label="Nothing to buy next">—</span>;
  const volume = buyVolume(stop);
  if (volume === null)
    return (
      <NavLink to={seriesCanonicalPath(seriesName)} viewTransition>
        See volumes
      </NavLink>
    );
  const book = volumes ? bookFor(volumes, volume) : null;
  if (!book) return <a href={`#${seasonAnchor(stop)}`}>{volume}</a>;
  return (
    <NavLink
      to={volumePath(book.isbn13, book.title)}
      aria-label={`Volume ${volume} prices`}
      viewTransition
    >
      {volume}
    </NavLink>
  );
}

export default function SeasonTable({
  stops,
  seriesName,
  // the series' English volumes; null while they load
  volumes,
}: {
  stops: AnimeStop[];
  seriesName: string;
  volumes: SeriesVolume[] | null;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">
          The chapter to start at and the volume to buy, by the last season you
          watched
        </caption>
        <thead>
          <tr>
            <th scope="col">You watched</th>
            <th scope="col">Start at chapter</th>
            <th scope="col">Buy volume</th>
          </tr>
        </thead>
        <tbody>
          {stops.map((stop) => {
            const row = tableRow(stop);
            return (
              <tr key={stop.label}>
                <th scope="row">{row.watched}</th>
                <td>{row.start || "Not known"}</td>
                <td>
                  <VolumeCell
                    stop={stop}
                    seriesName={seriesName}
                    volumes={volumes}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
