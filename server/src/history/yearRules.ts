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
  volume?: number | null;
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

// who the year says they are, with a line for it (titleOf)
export type CollectorTitle = { name: string; line: string };

export type YearInManga = {
  year: number;
  title: CollectorTitle;
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
  // the day with the most chapters read, and what was read most that day
  biggestDay: { day: string; chapters: number; series: string } | null;
  // the most days in a row with any reading
  longestStreak: number;
  // the first volume ticked that year, and the last series finished
  firstVolume: { series: string; volume: number; day: string } | null;
  lastFinished: { series: string; day: string } | null;
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
  // the omnibus, deluxe and box set books on the shelf, for the title
  editionBooks = 0,
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

  // read per day: the biggest day, and the longest run of days
  const dayOf = (d: Date) => d.toISOString().slice(0, 10);
  const perDay = new Map<string, Map<string, number>>();
  const readDays = new Set<string>();
  for (const e of theYear) {
    if ((e.kind === "chapters" || e.kind === "volumes") && e.amount > 0)
      readDays.add(dayOf(e.at));
    if (e.kind !== "chapters") continue;
    const day = perDay.get(dayOf(e.at)) ?? new Map<string, number>();
    day.set(e.series, (day.get(e.series) ?? 0) + e.amount);
    perDay.set(dayOf(e.at), day);
  }
  let biggestDay: YearInManga["biggestDay"] = null;
  for (const [day, bySeries] of perDay) {
    const chapters = [...bySeries.values()].reduce((n, c) => n + c, 0);
    if (chapters > (biggestDay?.chapters ?? 0)) {
      const series = [...bySeries.entries()].sort((x, y) => y[1] - x[1])[0]![0];
      biggestDay = { day, chapters, series };
    }
  }
  const days = [...readDays].sort();
  let longestStreak = days.length ? 1 : 0;
  for (let i = 1, run = 1; i < days.length; i++) {
    const gap = (Date.parse(days[i]!) - Date.parse(days[i - 1]!)) / 86_400_000;
    run = gap === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }
  const inOrder = [...theYear].sort((x, y) => x.at.getTime() - y.at.getTime());
  const firstOwned = inOrder.find((e) => e.kind === "owned" && e.amount > 0);
  const finished = inOrder.filter((e) => e.kind === "finished" && e.amount > 0);
  const last = finished.at(-1);

  const summary = {
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
    biggestDay,
    longestStreak,
    firstVolume: firstOwned
      ? {
          series: firstOwned.series,
          volume: firstOwned.volume ?? 0,
          day: dayOf(firstOwned.at),
        }
      : null,
    lastFinished: last ? { series: last.series, day: dayOf(last.at) } : null,
  };
  return { ...summary, title: titleOf(summary, editionBooks) };
}

// The title, the first that fits, in this order; everyone has one
export function titleOf(
  y: Omit<YearInManga, "title">,
  editionBooks: number,
): CollectorTitle {
  const top = y.topSeries[0];
  if (editionBooks >= 3)
    return {
      name: "The Deluxe Hunter",
      line: "Why own one volume when one book can hold three?",
    };
  if (y.chaptersRead >= 300 || (y.biggestDay?.chapters ?? 0) >= 30)
    return {
      name: "The Binge Reader",
      line: "You treat 'one more chapter' as a lifestyle.",
    };
  if (y.seriesFinished >= 3)
    return {
      name: "The Completionist",
      line: "You don't start what you won't finish.",
    };
  if (top && y.chaptersRead >= 50 && top.chapters * 2 >= y.chaptersRead)
    return {
      name: "The Loyalist",
      line: `One series had your heart: ${top.name}.`,
    };
  if (y.volumesAdded >= 30)
    return {
      name: "The Shelf Builder",
      line: "Your shelf grew. Your floor space didn't.",
    };
  return { name: "The Collector", line: "Every shelf starts somewhere." };
}
