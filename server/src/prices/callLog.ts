// Who calls the metered APIs, and how much, five minutes at a time: visitors
// (opening pages) apart from the background jobs. The nightly sweep reads
// it to leave visitors their share and to stand aside when they get busy;
// the daily allowances themselves are still counted where they always were
// (ebay:<day>, cj:<day>, in api_usage).
//
//   ebay     eBay's Browse API, both countries
//   cj       Books-A-Million through CJ
//   gbooks   Google Books: the catalog, ebook prices and covers. Also counted
//            per Pacific day (gbooks:<day>), its quota's day
//   impact   Better World Books through Impact, a request at a time
//
// A row per API, per who, per five minutes ("ebay:user:2026-11-15T22:05"),
// in api_usage beside the daily counts. Rows older than 3 days are cleared.
// Counting never gets in the way of a call: a failure to count is ignored.
import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "../config/prisma.js";
import { anyCallsLeft, claimApiCall } from "../models/apiAllowance.js";

export type MeteredApi = "ebay" | "cj" | "gbooks" | "impact";
type Who = "user" | "bg";

// the background jobs run "as background" (collector/fillShared.ts
// startEvery), under their own name; anything else is a visitor's
const background = new AsyncLocalStorage<string>();
export const asBackground = <T>(run: () => Promise<T>, job = "background") =>
  background.run(jobKey(job), run);
export const inBackground = () => background.getStore() !== undefined;

// a job's name as its count is kept: "Edition lines" -> "edition-lines"
// (api_usage's labels are 40 letters at most)
const jobKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "background";

// Google Books calls a day by who made them, a background job by its name
// or "visitors" ("gbj:edition-lines:2026-11-25"), for the daily report
// (googleBooksReport): its quota runs out, and this says where it went
const GBOOKS_JOB = "gbj:";
const gbooksJobLabel = (who: string, day: string) =>
  `${GBOOKS_JOB}${who}:${day}`;

const SLOT_MS = 5 * 60_000;
const slotOf = (at: number) => Math.floor(at / SLOT_MS) * SLOT_MS;
// "2026-11-15T22:05": sorts in time order, so a range of slots is a range of
// labels
const slotLabel = (api: MeteredApi, who: Who, slot: number) =>
  `${api}:${who}:${new Date(slot).toISOString().slice(0, 16)}`;
const monthOfSlot = (slot: number) =>
  `${new Date(slot).toISOString().slice(0, 7)}-01`;

// Google Books' quota day is Pacific time, like eBay's
const pacificDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
});
export const gbooksDay = (at = new Date()) => pacificDay.format(at);
export const gbooksLabel = (day = gbooksDay()) => `gbooks:${day}`;

const add = (provider: string, month: string, calls: number) =>
  prisma.$executeRaw`
    INSERT INTO api_usage (provider, month, calls)
    VALUES (${provider}, ${month}::date, ${calls})
    ON CONFLICT (provider, month) DO UPDATE
      SET calls = api_usage.calls + ${calls}
  `;

// counts calls just made (or about to be). Never throws
export async function noteCall(api: MeteredApi, calls = 1, at = Date.now()) {
  const who: Who = inBackground() ? "bg" : "user";
  const slot = slotOf(at);
  try {
    await add(slotLabel(api, who, slot), monthOfSlot(slot), calls);
    if (api === "gbooks") {
      const day = gbooksDay(new Date(at));
      await add(gbooksLabel(day), `${day.slice(0, 7)}-01`, calls);
      await add(
        gbooksJobLabel(background.getStore() ?? "visitors", day),
        `${day.slice(0, 7)}-01`,
        calls,
      );
    }
  } catch (e) {
    console.warn("Couldn't count a call:", (e as Error).message);
  }
  forgetOldSlots(at);
}

// calls one side made since then (whole five-minute slots), for the sweep
export async function callsSince(
  api: MeteredApi,
  who: Who,
  since: number,
  now = Date.now(),
) {
  const rows = await prisma.$queryRaw<{ calls: bigint | null }[]>`
    SELECT SUM(calls) AS calls FROM api_usage
    WHERE provider >= ${slotLabel(api, who, slotOf(since))}
      AND provider <= ${slotLabel(api, who, slotOf(now))}
  `;
  return Number(rows[0]?.calls ?? 0);
}

