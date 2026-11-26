// A volume's release date ("2027-03-30", or "2014-05") from the series list:
// one still to come is a preorder. It isn't on sale yet, so it isn't "next to
// buy", the newest out, or part of what finishing the series costs. Pure, so
// the server's tests load it
export function notOutYet(published?: string | null, now = new Date()) {
  if (!published) return false;
  const [y, m, d] = published.split("-").map(Number);
  if (!y || !m) return false;
  return new Date(y, m - 1, d || 1).getTime() > now.getTime();
}

export const onSale = <T extends { published?: string }>(volumes: T[]) =>
  volumes.filter((v) => !notOutYet(v.published));

// how long a volume that's out is news, as the email digest has it
// (server digest/digestRules.ts NEW_FOR_DAYS)
const NEWS_FOR_DAYS = 45;
// whether a volume came out longer ago than that, by its full release day.
// Only a full day says so: a month alone, or no date, isn't known to be old.
// An old volume a list only now gained (a collector's list filling a gap)
// is one to get, not news
export function outLongAgo(published?: string | null, now = new Date()) {
  const [y, m, d] = (published ?? "").split("-").map(Number);
  if (!y || !m || !d) return false;
  const day = new Date(y, m - 1, d).getTime();
  return now.getTime() - day > NEWS_FOR_DAYS * 24 * 60 * 60 * 1000;
}
