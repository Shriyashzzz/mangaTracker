// Helper to add ordinal suffixes (1st, 2nd, 3rd, 4th, etc.)
function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export function formatReleaseDate(dateString: string | undefined): string {
  if (!dateString) return "undefined";
  const targetDate = new Date(dateString);
  const now = new Date();

  // Get difference in calendar days
  const diffTime = targetDate.getTime() - now.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const absDays = Math.abs(diffDays);

  // If within 7 days, return relative format
  if (absDays <= 7) {
    if (diffDays === 0) return "Today";
    if (diffDays === -1) return "Yesterday";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 0) return `${absDays} days ago`;
    return `In ${absDays} days`;
  }

  // If greater than 7 days, format as "16th Nov 2026"
  const dayNum = targetDate.getDate();
  const dayFormatted = getOrdinalSuffix(dayNum);
  const month = targetDate.toLocaleString("en-US", { month: "short" });
  const year = targetDate.getFullYear();

  return `${dayFormatted} ${month} ${year}`;
}
