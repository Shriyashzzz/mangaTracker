// What a series' page says about new releases, worked out from what's loaded:
// how many books the little shelf draws, the red "it's out" bar, what the bar
// offers to buy, and the list it opens to. No requests are made here.
import { onSale } from "../../lib/releaseDate";
import { formatReleaseDate } from "../../lib/releaseDates";
import {
  formatCents,
  priceName,
  seriesPath,
  volumePath,
} from "../../lib/prices";
import { ownedPhrase } from "../../lib/ownedVolumes";
import type { Manga, ReleaseStatus } from "../../lib/types";
import type { Group, Row } from "./ReleaseBar";
import type { BuyOptions } from "./useBuyOptions";

type Volume = BuyOptions["volumes"][number];

// the most the shelf ever draws
const MOST_BOOKS = 999;
// how many volumes a list in the bar shows before "+3 more"
const BAR_ROWS = 6;

// how many books the shelf holds: the most we know is out, and never fewer
// than they own. Until that's known, theirs and a few to tick next
export function shelfSize(
  highestOwned: number,
  releaseStatus: ReleaseStatus | null,
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
      releaseStatus?.latestVolume ?? 0,
      buyOptions.latest?.volume ?? 0,
      coming.length ? firstComing - 1 : 0,
    ),
  );
  const size =
    knownOut > 0
      ? Math.max(knownOut, highestOwned)
      : Math.max(highestOwned + 3, 10);
  return Math.min(MOST_BOOKS, size);
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

// the bar's headline: what's out, and where they are beside it
export type Release = {
  // "Vol. 25" or "Ch. 250"
  what: string;
  kind: "volume" | "chapter";
  // "you own up to vol. 24"; null when there's nothing to say
  yours: string | null;
};

type Asked = {
  manga: Manga;
  releaseStatus: ReleaseStatus | null;
  buyOptions: BuyOptions;
  // they collect an omnibus or deluxe line, not single volumes
  collectsEdition: boolean;
  // release checks are switched on in Settings
  checksOn: boolean;
  planned: boolean;
  finished: boolean;
  // they came from the shelf's In Japan tab
  inJapan: boolean;
  // they came about a chapter, not a volume
  chapterNews: boolean;
  tracksChapters: boolean;
  highestOwned: number;
};

// the red bar: only what's next for them, and what they came here about
function releaseOf(asked: Asked): Release | null {
  const { manga, releaseStatus, inJapan } = asked;
  if (!releaseStatus || !asked.checksOn || asked.planned) return null;

  // owning and reading aren't the same, so say which it is
  const owns = ownedPhrase(manga);
  let volumeYours: string | null = null;
  if (owns) volumeYours = `you own ${owns}`;
  else if (releaseStatus.currentVolume)
    volumeYours = `you're on vol. ${releaseStatus.currentVolume}`;

  if (inJapan) {
    if (!releaseStatus.hasNewJapaneseVolume) return null;
    return {
      what: `Vol. ${releaseStatus.latestJapaneseVolume}`,
      kind: "volume",
      yours: volumeYours,
    };
  }
  const aboutAChapter = asked.chapterNews && !asked.finished;
  if (aboutAChapter) {
    if (!releaseStatus.hasNewChapter) return null;
    const onChapter = asked.tracksChapters && manga.bookmark;
    return {
      what: `Ch. ${releaseStatus.latestChapter}`,
      kind: "chapter",
      yours: onChapter ? `you're on ch. ${manga.bookmark}` : null,
    };
  }
  if (!releaseStatus.isNextVolumeOut) return null;
  return {
    what: `Vol. ${releaseStatus.latestVolume}`,
    kind: "volume",
    yours: volumeYours,
  };
}

// the button's words: the volume is named when it isn't the one in the
// headline, and the price is said when we know one
function buyLabel(toBuy: Volume, headlineVolume: number | null | undefined) {
  const isAnotherVolume = toBuy.volume !== headlineVolume;
  if (toBuy.knownPriceCents == null)
    return isAnotherVolume ? `Check vol. ${toBuy.volume}` : "Check price";
  const price = formatCents(toBuy.knownPriceCents);
  return isAnotherVolume
    ? `Buy vol. ${toBuy.volume} for ${price}`
    : `Buy for ${price}`;
}

// what the bar opens to on an English volume: English releases only, each a
// way to its prices. What's out past the furthest they own (a few, then the
// rest behind one link), and what's coming with its date
function englishGroups(asked: Asked): Group[] {
  const { buyOptions, manga } = asked;
  const pastMine = buyOptions.volumes
    .filter((v) => Number.isInteger(v.volume) && v.volume > asked.highestOwned)
    .sort((a, b) => a.volume - b.volume);
  const out = onSale(pastMine);
  const coming = pastMine.filter((v) => !out.includes(v));

  const outRows: Row[] = out.slice(0, BAR_ROWS).map((v) => ({
    what: `Vol. ${v.volume}`,
    when:
      v.knownPriceCents != null
        ? `from ${formatCents(v.knownPriceCents)}`
        : "Check price",
    to: volumePath(v.isbn13, v.title),
    compare: true,
  }));
  if (out.length > BAR_ROWS) {
    const seriesTo = seriesPath(buyOptions.seriesName || priceName(manga));
    outRows.push({
      what: `+${out.length - BAR_ROWS} more`,
      when: "See them all",
      to: `${seriesTo}&toget=1`,
      compare: true,
    });
  }
  const comingRows: Row[] = coming.slice(0, BAR_ROWS).map((v) => ({
    what: `Vol. ${v.volume}`,
    when: preorderDay(v.published),
    to: volumePath(v.isbn13, v.title),
    compare: false,
  }));

  const groups: Group[] = [];
  if (outRows.length) groups.push({ title: "Out in English", rows: outRows });
  if (comingRows.length)
    groups.push({ title: "Preorder in English", rows: comingRows });
  return groups;
}

export function releaseNews(asked: Asked) {
  const { buyOptions, releaseStatus } = asked;
  const release = releaseOf(asked);

  // an English volume release can be bought from the bar: the one they need
  // next, named if that's not the one in the headline
  const aboutAChapter = asked.chapterNews && !asked.finished;
  const sellsVolume =
    release !== null &&
    !asked.inJapan &&
    !aboutAChapter &&
    !buyOptions.caughtUp &&
    // collecting an edition: the single volume is news, not theirs to buy
    !asked.collectsEdition;
  const toBuy = sellsVolume ? (buyOptions.next ?? buyOptions.latest) : null;
  // the newest is Buy it's own ticket already: the bar doesn't sell it twice
  const barSells = toBuy && toBuy.isbn13 !== buyOptions.latest?.isbn13;
  const barBuy = barSells
    ? {
        to: volumePath(toBuy.isbn13, toBuy.title),
        label: buyLabel(toBuy, releaseStatus?.latestVolume),
      }
    : null;

  const groups = englishGroups(asked);
  const barEnglish = sellsVolume || groups.length ? { groups } : null;

  // no need to sell the next one twice, unless it's the only ticket there is
  const nextIsNotTheNewest =
    buyOptions.next && buyOptions.next.isbn13 !== buyOptions.latest?.isbn13;
  const hideNextTicket = Boolean(barBuy && nextIsNotTheNewest);

  return { release, barBuy, barEnglish, hideNextTicket };
}
