type Volume = {
  volume: number;
  releaseDate: string;
};

type ChaptherRelease = {
  lastChapther: { chaptherNumber: number; releaseDate: string }; // last released chapther
  newChapther: { chaptherNumber: number; releaseDate: string }; //upcoming new chatpher
};

type MangaReleaseDate = {
  ok: boolean;
  volume?: Array<Volume[]>;
  chapther?: ChaptherRelease;
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
    console.log(seriesId);
    return seriesId;
  } catch (e) {
    console.log(e);
    throw e;
  }
};

//gets all the volumes published
const getNewestVolume = async (seriesId: string) => {
  try {
    const params: URLSearchParams = new URLSearchParams({});
    const response = await fetch(
      `https://api.mangadex.org/manga/${seriesId}/aggregate`,
    );
    if (!response.ok)
      throw new Error("Unable to fetch volume data from mangadex");
    const data = await response.json();
    return data;
  } catch (e) {
    console.log(e);
    throw e;
  }
};

//get's all the chapthers info
async function getAllChapthers(seriesId: string) {
  const params = new URLSearchParams([
    ["translatedLanguage[]", "en"],
    ["order[publishAt]", "dsc"],
    ["limit", String(4)],
  ]);

  const res = await fetch(
    `https://api.mangadex.org/manga/${seriesId}/feed?${params.toString()}`,
  );
  const data = await res.json();
  console.log(data);
}

//main function to orchestrate small fucntions
async function findNewVolumeReleaseDate(
  mangaName: string,
  currentVolume: number,
) {
  try {
    const seriesId = await getMangaDexId(mangaName);
    if (!seriesId)
      return {
        ok: false,
      };
    const volumeData = await getNewestVolume(seriesId);
    getAllChapthers(seriesId);
  } catch (e) {
    console.log(e);
  }
}

findNewVolumeReleaseDate("Spy x Family", 14);

export default findNewVolumeReleaseDate;
