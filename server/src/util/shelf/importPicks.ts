// A series a reader picked by hand for a title in their import (Edit on a
// row, "Death Note Black Edition" -> Death Note). Two things come of it:
//
//   - it's theirs: every later import of theirs, on any device, takes it
//     (sharedMatches.ts knownMatches puts their picks first)
//   - it's a vote: once AGREE_TO_SHARE readers have picked the same series
//     for the same title, it's a shared match for everyone, as if an import
//     had found it. One reader's mistake (or joke) never reaches anyone else
//
// The shared table keeps titles only as hashes and nothing about who; a
// pick is the reader's own data, deleted with their account.
import { prisma } from "../../config/prisma.js";
import { matchKey } from "./matchRule.js";
import {
  matchOf,
  mediaByIds,
  saveMatches,
  type Search,
  type SharedMatch,
} from "./sharedMatches.js";

// how many different readers must agree before a pick is everyone's
export const AGREE_TO_SHARE = 3;

// the series enough readers agree on for this title, or null
export async function agreedSeries(search: Search) {
  const key = matchKey(search.name, search.lightNovel, search.exactOnly);
  const votes = await prisma.importPick.groupBy({
    by: ["anilistId"],
    where: { key },
    _count: { userId: true },
  });
  const agreed = votes.find((v) => v._count.userId >= AGREE_TO_SHARE);
  return agreed?.anilistId ?? null;
}

// AniList's own entry for the agreed series, saved as the shared match. Its
// format has to fit the search (a novel title, a novel), as for any match
async function share(search: Search, anilistId: number) {
  const [media] = await mediaByIds([anilistId]);
  if (!media || (media.format === "NOVEL") !== search.lightNovel) return;
  await saveMatches([{ search, match: matchOf(media, search.name) }]);
}

// their pick for a title, or null to take it back (they undid the edit)
export async function savePick(
  userId: number,
  search: Search,
  match: SharedMatch | null,
) {
  const key = matchKey(search.name, search.lightNovel, search.exactOnly);
  if (!match) {
    await prisma.importPick.deleteMany({ where: { userId, key } });
    return;
  }
  const row = {
    anilistId: match.anilistId,
    malId: match.malId,
    name: match.name.slice(0, 300),
    cover: match.cover,
    pickedAt: new Date(),
  };
  await prisma.importPick.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, ...row },
    update: row,
  });
  const agreed = await agreedSeries(search);
  // asking AniList is left out of tests, as for told matches
  if (agreed && process.env.NODE_ENV !== "test")
    await share(search, agreed).catch((e: Error) =>
      console.error("Sharing an agreed import match failed:", e.message),
    );
}
