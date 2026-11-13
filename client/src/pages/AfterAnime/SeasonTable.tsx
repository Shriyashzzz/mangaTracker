// Every season of a show at a glance: "If you watched", "Start reading at",
// "Volume". The volume links to the season's
// panel further down, where its buy button is. For a show with several
// seasons; one season's panel says it all by itself.
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
                  {/* down to the season's panel, where its buy button is.
                      With no volume on record the panel still leads to the
                      series' volumes */}
                  <a href={`#${seasonAnchor(stop)}`}>
                    {row.volume || "See volumes"}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
