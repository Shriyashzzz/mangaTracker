// What the member card in the app shows a Collector or an early member:
// since when, the plan they pay for and whether it renews, and how many
// To buy books they were told about on sale. Only what's known is given.
import { prisma } from "../config/prisma.js";

export type Membership = {
  // when they first became a Collector, or, for an early member, when the
  // account was made ("account")
  since: string;
  sinceKind: "collector" | "account";
  period: "year" | "month" | null;
  // paid until (a Collector's), and whether Apple renews it then
  until: string | null;
  renews: boolean | null;
  // books they were alerted about on a price drop, each counted once
  caughtOnSale: number;
};

// the sent-alert records that are price drops: the weekly email's
// "drop:<isbn>" and the push alert's "push:drop:<isbn>"
const dropIsbn = (item: string) =>
  item.startsWith("drop:")
    ? item.slice(5)
    : item.startsWith("push:drop:")
      ? item.slice(10)
      : null;

export async function membershipFor(
  userId: number,
): Promise<Membership | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      createdAt: true,
      collectorSince: true,
      appleProduct: true,
      planUntil: true,
      planRenews: true,
    },
  });
  if (!user || (user.plan !== "collector" && user.plan !== "early"))
    return null;
  const sent = await prisma.digestItem.findMany({
    where: {
      userId,
      OR: [
        { item: { startsWith: "drop:" } },
        { item: { startsWith: "push:drop:" } },
      ],
    },
    select: { item: true },
  });
  const books = new Set(sent.map((s) => dropIsbn(s.item)).filter(Boolean));
  const paid = user.plan === "collector";
  const since =
    paid && user.collectorSince ? user.collectorSince : user.createdAt;
  return {
    since: since.toISOString(),
    sinceKind: paid && user.collectorSince ? "collector" : "account",
    period:
      user.appleProduct === "collector.yearly"
        ? "year"
        : user.appleProduct === "collector.monthly"
          ? "month"
          : null,
    until: paid && user.planUntil ? user.planUntil.toISOString() : null,
    renews: paid ? user.planRenews : null,
    caughtOnSale: books.size,
  };
}
