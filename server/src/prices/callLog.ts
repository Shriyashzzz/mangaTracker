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

export type MeteredApi = "ebay" | "cj" | "gbooks" | "impact";
type Who = "user" | "bg";

// the background jobs run "as background" (collector/fillShared.ts
// startEvery); anything else is a visitor's
const background = new AsyncLocalStorage<true>();
export const asBackground = <T>(run: () => Promise<T>) =>
  background.run(true, run);
export const inBackground = () => background.getStore() === true;

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
}
