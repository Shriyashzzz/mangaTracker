// A release date for reading, worked out when it's shown so it's never stale
// and is in the reader's own timezone: "Tomorrow", "In 3 days", "16th Nov 2026".
// null if there's no real date.
const ordinal = (day: number) => {
  if (day > 3 && day < 21) return `${day}th`;
  return `${day}${["th", "st", "nd", "rd"][day % 10] ?? "th"}`;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function formatReleaseDate(
  iso: string | null | undefined,
  now = new Date(),
) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const days = Math.round(
    (startOfDay(date) - startOfDay(now)) / (24 * 60 * 60 * 1000),
  );
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days <= 7) return `In ${days} days`;
  if (days < -1 && days >= -7) return `${-days} days ago`;

  const month = date.toLocaleString("en-US", { month: "short" });
  return `${ordinal(date.getDate())} ${month} ${date.getFullYear()}`;
}
