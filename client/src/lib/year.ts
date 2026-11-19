import { useEffect, useState } from "react";
import { getJson } from "./api";
import { isDemo } from "./demo";
// A reader's year in manga, as the server adds it up
// (server/src/history/yearRules.ts YearInManga)
export type YearInManga = {
  year: number;
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

// whether this year has anything to show yet, asked once a visit (the menu
// shows "Your year in manga" only then). Never on the tour's practice shelf
let asked: Promise<boolean> | null = null;
export function useHasYear(signedIn: boolean) {
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (!signedIn || isDemo()) return;
    asked ??= getJson<YearInManga>("/api/history/year")
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
