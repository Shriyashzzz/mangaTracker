// Fills the book import's shared matches (util/shelf/sharedMatches.ts) ahead of
// anyone importing: AniList's most popular manga and light novels, each under
// all its names, so a big library is mostly known from the very first import.
// Asked straight from AniList (free, slowly), so nothing needs checking.
//
//   npx tsx scripts/seedImportMatches.ts --db <url>            dry run
//   npx tsx scripts/seedImportMatches.ts --db <url> --apply    write
//   --manga 5000 --novels 1000: how many of each (these are the defaults)
//   --clear: delete every shared match first, imports' too. For after the
//            keys change (matchRule.ts MATCH_KEY_VERSION): rows from before
//            are never read again, and may hold a guess that was wrong
//   --db can be left out: it defaults to DATABASE_URL in server/.env
//
// Running it again refreshes what's there. A name two series share goes to the
// more popular one, as the import itself would pick.
import "dotenv/config";
import { Client } from "pg";
import { matchKey } from "../src/util/shelf/matchRule.js";
import {
  matchOf,
  namesOf,
  type Media,
} from "../src/util/shelf/sharedMatches.js";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const url = arg("db") ?? process.env.DATABASE_URL;
const apply = process.argv.includes("--apply");
const clear = process.argv.includes("--clear");
const MANGA = Number(arg("manga") ?? 5000);
const NOVELS = Number(arg("novels") ?? 1000);
if (!url) {
  console.error("usage: --db <database url> [--apply]");
  process.exit(1);
}

const PER_PAGE = 50;
const GAP_MS = 2500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// most popular first, the way the import searches: manga is anything but a novel
const PAGE_QUERY = `
  query ($page: Int, $novel: Boolean!) {
    manga: Page(page: $page, perPage: ${PER_PAGE}) @skip(if: $novel) {
      media(type: MANGA, format_not: NOVEL, sort: POPULARITY_DESC) { ...m }
    }
    novel: Page(page: $page, perPage: ${PER_PAGE}) @include(if: $novel) {
      media(type: MANGA, format: NOVEL, sort: POPULARITY_DESC) { ...m }
    }
  }
  fragment m on Media {
    id idMal format isAdult synonyms
    title { english romaji native }
    coverImage { extraLarge large }
  }
`;

async function page(n: number, novel: boolean): Promise<Media[]> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: PAGE_QUERY,
        variables: { page: n, novel },
      }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (res?.ok) {
      const { data } = (await res.json()) as {
        data: Record<"manga" | "novel", { media: Media[] } | null>;
      };
      return (novel ? data.novel : data.manga)?.media ?? [];
    }
    const wait = Number(res?.headers.get("Retry-After")) || 60;
    console.log(`  AniList ${res?.status ?? "unreachable"}: waiting ${wait}s`);
    await sleep(wait * 1000);
  }
  throw new Error(`AniList didn't answer for page ${n}`);
}

async function main() {
  const db = new Client({ connectionString: url });
  await db.connect();
  console.log(`${apply ? "WRITING" : "DRY RUN"}: ${new URL(url!).host}\n`);
  // key -> row; the first (most popular) series to claim a name keeps it
  const rows = new Map<string, ReturnType<typeof matchOf>>();
  const claim = (name: string, novel: boolean, m: Media) => {
    // an exact name fits both ways the import searches
    for (const exactOnly of [false, true]) {
      const key = matchKey(name, novel, exactOnly);
      if (!rows.has(key)) rows.set(key, matchOf(m, name));
    }
  };
  const later: { m: Media; novel: boolean }[] = [];
  for (const [novel, wanted] of [
    [false, MANGA],
    [true, NOVELS],
  ] as const) {
    let seen = 0;
    for (let n = 1; seen < wanted; n++) {
      const media = await page(n, novel);
      if (!media.length) break;
      for (const m of media) {
        // its titles now; its other names once every series' titles are in,
        // so one series' other name never takes another's title
        const titles = [m.title.english, m.title.romaji, m.title.native].filter(
          (t): t is string => Boolean(t && t.trim()),
        );
        for (const name of titles) claim(name, novel, m);
        later.push({ m, novel });
      }
      seen += media.length;
      console.log(
        `  ${novel ? "novels" : "manga"}: ${seen} series, ${rows.size} names so far`,
      );
      await sleep(GAP_MS);
    }
  }

  for (const { m, novel } of later) {
    for (const name of namesOf(m)) if (name.trim()) claim(name, novel, m);
  }

  const before = Number(
    (await db.query("SELECT count(*) FROM import_matches")).rows[0].count,
  );
  if (clear) {
    console.log(
      `${before} shared matches ${apply ? "deleted" : "would be deleted"} first`,
    );
  }
  if (apply) {
    // all or nothing: a failure partway leaves the table as it was, not empty
    await db.query("BEGIN");
    try {
      if (clear) await db.query("DELETE FROM import_matches");
      const all = [...rows.entries()];
      for (let i = 0; i < all.length; i += 500) {
        const part = all.slice(i, i + 500);
        const values = part
          .map(
            (_, j) =>
              `($${j * 5 + 1}, $${j * 5 + 2}, $${j * 5 + 3}, $${j * 5 + 4}, $${j * 5 + 5}, now())`,
          )
          .join(", ");
        await db.query(
          `INSERT INTO import_matches (key, anilist_id, mal_id, name, cover, checked_at)
           VALUES ${values}
           ON CONFLICT (key) DO UPDATE SET anilist_id = EXCLUDED.anilist_id,
             mal_id = EXCLUDED.mal_id, name = EXCLUDED.name, cover = EXCLUDED.cover,
             checked_at = EXCLUDED.checked_at`,
          part.flatMap(([key, r]) => [
            key,
            r.anilistId,
            r.malId,
            r.name.slice(0, 300),
            r.cover,
          ]),
        );
      }
      await db.query("COMMIT");
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    }
  }
  console.log(`\n${rows.size} names ${apply ? "written" : "would be written"}`);
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
