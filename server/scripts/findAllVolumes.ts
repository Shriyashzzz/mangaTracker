import { estimateNextChapter } from "../src/util/estimateNextChapter.js";
import getFormatedDates from "../src/util/volumeDataFormatter.js";
import type { FormatedDates } from "../src/util/volumeDataFormatter.js";
import { estimateNextVolume } from "../src/util/estimateNextVolume.js";

type MangaReleaseDates<T> = {
  ok: boolean;
  data?: T;
};

// gets the manga id from the realtive to mangadex api
const getMangaDexId = async (mangaName: string): Promise<string> => {
  const MANGADEX_BASE_URL = "https://api.mangadex.org/manga?";

  try {
    const params: URLSearchParams = new URLSearchParams({
      title: mangaName,
      limit: "1",
    });
    params.append("includes[]", "cover_art");
    const response = await fetch(`${MANGADEX_BASE_URL}${params}`);

    if (!response.ok)
      throw new Error("Unable to fetch manga details from MangaDex");
    const data = await response.json();
    const seriesId = await data.data[0].id;
    return seriesId;
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
    const response = await fetch(`https://api.mangadex.org/cover?${params}`);
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
      ["order[publishAt]", "desc"],

      ["limit", String(1)],
    ]);

    const res = await fetch(
      `https://api.mangadex.org/manga/${seriesId}/feed?${params.toString()}`,
    );
    const data = await res.json();
    return data;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

//main function to orchestrate small fucntions
async function findNewVolumeReleaseDate(
  mangaName: string,
): Promise<MangaReleaseDates<FormatedDates>> {
  try {
    const seriesId = await getMangaDexId(mangaName);
    if (!seriesId)
      return {
        ok: false,
      };
    const coverData = await getCoverData(seriesId);
    const chaptherData = await getAllChapthers(seriesId);
    const [chapterEstimate, volumeEstimate] = await Promise.all([
      estimateNextChapter(seriesId),
      estimateNextVolume(seriesId),
    ]);
    const formatedDates = getFormatedDates(
      chaptherData,
      coverData,
      chapterEstimate,
      volumeEstimate,
    );
    console.log(formatedDates);
    return { ok: true, data: formatedDates };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
    };
  }
}
findNewVolumeReleaseDate("Spy x Family");

export default findNewVolumeReleaseDate;
