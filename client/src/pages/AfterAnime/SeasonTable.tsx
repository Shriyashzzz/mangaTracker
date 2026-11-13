// Every season of a show at a glance: where the anime ends, where to start
// reading, and the volume. Each season links to its panel further down. For
// a show with several seasons; one season's panel says it all by itself.
import {
  seasonAnchor,
  tableRow,
  type AnimeStop,
} from "../../lib/afterAnimeText";
import { afterAnimeStyles as styles } from "./styles";

export default function SeasonTable({ stops }: { stops: AnimeStop[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">
          Where each season ends and where to start the manga
        </caption>
        <thead>
          <tr>
            <th scope="col">Watched</th>
            <th scope="col">Anime ends</th>
            <th scope="col">Start at</th>
            <th scope="col">Volume</th>
          </tr>
        </thead>
        <tbody>
          {stops.map((stop) => {
            const row = tableRow(stop);
            return (
              <tr key={stop.label}>
                <th scope="row">
                  <a href={`#${seasonAnchor(stop)}`}>{row.season}</a>
                </th>
                <td>{row.ends || "Not known"}</td>
                <td>{row.start || "Not known"}</td>
                <td>{row.volume || "Not known"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
