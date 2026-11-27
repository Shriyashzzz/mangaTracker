import type { RequestHandler } from "express";
import { clientIp } from "../util/clientIp.js";

// tiny per-visitor limiter so one client can't burn through the free API
// quotas. In memory, so it resets on restart; good enough for one server
// `counts`: which finished requests count toward the limit, by their status
// and what the route noted in res.locals (sign-up counts only accounts made,
// so typos don't lock anyone out). Without it every request counts.
// `refuse`: how to say no; a JSON 429 unless given (a page the browser was
// sent to, such as Apple's return, says it with a redirect)
export function rateLimit({
  max,
  windowMs,
  counts,
  refuse,
}: {
  max: number;
  windowMs: number;
  counts?: (status: number, locals: Record<string, unknown>) => boolean;
  refuse?: RequestHandler;
}): RequestHandler {
  const hits = new Map<string, number[]>();
  return (req, res, next) => {
    const now = Date.now();
    const key = clientIp(req);
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
      if (refuse) {
        refuse(req, res, next);
        return;
      }
      res
        .status(429)
        .json({ error: [{ msg: "Slow down a little, then try again." }] });
      return;
    }
    // counted as it arrives, so requests sent at the same moment can't all
    // slip under the limit; with `counts`, taken back off once it's
    // answered if it doesn't count (a sign-up that failed)
    recent.push(now);
    hits.set(key, recent);
    if (counts)
      res.on("finish", () => {
        if (counts(res.statusCode, res.locals)) return;
        const times = hits.get(key);
        const at = times?.indexOf(now) ?? -1;
        if (at >= 0) times!.splice(at, 1);
      });
    // forget idle visitors now and then so the map doesn't grow forever
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        const last = times[times.length - 1];
        if (last === undefined || now - last > windowMs) hits.delete(k);
      }
    }
    next();
  };
}
