// What goes in a reader's weekly email, worked out from what's already
// saved: nothing here asks a store, a catalog or the database.
//
// Three kinds of news, each said once (an item's `key` is remembered in
// digest_items):
//   out    the next book of a series they collect came out lately
//   soon   their next book has a day, and it's near
//   drop   a volume on their To buy list costs clearly less than usual
//
// Only what is certain is said. A release needs its day in full
// ("2026-11-24"): a month alone, or no date, and nothing is claimed. News is
// for someone caught up, as on the New tab: a reader three books behind has
// a backlog, not news.
import { bookName, type EditionLine } from "../prices/editionLines.js";
import { editionPlaceOf } from "../util/shelf/editionPlace.js";
import type { ListedVolume } from "../collector/shelfMath.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// a book that came out up to this long ago is still news
export const NEW_FOR_DAYS = 45;
// a book due within this long is worth a line
export const SOON_WITHIN_DAYS = 60;
// a price counts as a drop at this share of the usual price or less, and
// when that saves at least a dollar
export const DROP_SHARE = 0.85;
export const DROP_LEAST_CENTS = 100;
// a price is only quoted if its store was asked this lately
export const PRICE_FRESH_DAYS = 3;
// the same volume's price isn't mailed again for this long
export const DROP_AGAIN_DAYS = 28;

// a series on their shelf, with what the saved lists know of it
export type DigestSeries = {
  mangaId: number;
  name: string;
  readVolume: number | null;
  // the volumes they own
  owned: number[];
  // the series' single volumes, as its saved list has them
  volumes: ListedVolume[];
  // the edition they collect it in, when they do
  line: EditionLine | null;
};

export type ReleaseItem = {
  key: string;
  kind: "out" | "soon";
  mangaId: number;
  series: string;
  // "Vol. 15", "VIZBIG 13"
  book: string;
  // the day it came out or comes out, "2026-11-24"
  day: string;
};

export type DropItem = {
  key: string;
  kind: "drop";
  isbn13: string;
  // "Vagabond, Vol. 12"
  title: string;
  cents: number;
  usualCents: number;
  store: string;
};

export type Digest = {
  out: ReleaseItem[];
  soon: ReleaseItem[];
  drops: DropItem[];
};

const fullDay = (published?: string | null) =>
  /^\d{4}-\d{2}-\d{2}$/.test(published ?? "") ? published! : null;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

// out lately, or due soon, or neither (null): by its day alone
function whenOf(day: string, today: string): "out" | "soon" | null {
  if (day <= today)
    return daysBetween(day, today) <= NEW_FOR_DAYS ? "out" : null;
  return daysBetween(today, day) <= SOON_WITHIN_DAYS ? "soon" : null;
}

// a series collected in single volumes: the volume after their furthest
function singleVolumeNews(
  series: DigestSeries,
  today: string,
): ReleaseItem | null {
  const whole = series.owned.filter((v) => Number.isInteger(v) && v >= 1);
  const furthest = Math.max(0, series.readVolume ?? 0, ...whole);
  // nothing of it yet: it isn't theirs to hear about
  if (furthest < 1) return null;
  const numbered = (n: number) => series.volumes.find((v) => v.volume === n);
  const day = fullDay(numbered(furthest + 1)?.published);
  if (!day) return null;
  const kind = whenOf(day, today);
  if (!kind) return null;
  // out, and the one after it is out too: they're behind, which isn't news.
  // (One after it with no day may be out as well, so nothing is claimed)
  const after = numbered(furthest + 2);
  if (kind === "out" && after) {
    const afterDay = fullDay(after.published);
    if (!afterDay || afterDay <= today) return null;
  }
  const volume = furthest + 1;
  return {
    key: `${kind}:${series.mangaId}:${volume}`,
    kind,
    mangaId: series.mangaId,
    series: series.name,
    book: `Vol. ${volume}`,
    day,
  };
}

// a series collected as an edition: the book after their furthest
function editionNews(
  series: DigestSeries,
  line: EditionLine,
  today: string,
): ReleaseItem | null {
  const place = editionPlaceOf(line, series.readVolume, series.owned, today);
  const day = fullDay(place.nextPublished);
  if (place.upTo == null || place.next == null || !day) return null;
  const kind = whenOf(day, today);
  if (!kind) return null;
  // out and the only one they lack; or coming, with every book out theirs
  if (place.behind !== (kind === "out" ? 1 : 0)) return null;
  return {
    key: `${kind}:${series.mangaId}:${line.key}${place.next}`,
    kind,
    mangaId: series.mangaId,
    series: series.name,
    book: bookName(line.label, place.next),
    day,
  };
}

export function releaseNews(shelf: DigestSeries[], today: string) {
  const items = shelf.flatMap((series) => {
    const item = series.line
      ? editionNews(series, series.line, today)
      : singleVolumeNews(series, today);
    return item ? [item] : [];
  });
  const byDay = (a: ReleaseItem, b: ReleaseItem) => a.day.localeCompare(b.day);
  return {
    // the newest out first; the soonest coming first
    out: items.filter((i) => i.kind === "out").sort((a, b) => byDay(b, a)),
    soon: items.filter((i) => i.kind === "soon").sort(byDay),
  };
}

// a volume on their To buy list, with its cheapest new copy on file
export type PricedVolume = {
  isbn13: string;
  title: string;
  cents: number;
  store: string;
  // when that store was last asked
  checkedAt: Date;
  // the volume's usual new price: the middle of every one saved. Null with
  // no history to compare against
  usualCents: number | null;
};

export function priceDrops(volumes: PricedVolume[], now: Date): DropItem[] {
  const freshSince = now.getTime() - PRICE_FRESH_DAYS * DAY_MS;
  return volumes
    .filter(
      (v) =>
        v.usualCents != null &&
        v.checkedAt.getTime() >= freshSince &&
        v.cents <= v.usualCents * DROP_SHARE &&
        v.usualCents - v.cents >= DROP_LEAST_CENTS,
    )
    .map((v) => ({
      key: `drop:${v.isbn13}`,
      kind: "drop" as const,
      isbn13: v.isbn13,
      title: v.title,
      cents: v.cents,
      usualCents: v.usualCents!,
      store: v.store,
    }))
    .sort((a, b) => b.usualCents - b.cents - (a.usualCents - a.cents));
}

// Less what they've been told already. A release is told once, ever. A
// price is told again only after a while: the same sale isn't news weekly
export function withoutSent(
  digest: Digest,
  sent: { item: string; sentAt: Date }[],
  now: Date,
): Digest {
  const sentAt = new Map(sent.map((s) => [s.item, s.sentAt.getTime()]));
  const dropAgainAfter = now.getTime() - DROP_AGAIN_DAYS * DAY_MS;
  return {
    out: digest.out.filter((i) => !sentAt.has(i.key)),
    soon: digest.soon.filter((i) => !sentAt.has(i.key)),
    drops: digest.drops.filter(
      (i) => (sentAt.get(i.key) ?? 0) < dropAgainAfter,
    ),
  };
}

export const isEmpty = (d: Digest) =>
  d.out.length + d.soon.length + d.drops.length === 0;
export const keysOf = (d: Digest) =>
  [...d.out, ...d.soon, ...d.drops].map((i) => i.key);

// the most lines of each kind one email carries: the rest wait for the site
export const MOST_PER_KIND = 8;
