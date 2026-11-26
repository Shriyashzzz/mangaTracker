// Finding series with omnibus and deluxe editions that we don't know yet
// (prices/editionDiscovery.ts has the rules). Once an hour: the next search
// in turn (an edition's name and a publisher), up to two pages of Google
// Books, then AniList asked about up to three series in it that are new to
// us. Asking makes a series known (series_info), and the edition job
// (editionFiller.ts) builds its lines like any other's, so it shows on
// /editions and its series page in a day or so.
//
// Free: at most 48 of Google Books' thousand daily lookups (capped here, on
// top of the other jobs' own caps), and a few AniList questions an hour.
// Never a paid search. On with the other fillers (fillShared.ts)
import priceQueries from "../models/priceQueries.js";
import {
  newSeriesIn,
  searchInTurn,
  type EditionSearch,
} from "../prices/editionDiscovery.js";
import { googleEditionSearch } from "../prices/sources/googleBooksCatalog.js";
import { googleBackgroundLeft } from "../prices/callLog.js";
import { getSeriesInfo } from "../prices/sources/anilist.js";
import { normalize } from "../prices/stores/match.js";
import {
  fillSwitchOn,
  knownSeries,
  startEvery,
  triedLately,
} from "./fillShared.js";

const EVERY_MS = 60 * 60_000;
// pages of a search: 80 books is every edition book most lines have
const PAGES = 2;
// Google Books lookups a day for this job
const LOOKUPS_A_DAY = 48;
// new series asked about a run: AniList is shared with every page
const NEW_A_RUN = 3;

// a name AniList was asked about: not again for a month, whatever it said
const asked = triedLately(30 * 24 * 60 * 60 * 1000);
export const resetEditionFinder = () => asked.clear();

// every known series' names, normalized: its own and the others it goes by
async function knownNames() {
  const names = new Set<string>();
  for (const series of await knownSeries()) {
    names.add(normalize(series.name));
    for (const other of series.altNames ?? []) names.add(normalize(other));
  }
  return names;
}

// one run: the search in turn, and the new series it found that AniList
// knows. Says what it did, for the logs and the tests
export async function findEditionSeries(
  now = Date.now(),
  search: EditionSearch = searchInTurn(Math.floor(now / EVERY_MS)),
): Promise<"off" | "day used up" | { search: string; added: string[] }> {
  if (!fillSwitchOn()) return "off";
  // the background's share of Google used up: this job's own isn't taken
  if (!(await googleBackgroundLeft())) return "day used up";
  const day = new Date(now).toISOString().slice(0, 10);
  const titles: string[] = [];
  for (let page = 0; page < PAGES; page++) {
    const allowed = await priceQueries
      .claimApiCall(`gbfind:${day}`, LOOKUPS_A_DAY, `${day.slice(0, 7)}-01`)
      .catch(() => false);
    if (!allowed) {
      if (page === 0) return "day used up";
      break;
    }
    const books = await googleEditionSearch(
      search.words,
      search.publisher,
      page,
    );
    if (!books) break;
    titles.push(...books.map((book) => book.title));
    if (books.length < 40) break;
  }
  const fresh = newSeriesIn(titles, await knownNames()).filter((name) =>
    asked.isDue(normalize(name), now),
  );
  const added: string[] = [];
  for (const name of fresh.slice(0, NEW_A_RUN)) {
    asked.mark(normalize(name), now);
    // saved by AniList's answer (series_info): known from here on
    const info = await getSeriesInfo(name).catch(() => null);
    if (info) added.push(info.name);
  }
  return { search: `${search.words} · ${search.publisher}`, added };
}

let timer: ReturnType<typeof setInterval> | null = null;

// started by server.ts, never by the tests
export function startEditionFinder() {
  if (timer || !fillSwitchOn()) return;
  timer = startEvery("Edition finder", () => findEditionSeries(), {
    everyMs: EVERY_MS,
    firstAfterMs: 330_000,
  });
  console.log("Edition finder on: one edition search an hour");
}
