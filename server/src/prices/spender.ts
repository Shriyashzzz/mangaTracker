// Who a SerpApi search is spent for. The volume and Canadian price routes run
// their lookup "as" the visitor (asSpender); every search that SerpApi
// answers is then added to that visitor's count (serpapiClient). A signed-in
// user's count is a column on users; anyone else is counted in
// guest_searches under a hash of their IP and browser, so the same visitor
// adds up through the month without their IP being kept.
//
// Two people opening the same volume at once share one search (service.ts,
// inFlight): it runs as whoever opened it first, so they're the one counted.
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { Request } from "express";
import config from "../config/config.js";

export type Spender =
  { userId: number } | { visitor: string; userAgent: string | null };

const spending = new AsyncLocalStorage<Spender>();

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
    visitor: visitorId(req.ip ?? "", userAgent, config.SECRET),
    userAgent: userAgent.slice(0, 300) || null,
  };
}

export const asSpender = <T>(spender: Spender, run: () => Promise<T>) =>
  spending.run(spender, run);

// null outside a visitor's request (a script, a test)
export const currentSpender = () => spending.getStore() ?? null;
