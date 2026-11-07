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