// Google Books calls today (its Pacific day), visitors and background
export async function gbooksToday(day = gbooksDay()) {
  const row = await prisma.apiUsage.findUnique({
    where: {
      provider_month: {
        provider: gbooksLabel(day),
        month: new Date(`${day.slice(0, 7)}-01`),
      },
    },
  });
  return row?.calls ?? 0;
}

// the five-minute rows are only needed for a few days
const KEEP_MS = 3 * 24 * 60 * 60_000;
const FORGET_EVERY_MS = 6 * 60 * 60_000;
let forgotAt = 0;
function forgetOldSlots(now: number) {
  if (now - forgotAt < FORGET_EVERY_MS) return;
  forgotAt = now;
  const cutoff = new Date(now - KEEP_MS).toISOString().slice(0, 16);
  prisma.$executeRaw`
    DELETE FROM api_usage
    WHERE provider ~ '^(ebay|cj|gbooks|impact):(user|bg):'
      AND split_part(provider, ':', 3) || ':' || split_part(provider, ':', 4) < ${cutoff}
  `.catch(() => {});
  // the daily Google Books counts by who: a month is plenty
  const monthAgo = new Date(now - 30 * 24 * 60 * 60_000)
    .toISOString()
    .slice(0, 10);
  prisma.$executeRaw`
    DELETE FROM api_usage
    WHERE provider LIKE ${`${GBOOKS_JOB}%`}
      AND split_part(provider, ':', 3) < ${monthAgo}
  `.catch(() => {});
}

// One day's Google Books calls by who made them, most first:
// "series-lists 470, edition-lines 410, visitors 190"
export async function gbooksByWho(day: string) {
  const rows = await prisma.$queryRaw<{ provider: string; calls: number }[]>`
    SELECT provider, calls FROM api_usage
    WHERE provider LIKE ${`${GBOOKS_JOB}%:${day}`}
    ORDER BY calls DESC
  `;
  return rows.map((r) => ({
    who: r.provider.slice(GBOOKS_JOB.length, -day.length - 1),
    calls: Number(r.calls),
  }));
}

// Once a Pacific day has ended, its Google Books calls are written to the
// log by who made them. Looked at every hour; a restart may say a day twice
let reportedDay = "";
export async function googleBooksReport(now = new Date()) {
  const yesterday = gbooksDay(new Date(now.getTime() - 24 * 60 * 60_000));
  if (reportedDay === yesterday) return;
  // marked once read: a failed read is tried again the next hour
  const byWho = await gbooksByWho(yesterday);
  reportedDay = yesterday;
  if (!byWho.length) return;
  const total = byWho.reduce((sum, r) => sum + r.calls, 0);
  console.log(
    `Google Books on ${yesterday}: ${total} calls (${byWho
      .map((r) => `${r.who} ${r.calls}`)
      .join(", ")})`,
  );
}

// the report, looked at every hour from when the server starts
export function startGoogleBooksReport() {
  const run = () =>
    googleBooksReport().catch((e: Error) =>
      console.error("Google Books report failed:", e.message),
    );
  setTimeout(run, 3 * 60_000).unref();
  setInterval(run, 60 * 60_000).unref();
}

// Google Books' 1,000 free calls a day, shared: the background jobs (series
// lists, edition lines, gap and detail lookups...) may use this many of a
// Pacific day between them, and visitors always keep the rest. Before it
// ran out by midday most days, and every page built after that missed
// Google's volumes for six hours
export const GOOGLE_BACKGROUND_DAILY = 600;
export const gbooksBackgroundLabel = (day = gbooksDay()) => `gbooks-bg:${day}`;

// Whether a Google Books call may be made now, counted when it may (every
// call to Google goes through here). A visitor's always may; a background
// job's only while the background's share of the day is left. A "no" is
// handled as Google's own "used up for now"
export async function mayCallGoogle(): Promise<boolean> {
  if (inBackground()) {
    const day = gbooksDay();
    const left = await claimApiCall(
      gbooksBackgroundLabel(day),
      GOOGLE_BACKGROUND_DAILY,
      `${day.slice(0, 7)}-01`,
    ).catch(() => true);
    if (!left) return false;
  }
  void noteCall("gbooks");
  return true;
}

// whether the background jobs have any of today's Google share left: a job
// whose turn needs Google waits for tomorrow rather than start and fail
export function googleBackgroundLeft() {
  const day = gbooksDay();
  return anyCallsLeft(
    [gbooksBackgroundLabel(day)],
    GOOGLE_BACKGROUND_DAILY,
    `${day.slice(0, 7)}-01`,
  ).catch(() => true);
}
