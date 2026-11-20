// What a series' page says about new releases, worked out from what's loaded:
// how many books the little shelf draws, and the red "it's out" bar. No
// requests are made here.
//
// The red bar is news for someone who's caught up, never a list of what
// they're behind on (Buy next and the New tab's piles do that):
//   volumes: they have every English volume but the newest, just out
//            ("Vol. 44 is out!"), or all of them and the next is up for
//            preorder ("Vol. 44 comes out Dec 12")
//   chapters: they've read up to the one before the newest ("Ch. 124 is
//            out!"), or the newest and the next has a date ("Ch. 125
//            expected Dec 3")
// Never Japan's. Its × marks that one release seen, so the next brings the
// bar back. Volume news comes first when there's both
import { onSale } from "../../lib/releaseDate";
import { formatReleaseDate } from "../../lib/releaseDates";
import { formatCents, volumePath } from "../../lib/prices";
import { editionRelease, todayOf } from "../../lib/editionNews";
import type { EditionLine } from "../../lib/editions";
import type { Manga, ReleaseData, ReleaseStatus } from "../../lib/types";
import type { BuyOptions } from "./useBuyOptions";

type Volume = BuyOptions["volumes"][number];

// the most the shelf ever draws
const MOST_BOOKS = 999;

// How many books the shelf holds: the most we know is out, and never fewer
// than they own. Until that's known (the answer is on its way, or we've
// never heard of the series) it's theirs and a few to tick next, and
// `isKnown` is false: a number to draw with, not one to tell them
export function shelfSize(
  highestOwned: number,
  // the latest volume out, as the release check found it
  latestOut: number | null,
  buyOptions: BuyOptions,
) {
  // as the shelf's finish math counts it: a volume known to be coming means
  // every one before it is out, listed or not (vol. 17 due: 16 is out)
  const coming = buyOptions.volumes.filter(
    (v) => onSale([v]).length === 0 && Number.isInteger(v.volume),
  );
  const firstComing = Math.min(...coming.map((v) => v.volume));
  const knownOut = Math.floor(
    Math.max(
      latestOut ?? 0,
      buyOptions.latest?.volume ?? 0,
      coming.length ? firstComing - 1 : 0,
    ),
  );
  const isKnown = knownOut > 0;
  const size = isKnown
    ? Math.max(knownOut, highestOwned)
    : Math.max(highestOwned + 3, 10);
  return { size: Math.min(MOST_BOOKS, size), isKnown };
}

// "2026-12-22" is that day wherever they are (read at noon, so no time zone
// moves it to the 21st); a month alone is "Mar 2027"
function preorderDay(published?: string | null) {
  if (!published) return "";
  const isAFullDate = /^\d{4}-\d{2}-\d{2}$/.test(published);
  if (isAFullDate)
    return formatReleaseDate(`${published}T12:00:00`) ?? published;
  const [year, month] = published.split("-").map(Number);
  if (!year || !month) return published;
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "short",
  });
  return `${monthName} ${year}`;
}

export type Release = {
  // "Vol. 44 is out!", "Vol. 44 comes out Dec 12", "Ch. 124 is out!"
  headline: string;
  // the white button on the bar: buy or preorder the volume. Null when
  // there's no book to send them to
  link: { to: string; label: string } | null;
  // what its × silences: only this release. One that's out is marked seen
  // (as New's Hide does); one still coming (a preorder, an expected
  // chapter) is only silenced as a notice, so the day it's out the bar and
  // the New tab still say so
  seen: { kind: "volume" | "chapter"; number: number; upcoming: boolean };
  // the volume the button sells, so Buy next doesn't offer it twice
  sellsIsbn: string | null;
};

type Asked = {
  manga: Manga;
  releaseStatus: ReleaseStatus | null;
  releaseData: ReleaseData | null;
  buyOptions: BuyOptions;
  // they collect an omnibus or deluxe line: a single volume isn't theirs
  collectsEdition: boolean;
  // that line, and the volumes they own: its next book is their news
  edition?: { line: EditionLine; owned: number[] } | null;
  // release checks are switched on in Settings
  checksOn: boolean;
  planned: boolean;
  tracksChapters: boolean;
  highestOwned: number;
  // a coming release whose notice they've closed (Details keeps these)
  upcomingClosed: (kind: "volume" | "chapter", number: number) => boolean;
};

const byNumber = (a: Volume, b: Volume) => a.volume - b.volume;

// a volume out now: its prices, with the price when we know one
const buyLink = (v: Volume) => ({
  to: volumePath(v.isbn13, v.title),
  label:
    v.knownPriceCents != null
      ? `Buy for ${formatCents(v.knownPriceCents)}`
      : "See prices",
});
// a volume not out yet: its page, where it can be preordered
const preorderLink = (v: Volume) => ({
  to: volumePath(v.isbn13, v.title),
  label: "Preorder",
});

// The bar for someone collecting an edition: its next book, just out or
// with a day it comes out (lib/editionNews.ts editionRelease has the rule).
// What its × silences is counted in volumes like any other: the last volume
// the book holds
function editionBookNews(asked: Asked): Release | null {
  if (!asked.edition) return null;
  const { line, owned } = asked.edition;
  const { manga } = asked;
  const news = editionRelease(
    line,
    owned,
    manga.byVolume ? (manga.readVolume ?? null) : null,
    todayOf(),
  );
  if (!news) return null;
  const { book } = news;
  const name = `${line.label} ${book.number}`;
  const lastVolume = Math.max(...book.volumes);
  const to = book.isbn13 ? volumePath(book.isbn13, book.title ?? name) : null;
  if (!news.isOut) {
    if (asked.upcomingClosed("volume", lastVolume)) return null;
    return {
      headline: `${name} comes out ${preorderDay(news.day)}`,
      link: to ? { to, label: "Preorder" } : null,
      seen: { kind: "volume", number: lastVolume, upcoming: true },
      sellsIsbn: book.isbn13,
    };
  }
  if ((manga.seenVolume ?? 0) >= lastVolume) return null;
  const price = book.knownPriceCents;
  const label = price != null ? `Buy for ${formatCents(price)}` : "See prices";
  return {
    headline: `${name} is out!`,
    link: to ? { to, label } : null,
    seen: { kind: "volume", number: lastVolume, upcoming: false },
    sellsIsbn: book.isbn13,
  };
}

