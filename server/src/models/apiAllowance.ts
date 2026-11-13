// The monthly allowance of the paid and metered APIs: claiming a call,
// seeing what's left, and recording what was spent. Part of the price
// queries (priceQueries.ts lists the parts).
import type { Spender } from "../prices/spender.js";
import { prisma } from "../config/prisma.js";

// takes one call from this month's allowance; false once it's used up.
// A single statement, so two requests at once can't both take the last one
// `month` (YYYY-MM-01): the allowance's own month, when it doesn't follow the
// database's clock (eBay's days run on Pacific time). A limit of 0 allows none
export async function claimApiCall(
  provider: string,
  limit: number,
  month?: string,
) {
  const changed = await prisma.$executeRaw`
    INSERT INTO api_usage (provider, month, calls)
    SELECT ${provider}, COALESCE(${month ?? null}::date, date_trunc('month', now())::date), 1
    WHERE ${limit} > 0
    ON CONFLICT (provider, month) DO UPDATE
      SET calls = api_usage.calls + 1
      WHERE api_usage.calls < ${limit}
  `;
  return changed === 1;
}

// whether any of these providers still has searches this month, without
// claiming one
export async function anyCallsLeft(
  providers: string[],
  limit: number,
  month?: string,
) {
  if (!providers.length || limit <= 0) return false;
  const used = await prisma.$queryRaw<{ provider: string; calls: number }[]>`
    SELECT provider, calls FROM api_usage
    WHERE month = COALESCE(${month ?? null}::date, date_trunc('month', now())::date)
      AND provider = ANY(${providers})
  `;
  const calls = new Map(used.map((u) => [u.provider, u.calls]));
  return providers.some((p) => (calls.get(p) ?? 0) < limit);
}

// one search SerpApi answered, added to whoever it was spent for
export async function recordSearch(spender: Spender) {
  if ("userId" in spender) {
    // updateMany: an account deleted mid-search just matches nothing
    await prisma.user.updateMany({
      where: { id: spender.userId },
      data: { serpapiSearches: { increment: 1 } },
    });
    return;
  }
  await prisma.$executeRaw`
    INSERT INTO guest_searches (visitor, month, searches, user_agent)
    VALUES (${spender.visitor}, date_trunc('month', now())::date, 1, ${spender.userAgent})
    ON CONFLICT (visitor, month) DO UPDATE
      SET searches = guest_searches.searches + 1,
          user_agent = EXCLUDED.user_agent,
          last_at = now()
  `;
}

// the provider says this allowance is gone, whatever our own count thinks
export async function markApiSpent(
  provider: string,
  limit: number,
  month?: string,
) {
  await prisma.$executeRaw`
    INSERT INTO api_usage (provider, month, calls)
    VALUES (${provider}, COALESCE(${month ?? null}::date, date_trunc('month', now())::date), ${limit})
    ON CONFLICT (provider, month) DO UPDATE
      SET calls = GREATEST(api_usage.calls, ${limit})
  `;
}
