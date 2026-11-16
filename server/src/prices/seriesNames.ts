// The series names the site already knows (series_info, saved as series are
// looked up), for a typo AniList can't answer: AniList matches whole words,
// so "chainsw man" finds nothing there, but it's one slip from Chainsaw Man
// on this list. Read from the database at most once an hour and kept in
// memory: no new storage, no API calls, and a typo is checked without
// touching the database.
import { prisma } from "../config/prisma.js";
import { closeEnough, slipsInName } from "../util/shelf/spelling.js";

const REFRESH_MS = 60 * 60_000;
// names offered for one typo, closest first
const MOST = 3;

let names: string[] = [];
let loadedAt = 0;
let loading: Promise<void> | null = null;

async function load() {
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    SELECT DISTINCT info->>'name' AS name FROM series_info
    WHERE info->>'name' IS NOT NULL`;
  names = rows.map((row) => row.name);
  loadedAt = Date.now();
}

// the list, read again when it's an hour old (one read at a time)
async function knownNames() {
  if (Date.now() - loadedAt >= REFRESH_MS) {
    loading ??= load().finally(() => (loading = null));
    await loading;
  }
  return names;
}

// the known names a typo is near, closest first: every word typed is a
// word of the name, give or take a slip of the finger
export async function nearSeriesNames(typed: string) {
  return (await knownNames())
    .filter((name) => closeEnough(typed, name))
    .map((name) => ({ name, slips: slipsInName(typed, name) }))
    .sort((a, b) => a.slips - b.slips || a.name.length - b.name.length)
    .slice(0, MOST)
    .map((near) => near.name);
}

// for tests: the list as it is now, read again on the next ask
export const forgetSeriesNames = () => {
  loadedAt = 0;
};
