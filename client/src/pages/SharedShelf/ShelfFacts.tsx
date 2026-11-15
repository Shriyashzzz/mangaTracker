// The shelf in a few numbers, and how it splits by genre (shelfNumbers.ts):
// one line of small boxes and a thin bar, under the owner's name.
import { plural } from "./sharedShelfView";
import { shelfNumbers } from "./shelfNumbers";
import type { SharedManga } from "./shareParts";
import { shareStyles as styles } from "./styles";

// the bar's inks, biggest genre first; the last is for "Other"
const GENRE_INKS = [
  "var(--accent)",
  "var(--ink)",
  "var(--stamp-market)",
  "var(--stamp-ebook)",
  "var(--line-soft)",
];

export default function ShelfFacts({ manga }: { manga: SharedManga[] }) {
  const { ownsAll, longestRun, mostly, genres } = shelfNumbers(manga);
  const hasNumbers = ownsAll > 0 || longestRun || mostly;
  if (!hasNumbers && !genres.length) return null;
  const withGenre = genres.reduce((n, g) => n + g.count, 0);
  return (
    <div className={styles.numbers}>
      {hasNumbers && (
        <ul className={styles.brag}>
          {ownsAll > 0 && (
            <li>
              Every volume of <b>{plural(ownsAll, "series", "series")}</b>
            </li>
          )}
          {longestRun && (
            <li>
              Longest run:{" "}
              <b>
                {longestRun.name}, {longestRun.volumes}
              </b>
            </li>
          )}
          {mostly && (
            <li>
              Mostly <b>{mostly.toLowerCase()}</b>
            </li>
          )}
        </ul>
      )}
      {genres.length > 0 && (
        <>
          <div
            className={styles.genreBar}
            role="img"
            aria-label={`Genres: ${genres
              .map(
                (g) => `${g.name} ${Math.round((g.count / withGenre) * 100)}%`,
              )
              .join(", ")}`}
          >
            {genres.map((g, i) => (
              <span
                key={g.name}
                style={{ flexGrow: g.count, background: GENRE_INKS[i] }}
              />
            ))}
          </div>
          <ul className={styles.genreKey} aria-hidden>
            {genres.map((g, i) => (
              <li key={g.name}>
                <span style={{ background: GENRE_INKS[i] }} />
                {g.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
