// Every season of a show at a glance: "If you watched", "Start reading at",
// "Volume". Each volume opens its own price page; for a show with several
// seasons (one season's panel says it all by itself).
import type { ReactNode } from "react";
import { NavLink } from "react-router";
import {
  seasonAnchor,
  tableRow,
  volumesToGet,
  type AnimeStop,
} from "../../lib/afterAnimeText";
import { seriesCanonicalPath, volumePath } from "../../lib/prices";
import type { SeriesVolume } from "../../lib/types";
import { bookFor } from "./bookFor";
import { afterAnimeStyles as styles } from "./styles";

// a season's Volume cell. One volume, or two ("34 or 35"), each a link to
// its price page. "All 42" and "See volumes" go to the series' page, where
// every volume is. A volume not in the English list yet (or while the list
// loads) points down to the season's panel, which says so
function VolumeCell({
  stop,
  seriesName,
  volumes,
}: {
  stop: AnimeStop;
  seriesName: string;
  volumes: SeriesVolume[] | null;
}) {
  const wanted = volumesToGet(stop);
  if (!wanted.length)
    return (
      <NavLink to={seriesCanonicalPath(seriesName)} viewTransition>
        {tableRow(stop).volume || "See volumes"}
      </NavLink>
    );
  const links: ReactNode[] = [];
  for (const { volume } of wanted) {
    const book = volumes ? bookFor(volumes, volume) : null;
    if (links.length) links.push(" or ");
    links.push(
      book ? (
        <NavLink
          key={volume}
          to={volumePath(book.isbn13, book.title)}
          aria-label={`Volume ${volume} prices`}
          viewTransition
        >
          {volume}
        </NavLink>
      ) : (
        <a key={volume} href={`#${seasonAnchor(stop)}`}>
          {volume}
        </a>
      ),
    );
  }
  return <>{links}</>;
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
          Which chapter to start reading at and which volume it's in, by the
          last season you watched
        </caption>
        <thead>
          <tr>
            <th scope="col">If you watched</th>
            <th scope="col">Start reading at</th>
            <th scope="col">Volume</th>
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
