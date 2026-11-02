import type { ChapterEstimate } from "./estimateNextChapter.js";
import type { VolumeEstimate } from "./estimateNextVolume.js";
import type { VolumeStart } from "./volumeStarts.js";

type ChapterRelease = {
  latestReleased: {
    chapterNumber: string | null;
    releaseDate: string | null;
  }; // last released chapter
  estimateRelease: {
    chapterNumber: string | null;
    releaseDate: string | null;
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
  releaseDate: string | null;
  isEstimate: boolean;
  confidence: VolumeEstimate["confidence"];
  note: string;
};

export type FormatedDates = {
  volumeStarts?: VolumeStart[]; // for working out a reader's volume from their chapter
  volume?: Array<Volume>;
  newVolume?: NewVolume; // upcoming new volume
  chapter?: ChapterRelease;
  // the whole series is out, so there's nothing new to come
  seriesFinished?: boolean;
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

// Dates stay ISO: saved answers live for hours, so "Tomorrow" has to be worked
// out when it's shown, in the reader's timezone.
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
      releaseDate: c.attributes.createdAt,
    }));

    // Chapters are ordered by number desc, so index 0 is the latest released chapter.
    // The upcoming chapter comes from the estimate (exact if scheduled, otherwise predicted).
    const chapters = chapterData.data;

    const chapterRelease: ChapterRelease = {
      latestReleased: {
        chapterNumber: chapters[0]?.attributes.chapter ?? null,
        releaseDate: chapters[0]?.attributes.publishAt ?? null,
      },
      estimateRelease: {
        chapterNumber: chapterEstimate.nextChapter,
        releaseDate: chapterEstimate.estimatedAt?.toISOString() ?? null,
        isEstimate: chapterEstimate.method === "estimated",
        confidence: chapterEstimate.confidence,
      },
    };

    // Upcoming volume: always an estimate, since MangaDex has no volume release dates.
    const newVolume: NewVolume = {
      volume: volumeEstimate.nextVolume,
      releaseDate: volumeEstimate.estimatedAt?.toISOString() ?? null,
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
