import { formatReleaseDate } from "./fomratISO8601Date.js";
import type { ChapterEstimate } from "./estimateNextChapter.js";
import type { VolumeEstimate } from "./estimateNextVolume.js";

type ChapterRelease = {
  latestReleased: {
    chapterNumber: string | null;
    releaseDate: string;
  }; // last released chapter
  estimateRelease: {
    chapterNumber: string | null;
    releaseDate: string;
    isEstimate: boolean; // true when predicted, false when scheduled on MangaDex
    confidence: ChapterEstimate["confidence"];
  }; // upcoming new chapter
};

type Volume = {
  volume: string | null;
  releaseDate: string | null;
};

type NewVolume = {
  volume: string | null;
  releaseDate: string;
  isEstimate: boolean;
  confidence: VolumeEstimate["confidence"];
  note: string;
};

export type FormatedDates = {
  volume?: Array<Volume>;
  newVolume?: NewVolume; // upcoming new volume
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
  chapterEstimate: ChapterEstimate,
  volumeEstimate: VolumeEstimate,
): FormatedDates {
  try {
    if (!chapterData || !coverData) {
      throw new Error("Either Chapter Data or Volume Data is null");
    }
    // Map volume data
    const newVolumeData: Volume[] = coverData.data.map((c) => ({
      volume: c.attributes.volume,
      releaseDate: formatReleaseDate(c.attributes.createdAt),
    }));

    // Chapters are ordered by publishAt desc, so index 0 is the latest released chapter.
    // The upcoming chapter comes from the estimate (exact if scheduled, otherwise predicted).
    const chapters = chapterData.data;

    const chapterRelease: ChapterRelease = {
      latestReleased: {
        chapterNumber: chapters[0]?.attributes.chapter ?? null,
        releaseDate: formatReleaseDate(chapters[0]?.attributes.publishAt),
      },
      estimateRelease: {
        chapterNumber: chapterEstimate.nextChapter,
        releaseDate: formatReleaseDate(
          chapterEstimate.estimatedAt?.toISOString(),
        ),
        isEstimate: chapterEstimate.method === "estimated",
        confidence: chapterEstimate.confidence,
      },
    };

    // Upcoming volume: always an estimate, since MangaDex has no volume release dates.
    const newVolume: NewVolume = {
      volume: volumeEstimate.nextVolume,
      releaseDate: formatReleaseDate(volumeEstimate.estimatedAt?.toISOString()),
      isEstimate: volumeEstimate.method === "estimated",
      confidence: volumeEstimate.confidence,
      note: volumeEstimate.note,
    };

    return {
      volume: newVolumeData,
      newVolume,
      chapter: chapterRelease,
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export default getFormatedDates;
