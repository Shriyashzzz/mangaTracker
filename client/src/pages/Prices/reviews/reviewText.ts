// The words the review section says, kept apart from the drawing so they
// can be read (and tested) on their own. No imports.

// "1 reader", "12 readers"
export const readers = (count: number) =>
  `${count} reader${count === 1 ? "" : "s"}`;

// under the score: who these ratings are from
export const whoRated = (count: number) =>
  `${readers(count)} who ${count === 1 ? "owns or has" : "own or have"} read it`;

// "4.3", and "5" rather than "5.0"
export const scoreText = (average: number) =>
  Number.isInteger(average) ? String(average) : average.toFixed(1);

// a bar's share of the widest bar's room, as a percentage
export function barWidth(amount: number, spread: number[]) {
  const most = Math.max(...spread, 1);
  return `${Math.round((amount / most) * 100)}%`;
}

// when a review was written: "3 days ago" for a recent one, "Oct 28" for
// an older one, with the year once it isn't this one
const DAY_MS = 24 * 60 * 60_000;
export function writtenText(
  writtenAt: string,
  ago: (date: string) => string,
  now = new Date(),
) {
  const written = new Date(writtenAt);
  if (now.getTime() - written.getTime() < 7 * DAY_MS) return ago(writtenAt);
  const sameYear = written.getFullYear() === now.getFullYear();
  return written.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
