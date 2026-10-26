// tiny per-visitor limiter so one client can't burn through the free API
// quotas. In memory, so it resets on restart; good enough for one server
export function rateLimit({ max, windowMs }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
      res
        .status(429)
        .json({ error: [{ msg: "Slow down a little, then try again." }] });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    // forget idle visitors now and then so the map doesn't grow forever
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        if (now - times[times.length - 1] > windowMs) hits.delete(k);
      }
    }
    next();
  };
}
