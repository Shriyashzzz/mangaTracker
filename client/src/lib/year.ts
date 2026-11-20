import { useEffect, useState } from "react";
import { getJson } from "./api";
import { isDemo } from "./demo";
// A reader's year in manga, as the server adds it up
// (server/src/history/yearRules.ts YearInManga)
export type YearInManga = {
  year: number;
  // who the year says they are (server yearRules.ts titleOf)
  title: { name: string; line: string };
  biggestDay: { day: string; chapters: number; series: string } | null;
  longestStreak: number;
  firstVolume: { series: string; volume: number; day: string } | null;
  lastFinished: { series: string; day: string } | null;
  since: string | null;
  volumesAdded: number;
  seriesAdded: number;
  chaptersRead: number;
  volumesRead: number;
  seriesFinished: number;
  booksBought: number;
  spentCents: number;
  reviews: number;
  topSeries: {
    name: string;
    chapters: number;
    volumes: number;
    image: string | null;
  }[];
  busiestMonth: number | null;
  shelf: {
    series: number;
    volumes: number;
    topGenre: string | null;
    fiveStars: { name: string; image: string | null }[];
  };
};

// "1,204"
export const counted = (n: number) => n.toLocaleString("en-US");
// "1 volume", "12 volumes"
export const many = (n: number, one: string, more = `${one}s`) =>
  `${counted(n)} ${n === 1 ? one : more}`;

export const monthName = (month: number) =>
  new Date(Date.UTC(2026, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

// it began after January: the recap says since when ("Since Nov 19")
export function sinceText(year: YearInManga) {
  if (!year.since || year.since.endsWith("-01-01")) return null;
  const day = new Date(`${year.since}T12:00:00Z`);
  if (day.getUTCMonth() === 0) return null;
  return `Since ${day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

// nothing to show yet: no history, nothing bought
export const emptyYear = (y: YearInManga) =>
  !y.volumesAdded &&
  !y.chaptersRead &&
  !y.volumesRead &&
  !y.seriesFinished &&
  !y.booksBought;

// Year in manga is a season: from Nov 25 to Feb 15, by the reader's own
// date. Until Dec 31 it's this year's; from Jan 1 to Feb 15 the year that
// just ended (in January 2027 they see their 2026). null: out of season, the
// menu row is gone and /year says when it's back
export function yearSeason(now = new Date()): number | null {
  const month = now.getMonth(); // 0 is January
  const day = now.getDate();
  const year = now.getFullYear();
  if ((month === 10 && day >= 25) || month === 11) return year;
  if (month === 0 || (month === 1 && day <= 15)) return year - 1;
  return null;
}

// whether this season's year has anything to show, asked once a visit (the
// menu shows "Your year in manga" only then). Never out of season, nor on
// the tour's practice shelf
let asked: Promise<boolean> | null = null;
export function useHasYear(signedIn: boolean) {
  const [has, setHas] = useState(false);
  useEffect(() => {
    const season = yearSeason();
    if (!signedIn || isDemo() || season === null) return;
    asked ??= getJson<YearInManga>(`/api/history/year?year=${season}`)
      .then((y) => !emptyYear(y))
      .catch(() => {
        asked = null;
        return false;
      });
    let live = true;
    void asked.then((yes) => live && setHas(yes));
    return () => {
      live = false;
    };
  }, [signedIn]);
  return has;
}

// "Mar 3"
export const dayText = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

// How long the shelf is, spine to spine, from a typical manga spine of
// about 1.7 cm, said "about": "about 52 m". With a building to picture it
// by (a storey is about 3 m); null for a shelf too small to brag about
const SPINE_M = 0.017;
export function shelfLength(volumes: number) {
  if (volumes < 100) return null;
  const metres = Math.round(volumes * SPINE_M);
  const storeys = Math.floor(metres / 3);
  return {
    metres,
    picture:
      storeys >= 2
        ? `as tall as a ${storeys}-storey building, stood on end`
        : "longer than a sofa",
  };
}

// What Kenji says on a card, by how big the number is
export const kenjiSays = {
  volumes: (n: number) =>
    n >= 40
      ? "Where do you even keep them all?!"
      : n >= 10
        ? "That's a proper haul."
        : "Every shelf starts with one.",
  chapters: (n: number) =>
    n >= 300
      ? "Sleep is optional, I see."
      : n >= 100
        ? "You really kept turning pages."
        : "Slow and steady.",
  finished: (n: number) =>
    n >= 3 ? "Finishing things? Show-off." : "The last page always stings.",
  spent: () => "Worth every yen.",
  month: () => "Something good came out that month.",
  shelf: () => "Look at it. Just look at it.",
};
