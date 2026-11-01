// src/util/estimateNextChapter.ts
// Estimates the next chapter release for a MangaDex manga.
const MangaDexBaseUrl = "https://api.mangadex.org";
const DAY = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 60 * 60 * 1000; // smaller gaps mean chapters were bulk-uploaded, so they say nothing

export type ChapterEstimate = {
  method: "scheduled" | "estimated" | "none";
  nextChapter: string | null;
  estimatedAt: Date | null;
  confidence: "exact" | "high" | "medium" | "low" | "none";
  note: string;
};

type FeedChapter = {
  attributes: { chapter: string | null; publishAt: string };
};

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function mode<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

async function getFeed(
  seriesId: string,
  params: Array<[string, string]>,
): Promise<FeedChapter[]> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${MangaDexBaseUrl}/manga/${seriesId}/feed?${qs}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`MangaDex feed request failed: ${res.status}`);
  const json = (await res.json()) as { data?: FeedChapter[] };
  return json.data ?? [];
}

export async function estimateNextChapter(
  seriesId: string,
  language = "en",
  sampleSize = 20,
): Promise<ChapterEstimate> {
  const now = new Date();

  // 1) Already scheduled on MangaDex -> exact date.
  const futureRaw = await getFeed(seriesId, [
    ["translatedLanguage[]", language],
    ["order[publishAt]", "asc"],
    ["includeFuturePublishAt", "1"],
    ["includeExternalUrl", "1"],
    ["limit", "10"],
  ]);
  const scheduled = futureRaw
    .map((c) => ({
      chapter: c.attributes.chapter,
      publishAt: new Date(c.attributes.publishAt),
    }))
    .filter((c) => c.publishAt > now)
    .sort((a, b) => a.publishAt.getTime() - b.publishAt.getTime());

  if (scheduled.length) {
    return {
      method: "scheduled",
      nextChapter: scheduled[0]!.chapter,
      estimatedAt: scheduled[0]!.publishAt,
      confidence: "exact",
      note: "Scheduled on MangaDex.",
    };
  }

  // 2) Estimate from past cadence.
  const raw = await getFeed(seriesId, [
    ["translatedLanguage[]", language],
    ["order[publishAt]", "desc"],
    ["includeExternalUrl", "1"],
    ["limit", String(Math.min(sampleSize * 3, 100))],
  ]);

  // Dedupe by chapter number, keeping the earliest upload.
  const byChapter = new Map<string, Date>();
  for (const c of raw) {
    const num = c.attributes.chapter;
    if (num == null) continue;
    const t = new Date(c.attributes.publishAt);
    if (t > now) continue;
    const existing = byChapter.get(num);
    if (!existing || t < existing) byChapter.set(num, t);
  }

  const dates = [...byChapter.values()]
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(-sampleSize);

  if (dates.length < 4) {
    return {
      method: "none",
      nextChapter: null,
      estimatedAt: null,
      confidence: "none",
      note: "Not enough chapter history to estimate.",
    };
  }

  // Rolling forward below needs a real gap: at 0 it would never finish, and that
  // would freeze the whole server, not just this request.
  const gaps = dates
    .slice(1)
    .map((d, i) => d.getTime() - dates[i]!.getTime())
    .filter((g) => g >= MIN_GAP_MS);

  if (gaps.length < 3) {
    return {
      method: "none",
      nextChapter: null,
      estimatedAt: null,
      confidence: "none",
      note: "Chapters were uploaded in bulk, so there's no release cadence to go on.",
    };
  }

  const rough = median(gaps);
  const cleanGaps = gaps.filter((g) => g <= rough * 3); // drop hiatus gaps
  const gap = median(cleanGaps);

  const spread = median(cleanGaps.map((g) => Math.abs(g - gap))) / gap;
  const confidence = spread < 0.1 ? "high" : spread < 0.35 ? "medium" : "low";

  const last = dates[dates.length - 1]!;
  let next = new Date(last.getTime() + gap);

  // Roughly weekly -> snap to the usual weekday + time of day (UTC).
  if (gap > 5 * DAY && gap < 9 * DAY) {
    const recent = dates.slice(-8);
    const weekday = mode(recent.map((d) => d.getUTCDay()));
    const minuteOfDay = mode(
      recent.map((d) => d.getUTCHours() * 60 + d.getUTCMinutes()),
    );
    next = new Date(last.getTime() + 6 * DAY);
    while (next.getUTCDay() !== weekday) next = new Date(next.getTime() + DAY);
    next.setUTCHours(0, minuteOfDay, 0, 0);
  }

  // Overdue -> roll forward by whole gaps and flag it.
  let missed = 0;
  while (next <= now) {
    next = new Date(next.getTime() + gap);
    missed++;
  }

  const lastNum = Math.max(...[...byChapter.keys()].map(parseFloat));

  return {
    method: "estimated",
    nextChapter: Number.isFinite(lastNum)
      ? String(Math.floor(lastNum) + 1)
      : null,
    estimatedAt: next,
    confidence: missed > 0 ? "low" : confidence,
    note:
      missed > 0
        ? "Latest chapter is overdue; likely a break or hiatus."
        : "Estimated from past release cadence.",
  };
}