function volumeNews(asked: Asked): Release | null {
  const { manga, buyOptions, releaseStatus } = asked;
  if (asked.collectsEdition) return editionBookNews(asked);
  const whole = buyOptions.volumes.filter((v) => Number.isInteger(v.volume));
  const out = onSale(whole).sort(byNumber);
  const coming = whole.filter((v) => !out.includes(v)).sort(byNumber);
  // where they are: the furthest they own, or read when they keep their
  // place by volume without owning the books
  const place = Math.max(
    asked.highestOwned,
    manga.byVolume ? (manga.readVolume ?? 0) : 0,
  );
  // a gap before that is being behind, not news
  if (!place || buyOptions.gaps.length > 0) return null;
  const seen = manga.seenVolume ?? 0;

  // the catalog's list can be short (still loading, or a search that came
  // back thin) while the server knows a newer volume is out: its news, from
  // the server's own book, and never a preorder for what's already out
  const serverLatest = releaseStatus?.latestVolume ?? 0;
  if (serverLatest > (out.at(-1)?.volume ?? 0)) {
    const book = releaseStatus?.nextVolumeBook;
    if (
      place !== serverLatest - 1 ||
      releaseStatus?.nextVolume !== serverLatest ||
      !book ||
      seen >= serverLatest
    )
      return null;
    return {
      headline: `Vol. ${serverLatest} is out!`,
      link: { to: volumePath(book.isbn13, book.title), label: "See prices" },
      seen: { kind: "volume", number: serverLatest, upcoming: false },
      sellsIsbn: book.isbn13,
    };
  }
  const newest = out.at(-1);
  if (!newest) return null;

  if (place === newest.volume - 1) {
    if (seen >= newest.volume) return null;
    return {
      headline: `Vol. ${newest.volume} is out!`,
      link: buyLink(newest),
      seen: { kind: "volume", number: newest.volume, upcoming: false },
      sellsIsbn: newest.isbn13,
    };
  }
  const next = coming[0];
  if (
    place >= newest.volume &&
    next &&
    seen < next.volume &&
    !asked.upcomingClosed("volume", next.volume)
  ) {
    const day = preorderDay(next.published);
    return {
      headline: day
        ? `Vol. ${next.volume} comes out ${day}`
        : `Vol. ${next.volume} is coming`,
      link: preorderLink(next),
      seen: { kind: "volume", number: next.volume, upcoming: true },
      sellsIsbn: next.isbn13,
    };
  }
  return null;
}

// a chapter's news goes to the book that will hold it: the volume it's in
// when that's out or can be preordered, else the next volume coming
function chapterLink(asked: Asked) {
  const { buyOptions, releaseStatus } = asked;
  const holding = buyOptions.volumes.find(
    (v) => v.volume === releaseStatus?.nextChapterVolume,
  );
  if (holding)
    return onSale([holding]).length ? buyLink(holding) : preorderLink(holding);
  const coming = buyOptions.volumes
    .filter((v) => Number.isInteger(v.volume) && !onSale([v]).length)
    .sort(byNumber)[0];
  return coming ? preorderLink(coming) : null;
}

function chapterNews(asked: Asked): Release | null {
  const { manga, releaseStatus, releaseData } = asked;
  const read = manga.bookmark ?? 0;
  const latest = releaseStatus?.latestChapter ?? 0;
  if (!asked.tracksChapters || !read || !latest) return null;
  const seen = manga.seenChapter ?? 0;

  if (read === latest - 1 && seen < latest) {
    return {
      headline: `Ch. ${latest} is out!`,
      link: chapterLink(asked),
      seen: { kind: "chapter", number: latest, upcoming: false },
      sellsIsbn: null,
    };
  }
  // caught up: the next one, when it has a date still to come
  const next = releaseData?.chapter?.estimateRelease;
  const nextNumber = Number(next?.chapterNumber);
  const nextDay = next?.releaseDate ? new Date(next.releaseDate) : null;
  const when = formatReleaseDate(next?.releaseDate);
  if (
    read >= latest &&
    Number.isFinite(nextNumber) &&
    nextNumber > seen &&
    !asked.upcomingClosed("chapter", nextNumber) &&
    nextDay &&
    nextDay.getTime() > Date.now() &&
    when
  ) {
    return {
      headline: `Ch. ${nextNumber} expected ${when}`,
      link: chapterLink(asked),
      seen: { kind: "chapter", number: nextNumber, upcoming: true },
      sellsIsbn: null,
    };
  }
  return null;
}

export function releaseNews(asked: Asked) {
  if (!asked.releaseStatus || !asked.checksOn || asked.planned)
    return { release: null, hideNextTicket: false };
  const release = volumeNews(asked) ?? chapterNews(asked);
  // the bar sells the volume Buy next would: Buy next leaves it out,
  // unless it's Buy next's only ticket (the next is the newest)
  const { next, latest } = asked.buyOptions;
  const hideNextTicket = Boolean(
    release?.sellsIsbn &&
    next?.isbn13 === release.sellsIsbn &&
    next.isbn13 !== latest?.isbn13,
  );
  return { release, hideNextTicket };
}
