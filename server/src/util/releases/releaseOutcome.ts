// What a release check came to. Only "failed" is worth asking again, and only
// it means a site didn't answer: the shelf says "Couldn't check right now"
// just when every check failed, and counts the not found ones separately.
export type ReleaseOutcome = "news" | "notFound" | "skipped" | "off" | "failed";

// a manga's check: MangaDex's dates, and the catalog's series (null when it
// doesn't have it, undefined when it failed or was slow)
export function mangaOutcome(
  dates: { ok: boolean; hasData: boolean },
  series: object | null | undefined,
): { outcome: ReleaseOutcome; complete: boolean } {
  const bothAnswered = dates.ok && series !== undefined;
  if (dates.hasData || series)
    return { outcome: "news", complete: bothAnswered };
  return bothAnswered
    ? { outcome: "notFound", complete: true }
    : { outcome: "failed", complete: false };
}
