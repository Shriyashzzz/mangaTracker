// What someone with a share link gets to see. Listed field by field, so a new
// column can't end up public by accident. Never the username, which is half of
// the login, nor what they've hidden. The volumes they own are shown (owner's
// call, 2026-11-11): visitors tap a series to see them
import { defaultReaderName } from "./readerNames.js";
import { readTrackBy, tracksOf } from "../releases/releaseStatus.js";

type SharedSource = {
  id: number;
  displayName: string | null;
  avatar: string | null;
  shareNotes: boolean;
  // theirs: trackBy says which place each series shows
  prefs?: unknown;
  manga: {
    name: string;
    image: string | null;
    genre: string | null;
    status: boolean;
    planned: boolean;
    lightNovel?: boolean;
    bookmark: number | null;
    byVolume?: boolean;
    readVolume?: number | null;
    rating: number | null;
    description: string | null;
    volumesOwned?: number | null;
    ownedList?: number[];
  }[];
};

const sharedPlace = (
  m: {
    bookmark: number | null;
    byVolume?: boolean;
    readVolume?: number | null;
  },
  trackBy: unknown,
) => {
  const tracks = tracksOf(m.byVolume, readTrackBy(trackBy));
  return {
    bookmark: tracks.chapters ? m.bookmark : null,
    ...(tracks.volumes ? { readVolume: m.readVolume ?? null } : {}),
  };
};

export const toSharedShelf = ({
  id,
  displayName,
  avatar,
  shareNotes,
  prefs,
  manga,
}: SharedSource) => ({
  displayName: displayName || defaultReaderName(id),
  avatar,
  manga: manga.map((m) => ({
    name: m.name,
    image: m.image,
    genre: m.genre,
    status: m.status,
    planned: m.planned,
    ...(m.lightNovel ? { lightNovel: true } : {}),
    // their place as they keep it: the chapter, the volume read, or both
    ...sharedPlace(m, (prefs as { trackBy?: unknown } | null)?.trackBy),
    rating: m.rating,
    // as on their shelf: "up to N", or the exact list when there are gaps
    volumesOwned: m.volumesOwned ?? null,
    ...(m.ownedList?.length ? { ownedList: m.ownedList } : {}),
    // notes only when they've chosen to share them
    ...(shareNotes && m.description ? { notes: m.description } : {}),
  })),
});
