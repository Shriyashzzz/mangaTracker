// src/util/estimateNextVolume.ts
// Estimates when the next volume of a manga will come out.
//
// MangaDex has no volume release dates, so this uses the date each volume's cover
// was uploaded as a stand-in, then projects the usual gap between volumes forward.
// It also reports chapter progress toward the next volume as a sanity check.

import { median } from "../median.js";

const API = "https://api.mangadex.org";
const DAY = 24 * 60 * 60 * 1000;
const MAX_MISSED = 3; // more late than this and it has ended or is on a long break
const MIN_GAP_DAYS = 14; // smaller gaps usually mean covers were bulk-uploaded, so they say nothing

export type VolumeEstimate = {
  method: "estimated" | "none";
  nextVolume: string | null;
  estimatedAt: Date | null;
  confidence: "high" | "medium" | "low" | "none";
  chaptersSinceLastVolume: number | null; // chapters not yet assigned to any volume
  avgChaptersPerVolume: number | null;
  note: string;
};

export type CoverItem = { attributes: { volume: string | null; createdAt: string } };

type AggregateVolume = {
  volume: string;
  count: number;
  chapters?: Record<string, unknown>;
};

type AggregateResponse = {
  volumes?: Record<string, AggregateVolume>;
};

async function getCovers(seriesId: string): Promise<CoverItem[]> {
  const params = new URLSearchParams();
  params.append("manga[]", seriesId);
  params.append("limit", "100");
  params.append("order[volume]", "desc");
  const res = await fetch(`${API}/cover?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`MangaDex cover request failed: ${res.status}`);
  const json = (await res.json()) as { data?: CoverItem[] };
  return json.data ?? [];
}

// How many chapters are not yet in a volume, and how many a volume usually holds.
async function getChapterProgress(
  seriesId: string,
  language: string,
): Promise<{ unassigned: number | null; avgPerVolume: number | null }> {
  try {
    const params = new URLSearchParams();
    params.append("translatedLanguage[]", language);
    const res = await fetch(`${API}/manga/${seriesId}/aggregate?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { unassigned: null, avgPerVolume: null };
    const json = (await res.json()) as AggregateResponse;
    const vols = json.volumes ?? {};

    // count is uploads, and a chapter can have several; chapters has one key each
    const chapterCount = (v?: AggregateVolume) =>
      Object.keys(v?.chapters ?? {}).length;
    const unassigned = chapterCount(vols["none"]);
    const counts = Object.entries(vols)
      .filter(([key]) => key !== "none" && Number.isFinite(parseFloat(key)))
      .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
      .slice(-8)
      .map(([, v]) => chapterCount(v))
      .filter((n) => n > 0);

    return {
      unassigned,
      avgPerVolume: counts.length ? Math.round(median(counts)) : null,
    };
  } catch {
    return { unassigned: null, avgPerVolume: null };
  }
}

export async function estimateNextVolume(
  seriesId: string,
  language = "en",
  sampleSize = 8,
  knownCovers?: CoverItem[], // already fetched, so MangaDex isn't asked twice
): Promise<VolumeEstimate> {
  const now = new Date();
  const none = (note: string): VolumeEstimate => ({
    method: "none",
    nextVolume: null,
    estimatedAt: null,
    confidence: "none",
    chaptersSinceLastVolume: null,
    avgChaptersPerVolume: null,
    note,
  });

  const [covers, progress] = await Promise.all([
    knownCovers ?? getCovers(seriesId),
    getChapterProgress(seriesId, language),
  ]);

  // One date per volume number: the earliest cover upload.
  const byVolume = new Map<number, Date>();
  for (const c of covers) {
    const num = parseFloat(c.attributes.volume ?? "");
    if (!Number.isFinite(num)) continue;
    const t = new Date(c.attributes.createdAt);
    const existing = byVolume.get(num);
    if (!existing || t < existing) byVolume.set(num, t);
  }

  const volumes = [...byVolume.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-sampleSize);

  if (volumes.length < 4) return none("Not enough volume history to estimate.");

  // Gaps between consecutive volumes; ignore bulk uploads and out-of-order covers.
  const rawGaps = volumes
    .slice(1)
    .map(([, d], i) => d.getTime() - volumes[i]![1].getTime())
    .filter((g) => g >= MIN_GAP_DAYS * DAY);

  if (rawGaps.length < 3) {
    return none(
      "Cover upload dates are too close together to show a release cadence.",
    );
  }

  const rough = median(rawGaps);
  const gaps = rawGaps.filter((g) => g <= rough * 3); // drop hiatus-sized gaps
  const gap = median(gaps);

  const spread = median(gaps.map((g) => Math.abs(g - gap))) / gap;
  let confidence: VolumeEstimate["confidence"] =
    spread < 0.15 ? "high" : spread < 0.4 ? "medium" : "low";

  const lastVolumeNum = volumes[volumes.length - 1]![0];
  const lastDate = new Date(Math.max(...volumes.map(([, d]) => d.getTime())));

  let next = new Date(lastDate.getTime() + gap);
  let missed = 0;
  while (next <= now) {
    next = new Date(next.getTime() + gap);
    missed++;
  }
  // Rolling forward would give even a series that ended years ago a date.
  if (missed > MAX_MISSED) {
    return none("No new volumes for a while; it has likely ended or is on a long break.");
  }
  if (missed > 0) confidence = "low";

  const { unassigned, avgPerVolume } = progress;
  let note = "Estimated from the gap between past volume cover uploads.";
  if (missed > 0) {
    note =
      "The next volume looks overdue; there may be a break, so this is rough.";
  } else if (
    unassigned != null &&
    avgPerVolume != null &&
    unassigned <= avgPerVolume // more than that means MangaDex's volume data is thin
  ) {
    note += ` ${unassigned} of ~${avgPerVolume} chapters are out for the next volume.`;
  }

  return {
    method: "estimated",
    nextVolume: String(Math.floor(lastVolumeNum) + 1),
    estimatedAt: next,
    confidence,
    chaptersSinceLastVolume: unassigned,
    avgChaptersPerVolume: avgPerVolume,
    note,
  };
}
