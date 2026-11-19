// A reader's year in manga, added up from what the database keeps: the
// shelf's dated history (shelf_events), the books they said they bought and
// when, their reviews, and the shelf as it is now. Pure, so it can be tested
// on its own (yearInManga.ts reads the rows).
//
// What counts:
//   volumes added    volumes ticked that year, and the ones a series came
//                    with when it was added by hand (never an import: a
//                    library brought over wasn't bought that year)
//   chapters read,   what the place moved that year; going back to fix a
//   volumes read     slip takes it off again
//   series finished  marked finished that year, less any taken back

export type YearEvent = {
  series: string;
  kind: string;
  amount: number;
  at: Date;
};
export type YearBook = { paidCents: number | null; boughtOn: Date | null };
export type ShelfNow = {
  name: string;
  genre: string | null;
  owned: number;
  rating: number | null;
  // its cover, for the cards
  image: string | null;
};

export type YearInManga = {
  year: number;
  // the first day this year has history for: a year that began before the
  // history did says "since" it (null: nothing recorded that year)
  since: string | null;
  volumesAdded: number;
  seriesAdded: number;
  chaptersRead: number;
  volumesRead: number;
  seriesFinished: number;
  booksBought: number;
  spentCents: number;
  reviews: number;
  // the series read most that year, most first (chapters, then volumes)
  topSeries: {
    name: string;
    chapters: number;
    volumes: number;
    image: string | null;
  }[];
  // the month with the most going on, 1 to 12; null with nothing that year
  busiestMonth: number | null;
  // the shelf as it is now
  shelf: {
    series: number;
    volumes: number;
    topGenre: string | null;
    fiveStars: { name: string; image: string | null }[];
  };
};

const MOST_TOP = 3;
const MOST_FIVE_STARS = 3;
const atLeast0 = (n: number) => Math.max(0, n);
const inYear = (date: Date, year: number) => date.getUTCFullYear() === year;

export function yearInManga(
  year: number,
  events: YearEvent[],
  books: YearBook[],
  reviewDates: Date[],
  shelf: ShelfNow[],
): YearInManga {
  const theYear = events.filter((e) => inYear(e.at, year));
  const sum = (kind: string) =>
    theYear.filter((e) => e.kind === kind).reduce((n, e) => n + e.amount, 0);

  // read most: chapters and volumes moved, per series
  const read = new Map<string, { chapters: number; volumes: number }>();
  for (const e of theYear) {
    if (e.kind !== "chapters" && e.kind !== "volumes") continue;
    const had = read.get(e.series) ?? { chapters: 0, volumes: 0 };
    had[e.kind] += e.amount;
    read.set(e.series, had);
  }
  const coverOf = new Map(shelf.map((s) => [s.name, s.image]));
  const topSeries = [...read.entries()]
    .map(([name, r]) => ({
      name,
      chapters: atLeast0(r.chapters),
      volumes: atLeast0(r.volumes),
      image: coverOf.get(name) ?? null,
    }))
    .filter((s) => s.chapters + s.volumes > 0)
    .sort((a, b) => b.chapters - a.chapters || b.volumes - a.volumes)
    .slice(0, MOST_TOP);

  // the month with the most rows (an import is one busy day, not a month)
  const perMonth = new Array<number>(12).fill(0);
  for (const e of theYear)
    if (e.kind !== "imported") perMonth[e.at.getUTCMonth()]!++;
  const most = Math.max(...perMonth);

  const bought = books.filter((b) => b.boughtOn && inYear(b.boughtOn, year));
  const genres = new Map<string, number>();
  for (const s of shelf)
    if (s.genre) genres.set(s.genre, (genres.get(s.genre) ?? 0) + 1);
  const topGenre =
    [...genres.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const first = theYear.reduce<Date | null>(
    (min, e) => (!min || e.at < min ? e.at : min),
    null,
  );

  return {
    year,
    since: first ? first.toISOString().slice(0, 10) : null,
    volumesAdded: atLeast0(sum("owned") + sum("added")),
    seriesAdded: theYear.filter((e) => e.kind === "added").length,
    chaptersRead: atLeast0(sum("chapters")),
    volumesRead: atLeast0(sum("volumes")),
    seriesFinished: atLeast0(sum("finished")),
    booksBought: bought.length,
    spentCents: bought.reduce((n, b) => n + (b.paidCents ?? 0), 0),
    reviews: reviewDates.filter((d) => inYear(d, year)).length,
    topSeries,
    busiestMonth: most > 0 ? perMonth.indexOf(most) + 1 : null,
    shelf: {
      series: shelf.length,
      volumes: shelf.reduce((n, s) => n + s.owned, 0),
      topGenre,
      fiveStars: shelf
        .filter((s) => s.rating === 5)
        .map((s) => ({ name: s.name, image: s.image }))
        .slice(0, MOST_FIVE_STARS),
    },
  };
}
