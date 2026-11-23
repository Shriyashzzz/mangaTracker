// The Collector tier: what a free account may do, and what paying adds.
// The rules only, with nothing looked up, so they can be tested alone and
// the app can be told exactly what the server will allow (plan.ts).
//
// Free keeps what makes the app worth recommending: tracking, editions,
// importing, prices, "out now" alerts, sharing, export. Collector is for
// the people who lean on it: a shelf past 100 series, the scanner past 80
// books, price alerts on more than 3 To buy books, alerts for what's coming
// and for preorders, the whole release calendar, and In Japan.
//
// Two promises: nothing already on a shelf is ever locked (a limit only
// stops adding more), and an account made before the tier existed ("early")
// is never limited.

export type Plan = "free" | "collector" | "early";
export type Platform = "ios" | "android" | "web";

export const LIMITS = { series: 100, scans: 80, priceAlerts: 3 } as const;
export type Counted = keyof typeof LIMITS;

// the plan an account is on today: a paid one that has run out is free
export function planOf(
  account: { plan: string; planUntil: Date | null },
  now = new Date(),
): Plan {
  if (account.plan === "early") return "early";
  if (account.plan === "collector")
    return !account.planUntil || account.planUntil > now ? "collector" : "free";
  return "free";
}

// where the limits are switched on (config COLLECTOR_LIMITS_ON: "ios",
// "ios,android"); nothing listed means nowhere
export const limitedPlatforms = (setting: string | undefined) =>
  new Set(
    (setting ?? "")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter((name): name is Platform =>
        ["ios", "android", "web"].includes(name),
      ),
  );

// whether this account, on this device, is held to the limits
export const isLimited = (plan: Plan, platform: Platform, on: Set<Platform>) =>
  plan === "free" && on.has(platform);

export type Used = Record<Counted, number>;

// What the app is told: the plan, each limit beside what's used of it, and
// the extras. `limits` is null when nothing is limited
export function entitlements(plan: Plan, limited: boolean, used: Used) {
  return {
    plan,
    limited,
    limits: limited ? LIMITS : null,
    used,
    // Collector's extras, open to everyone while nothing is limited
    soonAlerts: !limited,
    calendar: !limited,
    japan: !limited,
  };
}
export type Entitlements = ReturnType<typeof entitlements>;

// whether one more of a counted thing is allowed
export const hasRoom = (plan: Entitlements, what: Counted, adding = 1) =>
  !plan.limited || plan.used[what] + adding <= LIMITS[what];

// what's said when there's no room, by what was being added
export const FULL: Record<Counted, string> = {
  series: `A free shelf holds ${LIMITS.series} series. Premium has no limit.`,
  scans: `You've scanned ${LIMITS.scans} books, all a free account has. Premium has no limit.`,
  priceAlerts: `A free account watches ${LIMITS.priceAlerts} prices. Premium watches them all.`,
};
