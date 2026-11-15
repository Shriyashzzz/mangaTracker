// Where each volume starts, by chapter, from Wikipedia's "List of … chapters"
// page. A backup for MangaDex's list (volumeStarts.ts), which is thin for
// many licensed series: uploads taken down at a publisher's request take
// their volume numbers with them (Jujutsu Kaisen's stops at vol. 4, Vinland
// Saga's at vol. 1). Wikipedia lists every volume with its chapters.
//
//   chapter list page ── its wikitext ── each {{Graphic novel list}}: the
//   volume's number and its first chapter ("*5." or "Numbered list|start=5")
//
// Kept a week (series_volumes, key "wiki-starts:<name>"), as volumes come
// out a few times a year. Nice to have: any failure is just no list.
// https://www.mediawiki.org/wiki/API:Search, https://www.mediawiki.org/wiki/API:Parsing_wikitext
import { prisma } from "../../config/prisma.js";
import { politeFetch } from "../politeFetch.js";
import type { VolumeStart } from "./volumeStarts.js";

const API = "https://en.wikipedia.org/w/api.php";
// Wikimedia asks every client to say who it is and where to reach it
const HEADERS = {
  "User-Agent": "MangaTracker/1.0 (https://mangatracker.xyz)",
};
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 8_000;

// ---------- reading the page ----------

// the first chapter a volume's chapter list names: "*5. …", "#5 …",
// "*Chapter 5", a series' own word for one ("*Mission: 1–5", "*Days 8: …"),
// "<li value="5">", or a numbered list that starts at 5 (or at 1 when it
// doesn't say)
function firstChapterIn(list: string): number | null {
  const found =
    list.match(/\{\{\s*Numbered list\s*\|\s*start\s*=\s*(\d+)/i) ??
    list.match(/value\s*=\s*"?(\d+)/i) ??
    list.match(/^\s*[*#]\s*(?:[A-Za-z.]+:?\s*)?0*(\d{1,4})\b/im) ??
    list.match(/\bChapter\s+0*(\d+)\b/i);
  if (found) return Number(found[1]);
  return /\{\{\s*Numbered list\s*\|/i.test(list) ? 1 : null;
}

// Each volume in page order, while volumes and chapters keep going up: a
// second table further down (a spin-off's, or a side story's) starts again
// at vol. 1 and ends the list
export function volumeStartsFromWikitext(text: string): VolumeStart[] {
  const starts: VolumeStart[] = [];
  for (const block of text.split(/\{\{\s*Graphic novel list(?!\/)/i).slice(1)) {
    const volume = Number(block.match(/\|\s*VolumeNumber\s*=\s*(\d+)/i)?.[1]);
    const list = block.split(/\|\s*ChapterList[^=|]*=/i)[1] ?? "";
    const firstChapter = firstChapterIn(list);
    if (!volume || firstChapter == null) continue;
    const last = starts.at(-1);
    if (last && (volume <= last.volume || firstChapter <= last.firstChapter))
      break;
    starts.push({ volume, firstChapter });
  }
  return starts;
}

// ---------- finding the page ----------

const wikiGet = async (params: Record<string, string>) => {
  const url = `${API}?${new URLSearchParams({ format: "json", ...params })}`;
  const res = await politeFetch(url, {
    headers: HEADERS,
    timeoutMs: TIMEOUT_MS,
  });
  if (!res.ok) throw new Error(`Wikipedia answered ${res.status}`);
  return res.json();
};

// "List of Frieren chapters" for "Frieren: Beyond Journey's End": the
// search's first chapter list whose name shares the series' first word
async function chapterListTitle(name: string): Promise<string | null> {
  const data = await wikiGet({
    action: "query",
    list: "search",
    srsearch: `List of ${name} chapters`,
    srlimit: "5",
  });
  const firstWord = name.toLowerCase().split(/[^\p{L}\p{N}]+/u)[0] ?? "";
  const titles: string[] = (data.query?.search ?? []).map(
    (hit: { title: string }) => hit.title,
  );
  return (
    titles.find(
      (title) =>
        /^List of .+ chapters/i.test(title) &&
        title.toLowerCase().includes(firstWord),
    ) ?? null
  );
}

async function lookUp(name: string): Promise<VolumeStart[]> {
  const title = await chapterListTitle(name);
  if (!title) return [];
  const data = await wikiGet({
    action: "parse",
    prop: "wikitext",
    redirects: "1",
    page: title,
  });
  return volumeStartsFromWikitext(data.parse?.wikitext?.["*"] ?? "");
}

// ---------- kept a week ----------

export async function wikipediaVolumeStarts(
  name: string,
): Promise<VolumeStart[]> {
  const key = `wiki-starts:${name.toLowerCase().trim()}`;
  try {
    const saved = await prisma.seriesVolumes.findUnique({ where: { key } });
    if (saved && Date.now() - saved.fetchedAt.getTime() < KEEP_MS)
      return saved.volumes as unknown as VolumeStart[];
    const starts = await lookUp(name);
    const data = { volumes: starts, fetchedAt: new Date() };
    await prisma.seriesVolumes.upsert({
      where: { key },
      create: { key, ...data },
      update: data,
    });
    return starts;
  } catch (e) {
    console.error("wikipedia volume starts failed:", (e as Error).message);
    return [];
  }
}
