// Finds light novels that AniList doesn't list (Solo Leveling's, like many
// Korean web novels), so search can show them under their manga. The first
// time a manga comes up in a search, its series is checked here in the
// background: one small Open Library search for "<name> novel". If that
// turns up novel volumes of this series, the novel's full volume list is
// built (the same lookup a novel's page makes), and search shows it from then
// on (anilist.ts withKnownNovels). The answer is kept a month in novel_checks.
//
// One series at a time with a pause between, and never more than a short
// queue: Open Library is free and shared, and translating Japanese titles asks
// AniList, which allows about 30 requests a minute. Never touches SerpApi.
import { prisma } from "../config/prisma.js";
import { searchVolumesDetailed } from "./sources/catalog.js";
import { getSeriesInfo } from "./sources/anilist.js";
import { seriesVolumes } from "./service.js";
import { baseName, novelName } from "./lightNovel.js";
import { isNovelBook, seriesName, seriesOf, slugify } from "./stores/match.js";

const RECHECK_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const GAP_MS = 3000;
const MAX_QUEUE = 50;

const queue: string[] = [];
const waiting = new Set<string>();
let running = false;

// a probe's books that are this series' novel
export const novelVolumesOf = (titles: string[], name: string) =>
  titles.filter(
    (t) =>
      isNovelBook(t) && seriesOf(baseName(seriesName(t))) === seriesOf(name),
  ).length;

// The manga's own name first, then up to three of AniList's other names for
// it: the novel can be sold under one ("Omniscient Reader's Viewpoint" for
// the manga AniList calls Omniscient Reader). The first that turns up novel
// volumes is the novel's name
const MAX_OTHER_NAMES = 3;

async function check(name: string) {
  const key = seriesOf(name);
  const last = await prisma.novelCheck.findUnique({ where: { key } });
  if (last && Date.now() - last.checkedAt.getTime() < RECHECK_AFTER_MS) return;

  const info = await getSeriesInfo(name).catch(() => null);
  // no answer and none saved: AniList was busy, not "no other names". Checked
  // without them, a novel sold under another name would be missed for a month
  if (!info && !(await prisma.seriesInfo.findUnique({ where: { slug: slugify(name) } }))) {
    return;
  }
  const names = [
    ...new Set([name, ...(info?.altNames ?? []).filter((n) => n.length > 3)]),
  ].slice(0, 1 + MAX_OTHER_NAMES);

  let found: { name: string; volumes: number } | null = null;
  for (const candidate of names) {
    // with the novel's name, so works filed under a Japanese or Korean title
    // ("나 혼자만 레벨 업 1 (novel)") have their English editions read
    // "<name> novel": Open Library answers "<name> light novel" with junk
    // (Robinson Crusoe for Solo Leveling)
    const probe = await searchVolumesDetailed(`${candidate} novel`, {
      max: 20,
      timeoutMs: 15000,
      seriesName: novelName(candidate),
    });
    // a probe that couldn't be read fully says nothing: tried again next time
    if (probe.degraded) return;
    if (
      novelVolumesOf(
        probe.books.map((b) => b.title),
        candidate,
      ) > 0
    ) {
      // builds and saves the novel's list, as its page would
      const list = await seriesVolumes(novelName(candidate));
      if (list.incomplete) return;
      if (list.volumes.length) {
        found = { name: novelName(candidate), volumes: list.volumes.length };
        break;
      }
    }
    await new Promise((done) => setTimeout(done, GAP_MS));
  }
  const row = {
    name: found?.name ?? null,
    volumes: found?.volumes ?? 0,
    checkedAt: new Date(),
  };
  await prisma.novelCheck.upsert({
    where: { key },
    create: { key, ...row },
    update: row,
  });
}

async function run() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const name = queue.shift()!;
      try {
        await check(name);
      } catch (e) {
        // a passing problem: the series comes up again in a later search
        console.error(
          `Novel check for "${name}" failed:`,
          (e as Error).message,
        );
      } finally {
        waiting.delete(seriesOf(name));
      }
      await new Promise((done) => setTimeout(done, GAP_MS));
    }
  } finally {
    running = false;
  }
}

// asked after a search has answered: these manga, if not checked lately
export function findNovelsFor(names: string[]) {
  if (process.env.NODE_ENV === "test") return;
  for (const name of names) {
    const key = seriesOf(name);
    if (!key || waiting.has(key) || queue.length >= MAX_QUEUE) continue;
    waiting.add(key);
    queue.push(name);
  }
  void run();
}
