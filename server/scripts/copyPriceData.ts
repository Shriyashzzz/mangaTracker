// Copies price-checker data from one database to another: volumes, their
// price checks and samples, AniList series info and edition covers.
// Written to refill production from a local database after the 2026-10-27
// reset. Existing rows in the target are never changed (ON CONFLICT DO
// NOTHING), so it's safe to run twice.
//
//   npx tsx scripts/copyPriceData.ts --from <url> --to <url>            dry run
//   npx tsx scripts/copyPriceData.ts --from <url> --to <url> --apply    write
//   --to can be left out: it defaults to DATABASE_URL in server/.env
//   ... --user <username>   also copy that one account and its shelf
//
// Accounts are skipped unless asked for: local accounts are usually test ones.
import "dotenv/config";
import { Client } from "pg";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const from = arg("from");
// the target defaults to DATABASE_URL from server/.env
const to = arg("to") ?? process.env.DATABASE_URL;
const user = arg("user");
const apply = process.argv.includes("--apply");
if (!from || !to) {
  console.error("usage: --from <source url> --to <target url> [--user name] [--apply]");
  process.exit(1);
}

const hostOf = (url: string) => new URL(url).host;
const source = new Client({ connectionString: from, options: "-c timezone=UTC" });
const target = new Client({ connectionString: to, options: "-c timezone=UTC" });

// tables in dependency order, with the columns to copy
const TABLES: [table: string, columns: string[], key: string][] = [
  ["books", ["isbn13", "title", "authors", "publisher", "cover_url", "year", "updated_at"], "isbn13"],
  ["price_checks", ["isbn13", "checked_at", "sources"], "isbn13"],
  ["price_samples", ["isbn13", "store", "format", "condition", "price_cents", "currency", "in_stock", "url", "fetched_at"], ""],
  ["series_info", ["slug", "info", "fetched_at"], "slug"],
  ["edition_covers", ["isbn13", "cover_id", "checked_at"], "isbn13"],
];

async function exists(client: Client, table: string) {
  const { rows } = await client.query("SELECT to_regclass($1) IS NOT NULL AS ok", [table]);
  return rows[0].ok as boolean;
}

async function main() {
  await source.connect();
  await target.connect();
  console.log(`${apply ? "COPYING" : "DRY RUN"}: ${hostOf(from!)} -> ${hostOf(to!)}\n`);

  if (apply) await target.query("BEGIN");
  try {
    for (const [table, columns, key] of TABLES) {
      if (!(await exists(source, table))) {
        console.log(`${table}: not in source, skipped`);
        continue;
      }
      const { rows } = await source.query(`SELECT ${columns.join(", ")} FROM ${table}`);
      let added = 0;
      for (const row of rows) {
        const values = columns.map((c) => (c === "info" ? JSON.stringify(row[c]) : row[c]));
        const marks = columns.map((_, i) => `$${i + 1}`).join(", ");
        // price samples have no natural key: skip one already present
        const sql = key
          ? `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${marks}) ON CONFLICT (${key}) DO NOTHING`
          : `INSERT INTO price_samples (${columns.join(", ")})
             SELECT $1::char(13), $2::varchar, $3::varchar, $4::varchar, $5::int,
                    $6::char(3), $7::boolean, $8::text, $9::timestamptz
             WHERE NOT EXISTS (SELECT 1 FROM price_samples WHERE isbn13 = $1::char(13)
               AND store = $2::varchar AND condition = $4::varchar AND fetched_at = $9::timestamptz)`;
        if (apply) added += (await target.query(sql, values)).rowCount ?? 0;
      }
      console.log(`${table}: ${rows.length} in source${apply ? `, ${added} added` : ""}`);
    }

    if (user) {
      const { rows: users } = await source.query(
        "SELECT id, username, password, prefs FROM users WHERE username = $1",
        [user],
      );
      const u = users[0];
      if (!u) throw new Error(`no user ${user} in source`);
      const { rows: manga } = await source.query(
        "SELECT name, genre, description, image, status, bookmark, volumes_owned, rating FROM manga WHERE user_id = $1",
        [u.id],
      );
      console.log(`user ${user}: account + ${manga.length} manga`);
      if (apply) {
        const { rows: made } = await target.query(
          "INSERT INTO users (username, password, prefs) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING RETURNING id",
          [u.username, u.password, JSON.stringify(u.prefs)],
        );
        if (!made[0]) {
          console.log(`  ${user} already exists in target, shelf not copied`);
        } else {
          for (const m of manga) {
            await target.query(
              "INSERT INTO manga (user_id, name, genre, description, image, status, bookmark, volumes_owned, rating) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
              [made[0].id, m.name, m.genre, m.description, m.image, m.status, m.bookmark, m.volumes_owned, m.rating],
            );
          }
          console.log(`  copied`);
        }
      }
    }

    if (apply) await target.query("COMMIT");
    if (!apply) console.log("\nNothing written. Add --apply to copy.");
  } catch (e) {
    if (apply) await target.query("ROLLBACK");
    throw e;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
