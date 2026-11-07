// A volume that isn't out yet ("2027-03-30" from Google Books): it can be
// preordered, but no store has prices worth paying a search for, so its
// pages skip the paid price checks and offer the preorder links instead
// the release date when it's still to come, else null. "2027-03" counts from
// the first of the month
export function notOutYet(published?: string | null, now = new Date()) {
  if (!published) return null;
  const [y, m, d] = published.split("-").map(Number);
  if (!y || !m) return null;
  return new Date(Date.UTC(y, m - 1, d || 1)) > now ? published : null;
}
