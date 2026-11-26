// Who a SerpApi search is spent for. The volume and Canadian price routes run
// their lookup "as" the visitor (asSpender); every search that SerpApi
// answers is then added to that visitor's count (serpapiClient). A signed-in
// user's count is a column on users; anyone else is counted in
// guest_searches under a hash of their IP and browser, so the same visitor
// adds up through the month without their IP being kept.
//
// Two people opening the same volume at once share one search (service.ts,
// inFlight): it runs as whoever opened it first, so they're the one counted.
//
// Paid searches are guarded here too (mayPay, read by serpapiClient before
// every search): only for a visit Turnstile clearly passed (not one let
// through because Cloudflare couldn't be reached), and at most PAID_A_DAY a
// day for one visitor. A person browsing never gets near it; a script
// hammering the site stops there, not at the month's whole allowance
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { Request } from "express";
import config from "../config/config.js";
import { anyCallsLeft, claimApiCall } from "../models/apiAllowance.js";
import { clientIp } from "../util/clientIp.js";

export type Spender =
  { userId: number } | { visitor: string; userAgent: string | null };

// who a visit's searches are for, and whether it may spend paid ones
const spending = new AsyncLocalStorage<{ spender: Spender; mayPay: boolean }>();

// the same IP and browser give the same id all month, and nothing else can
// be read back out of it
export const visitorId = (ip: string, userAgent: string, secret: string) =>
  createHash("sha256")
    .update(`${secret}\n${ip}\n${userAgent}`)
    .digest("hex")
    .slice(0, 16);

export function spenderOf(req: Request): Spender {
  if (req.session.userId) return { userId: req.session.userId };
  const userAgent = req.get("user-agent") ?? "";
  return {
    visitor: visitorId(clientIp(req), userAgent, config.SECRET),
    userAgent: userAgent.slice(0, 300) || null,
  };
}

// `mayPay`: false for a visit not clearly a person's, whose check still
// asks the free stores
export const asSpender = <T>(
  spender: Spender,
  run: () => Promise<T>,
  mayPay = true,
) => spending.run({ spender, mayPay }, run);

// null outside a visitor's request (a script, a test)
export const currentSpender = () => spending.getStore()?.spender ?? null;

// paid searches one visitor (an account, or an anonymous browser) may spend
// in a day
export const PAID_A_DAY = 30;
const today = () => new Date().toISOString().slice(0, 10);
const monthOf = (day: string) => `${day.slice(0, 7)}-01`;
// "pd:u42:2026-11-25", "pd:v0123456789abcdef:2026-11-25" (api_usage's 40)
export const paidLabel = (spender: Spender, day = today()) =>
  `pd:${"userId" in spender ? `u${spender.userId}` : `v${spender.visitor}`}:${day}`;

// Whether a paid search may be spent now. Outside a visit (a script, the
// background, which never pays) it's not this guard's to refuse
export async function mayPay(): Promise<boolean> {
  const visit = spending.getStore();
  if (!visit) return true;
  if (!visit.mayPay) return false;
  const day = today();
  return anyCallsLeft(
    [paidLabel(visit.spender, day)],
    PAID_A_DAY,
    monthOf(day),
  ).catch(() => true);
}

// one paid search spent for this visit's visitor, on today's count
export async function notePaid() {
  const visit = spending.getStore();
  if (!visit) return;
  const day = today();
  await claimApiCall(
    paidLabel(visit.spender, day),
    // counted past the limit too (it's only read against PAID_A_DAY): a
    // number the column can hold
    1_000_000,
    monthOf(day),
  ).catch(() => {});
}
