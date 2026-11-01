type ChapterRelease = {
  lastChapter: { chapterNumber: string | null; releaseDate: string }; // last released chapter
  newChapter: { chapterNumber: string | null; releaseDate: string }; // upcoming new chapter
};

type Volume = {
  volume: string | null;
  releaseDate: string | null;
};

export type FormatedDates = {
  volume?: Array<Volume>;
  chapter?: ChapterRelease;
};

export type MangaDexChapter = {
  id: string;
  type: "chapter";
  attributes: {
    volume: string | null;
    chapter: string | null;
    publishAt: string;
    [key: string]: any;
  };
};

export type MangaDexCover = {
  id: string;
  type: "cover_art";
  attributes: {
    volume: string | null;
    fileName: string;
    createdAt: string;
    updatedAt: string;
  };
};

export type MangaDexCoverResponse = {
  result: string;
  data: MangaDexCover[];
};

export type MangaDexChapterResponse = {
  result: string;
  response: string;
  data: MangaDexChapter[];
  limit: number;
  offset: number;
  total: number;
};

function getFormatedDates(
  chapterData: MangaDexChapterResponse,
  coverData: MangaDexCoverResponse,
): FormatedDates {
  try {
    if (!chapterData || !coverData) {
      throw new Error("Either Chapter Data or Volume Data is null");
    }

    // Map volume data
    const newVolumeData: Volume[] = coverData.data.map((c) => ({
      volume: c.attributes.volume,
      releaseDate: c.attributes.createdAt,
    }));

    // Map and sort/pick chapters to fit the ChapterRelease structure
    // Assuming data is ordered, index 0 is the latest/last chapter, index 1 is the next/new one
    const chapters = chapterData.data;

    const chapterRelease: ChapterRelease = {
      lastChapter: {
        chapterNumber: chapters[0]?.attributes.chapter ?? null,
        releaseDate: chapters[0]?.attributes.publishAt ?? "",
      },
      newChapter: {
        chapterNumber: chapters[1]?.attributes.chapter ?? null,
        releaseDate: chapters[1]?.attributes.publishAt ?? "",
      },
    };

    return {
      volume: newVolumeData,
      chapter: chapterRelease,
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export default getFormatedDates;
