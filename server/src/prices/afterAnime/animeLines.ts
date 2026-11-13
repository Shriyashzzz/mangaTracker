// Where an anime leaves its manga, read from MangaUpdates' two lines of text:
//   start: "Vol 1, Chap 1 (S1) / Vol 8, Chap 64 (S2)"
//   end:   "Vol 8, Chap 63 (S1) / Vol 16, Chap 137 (S2) Skips Chap 80-81"
// One stop per season (or film, or OVA) in the end line. The lines are typed
// by people, so nothing here guesses: a piece that names no volume and no
// chapter is left out, and a number that isn't there stays null.
// Pure rules, no fetching (that's animeSource.ts).

export type AnimeStop = {
  // "Season 2", "Reze Movie", or "The anime" when the line names none
  label: string;
  // the last volume and chapter it adapts
  endVolume: number | null;
  endChapter: number | null;
  // it stops partway through that chapter ("Chap 181 Page 14")
  endsMidChapter: boolean;
  // the first chapter to read after it
  nextChapter: number | null;
  // the volume that chapter is in, when the start line says; null when it
  // doesn't, and then it's endVolume or the one after
  nextVolume: number | null;
  // what else the line says: "Skips Chap 80-81"
  note: string;
};

// one piece of a line, as written
type Piece = {
  volume: number | null;
  chapter: number | null;
  page: number | null;
  inBrackets: string;
  rest: string;
};

// "Vol 8, Chap 63 Page 14 (S1) Skips Chap 2": every part is optional
const PIECE =
  /^(?:Vol\.?\s*(\d+))?[,\s]*(?:Chap\.?\s*(\d+(?:\.\d+)?))?\s*(?:Page\s*(\d+))?\s*(?:\(([^)]*)\))?\s*(.*)$/is;

// words that make a bracket a remark ("(Skips Chap 32)") and not a name
const REMARK = /skip|chap|adapt|abridg|ending|differ|omit/i;
const LONGEST_LABEL = 40;

const numberOrNull = (text: string | undefined) =>
  text === undefined ? null : Number(text);

// a line's pieces: seasons are set apart by a slash before the next "Vol" or
// "Chap" (a slash inside "(1989/2024)" is part of a name)
function piecesOf(line: string | null | undefined): Piece[] {
  if (!line) return [];
  const pieces: Piece[] = [];
  for (const part of line.split(/\s*\/\s*(?=Vol|Chap)/i)) {
    const found = PIECE.exec(part.trim());
    if (!found) continue;
    const piece: Piece = {
      volume: numberOrNull(found[1]),
      chapter: numberOrNull(found[2]),
      page: numberOrNull(found[3]),
      inBrackets: (found[4] ?? "").trim(),
      rest: (found[5] ?? "").trim(),
    };
    // it has to say where: a volume or a chapter
    if (piece.volume === null && piece.chapter === null) continue;
    pieces.push(piece);
  }
  return pieces;
}

// "S2" as "Season 2", "S1P2" as "Season 1 part 2", "TYBW P1" as "TYBW part
// 1", "EP4" as "episode 4"; anything else ("Reze Movie", "1996") as it's
// written
export function seasonName(short: string) {
  return (
    short
      .replace(/\bS(\d+)P(\d+)\b/g, "Season $1 part $2")
      .replace(/\bS(\d+)\b/g, "Season $1")
      .replace(/\bP(\d+)\b/g, "part $1")
      .replace(/\bEP\s*(\d+)/g, "episode $1")
      // a short name only fans read: Bleach's last arc
      .replace(/\bTYBW\b/g, "Thousand-Year Blood War")
      .replace(/\s+/g, " ")
      // a season with extras tacked on is that season: "Season 8 + More OVA"
      .replace(/^(Season \d+(?: part \d+)?)\s*\+.*$/, "$1")
      .trim()
  );
}

// the bracket is the season's name when it's short and isn't a remark
function isLabel(inBrackets: string) {
  if (!inBrackets) return false;
  if (inBrackets.length > LONGEST_LABEL) return false;
  return !REMARK.test(inBrackets);
}

// the first chapter to read: the same one when the anime stopped partway
// through it, or else the next whole one (after 22.5 comes 23)
function chapterAfter(piece: Piece) {
  if (piece.chapter === null) return null;
  if (piece.page !== null) return piece.chapter;
  return Math.floor(piece.chapter) + 1;
}

export function readAnimeStops(
  startLine: string | null | undefined,
  endLine: string | null | undefined,
): AnimeStop[] {
  const starts = piecesOf(startLine);
  const stops: AnimeStop[] = [];
  for (const piece of piecesOf(endLine)) {
    const named = isLabel(piece.inBrackets);
    const nextChapter = chapterAfter(piece);
    // the season that carries on from here says which volume that's in
    const carriesOn = starts.find(
      (start) =>
        nextChapter !== null &&
        start.chapter === nextChapter &&
        start.volume !== null,
    );
    // a bracket that's a remark is kept with the rest of what's said
    const remark = named ? "" : piece.inBrackets;
    const note = [remark, piece.rest].filter(Boolean).join(". ");
    stops.push({
      label: named ? seasonName(piece.inBrackets) : "The anime",
      endVolume: piece.volume,
      endChapter: piece.chapter,
      endsMidChapter: piece.page !== null,
      nextChapter,
      nextVolume: carriesOn?.volume ?? null,
      note: note.replace(/\s+/g, " ").trim(),
    });
  }
  return stops;
}

// what's known of the manga itself, for telling when an anime has adapted
// all of it
export type MangaEnd = {
  // AniList says it's finished, and how many volumes it ran to
  finished: boolean;
  volumes: number | null;
  // MangaUpdates' latest chapter. Often wrong (Bleach's says 250 of 686), so
  // it only counts when it agrees with where the anime stops
  lastChapter: number | null;
};

// the anime's chapter may run a few past the manga's count (an epilogue, a
// chapter numbered apart) and still be its end
const CHAPTERS_OF_SLACK = 5;

// whether this stop is the end of the manga, so there's nothing to carry on
// with. Only ever the furthest stop of a finished manga, and only when it
// reaches the final volume, or stops right at the last chapter. When in
// doubt it says no, and the page gives the next chapter as usual
export function reachesTheEnd(
  stop: AnimeStop,
  everyStop: AnimeStop[],
  manga: MangaEnd,
) {
  if (!manga.finished || stop.endsMidChapter) return false;
  const furthest = Math.max(...everyStop.map((each) => each.endChapter ?? 0));
  if (stop.endChapter === null || stop.endChapter < furthest) return false;
  const inFinalVolume =
    manga.volumes !== null &&
    stop.endVolume !== null &&
    stop.endVolume >= manga.volumes;
  const atLastChapter =
    manga.lastChapter !== null &&
    stop.endChapter >= manga.lastChapter &&
    stop.endChapter <= manga.lastChapter + CHAPTERS_OF_SLACK;
  return inFinalVolume || atLastChapter;
}
