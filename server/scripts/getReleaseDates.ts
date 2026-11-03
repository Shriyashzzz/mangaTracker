import { estimateNextChapter } from "../src/util/releases/estimateNextChapter.js";
import getFormatedDates from "../src/util/releases/volumeDataFormatter.js";
import type { FormatedDates } from "../src/util/releases/volumeDataFormatter.js";
import { estimateNextVolume } from "../src/util/releases/estimateNextVolume.js";
import { volumeStartsFrom } from "../src/util/releases/volumeStarts.js";

export type MangaReleaseDates<T> = {
  ok: boolean;
  data?: T;
};

// what we already know about the series from AniList, to find the right one
export type SeriesMatch = {
  anilistId?: number | null;
  altNames?: string[];
};

type MangaDexSearchHit = {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles: Record<string, string>[];
    links: Record<string, string> | null;
  };
};

const sameTitle = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

// gets the manga id from the realtive to mangadex api. MangaDex's first search
// hit is often another series ("Monster" gives a monster girl romance), so the
// answer has to carry AniList's id, or failing that be the exact title and not
// be linked to some other AniList entry. No match means no id
const getMangaDexId = async (
  mangaName: string,
  { anilistId, altNames = [] }: SeriesMatch = {},
): Promise<string | null> => {
  const MANGADEX_BASE_URL = "https://api.mangadex.org/manga?";

  try {
    for (const title of [mangaName, ...altNames].slice(0, 3)) {
      const params: URLSearchParams = new URLSearchParams({
        title,
        limit: "25",
      });
      params.append("order[relevance]", "desc");
      const response = await fetch(`${MANGADEX_BASE_URL}${params}`, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok)
        throw new Error("Unable to fetch manga details from MangaDex");
      const data = (await response.json()) as { data: MangaDexSearchHit[] };

      const linked = data.data.find(
        (hit) => anilistId && hit.attributes.links?.al === String(anilistId),
      );
      if (linked) return linked.id;

      const exact = data.data.find((hit) => {
        const al = hit.attributes.links?.al;
        if (anilistId && al) return false;
        return [
          ...Object.values(hit.attributes.title),
          ...hit.attributes.altTitles.flatMap((alt) => Object.values(alt)),
        ].some((name) => sameTitle(name, title));
      });
      if (exact) return exact.id;
    }
    return null;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

//gets all the volumes cover data that includes publish date
async function getCoverData(seriesId: string) {
  try {
    const params = new URLSearchParams({});
    params.append("manga[]", `${seriesId}`);
    params.append("limit", "100"); // more data to make accurate estimate
    params.append("order[volume]", "desc"); // long series have more than 100
    const response = await fetch(`https://api.mangadex.org/cover?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`MangaDex covers: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

//get's all the chapthers info
async function getAllChapthers(seriesId: string) {
  try {
    const params = new URLSearchParams([
      ["translatedLanguage[]", "en"],
      // by number, since the newest upload can be an old chapter posted again
      ["order[chapter]", "desc"],

      ["limit", String(1)],
      // "latest" means out already, not one scheduled for next week
      ["includeFuturePublishAt", "0"],
    ]);

    const res = await fetch(
      `https://api.mangadex.org/manga/${seriesId}/feed?${params.toString()}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) throw new Error(`MangaDex feed: ${res.status}`);
    const data = await res.json();
    return data;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

// which chapters are in which volume, in any language: English uploads alone
// mostly aren't sorted into volumes. Nice to have, so a failure just means none
async function getVolumeStarts(seriesId: string) {
  try {
    const res = await fetch(
      `https://api.mangadex.org/manga/${seriesId}/aggregate`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return volumeStartsFrom(data.volumes ?? {});
  } catch (e) {
    console.error(e);
    return [];
  }
}

//main function to orchestrate small fucntions
async function getReleaseDates(
  mangaName: string,
  match: SeriesMatch = {},
): Promise<MangaReleaseDates<FormatedDates>> {
  try {
    const seriesId = await getMangaDexId(mangaName, match);
    if (!seriesId)
      return {
        ok: false,
      };
    const coverData = await getCoverData(seriesId);
    const chaptherData = await getAllChapthers(seriesId);
    const [chapterEstimate, volumeEstimate, volumeStarts] = await Promise.all([
      estimateNextChapter(seriesId),
      estimateNextVolume(seriesId, "en", 8, coverData.data),
      getVolumeStarts(seriesId),
    ]);
    const formatedDates = getFormatedDates(
      chaptherData,
      coverData,
      chapterEstimate,
      volumeEstimate,
    );

    return { ok: true, data: { ...formatedDates, volumeStarts } };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
    };
  }
}

export default getReleaseDates;
