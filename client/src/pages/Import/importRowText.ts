// What a row of a book import says under its name: how the AniList match
// went, and for an omnibus what couldn't be counted. Pure, so the list only
// draws.
import { gapsIn, type BookSeries } from "../../lib/imports/bookImport";
import { ownedPhrase } from "../../lib/ownedVolumes";
import type { Match } from "../../store/bookImport";

// what the file says they have of a series AniList found
function whatTheyHave(s: BookSeries) {
  if (s.planned) return "Only on a to-read list";
  if (s.ownedVolumes) {
    // the exact list only when it has gaps; otherwise "up to" the count
    const ownedList = gapsIn(s.ownedList) ? s.ownedList! : [];
    return `Own ${ownedPhrase({ volumesOwned: s.ownedVolumes, ownedList })}`;
  }
  return `${s.books} book${s.books === 1 ? "" : "s"}`;
}

// why a series isn't on AniList, as far as we can tell
function notOnAniList(
  s: BookSeries,
  // the series a shorter name found, which this one was kept apart from
  apart: string | null,
  // they said so themselves, with Edit
  saidByThem: boolean,
) {
  if (saidByThem) return "You said it isn't on AniList";
  // their own backup: it was on their shelf, so it goes back all the same
  if (s.restore) return "Not on AniList. Kept, as it's from your backup";
  if (apart) return `Not on AniList, and not the same as ${apart}`;
  return s.lightNovel
    ? "Not on AniList"
    : "Not on AniList, so probably not manga";
}

// the line under a row's name
export function matchLine(
  s: BookSeries,
  // undefined: still matching; "failed": AniList couldn't be asked; null: not
  // on AniList; otherwise what it found
  match: Match | undefined,
  apart: string | null,
  saidNotOnAniList: boolean,
) {
  if (match === undefined) return "Matching…";
  if (match === "failed") return "Couldn't check AniList";
  if (match === null) return notOnAniList(s, apart, saidNotOnAniList);
  const kind = s.lightNovel ? "Light novel · " : "";
  return kind + whatTheyHave(s);
}

// how many unsure books are named before "and N more"
const NAMED = 3;

// "Vinland Saga Omnibus, Vol. 3" doesn't say which volumes it holds, so the
// count is a guess. Names the books, so nothing is left out without a word
export function omnibusNote(s: BookSeries) {
  const unsure = s.unsure ?? [];
  if (!unsure.length)
    return "Omnibus editions: check the volume count with Edit";
  const named = unsure.slice(0, NAMED).join("; ");
  const more =
    unsure.length > NAMED ? ` and ${unsure.length - NAMED} more` : "";
  const hold = unsure.length === 1 ? "it holds" : "they hold";
  return `Not counted yet: ${named}${more}. The file doesn't say which volumes ${hold}: add them with Edit`;
}
