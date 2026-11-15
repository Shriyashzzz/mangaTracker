// What someone with a share link gets to see. Listed field by field, so a new
// column can't end up public by accident. Never the username, which is half of
// the login, nor what they've hidden. The volumes they own are shown (owner's
// call, 2026-11-11): visitors tap a series to see them
import { readerName } from "./readerNames.js";
import type { VolumeFacts } from "./sharedVolumes.js";
import { topOf } from "./shareTop.js";
import { readTrackBy, tracksOf } from "../releases/releaseStatus.js";

type SharedSource = {
  id: number;
  displayName: string | null;
  avatar: string | null;
  shareNotes: boolean;
  // their star ratings, and how far they've read: shown unless switched
  // off (a shelf from before these could be chosen has neither, and shows)
  shareRatings?: boolean;
  shareProgress?: boolean;
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
  // by the series' place in `manga`: what the catalog adds about its
  // volumes (sharedVolumes.ts). None for a series it doesn't know
  facts?: (VolumeFacts | undefined)[];
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
  shareRatings = true,
  shareProgress = true,
  prefs,
  manga,
  facts,
}: SharedSource) => ({
  displayName: readerName({ id, displayName }),
  avatar,
  // the series they've put at the top, by name, in their order
  top: topOf(
    prefs,
    manga.map((m) => m.name),
  ),
  manga: manga.map((m, i) => ({
    name: m.name,
    image: m.image,
    genre: m.genre,
    status: m.status,
    planned: m.planned,
    ...(m.lightNovel ? { lightNovel: true } : {}),
    // their place as they keep it (the chapter, the volume read, or
    // both), unless they keep it to themselves
    ...(shareProgress
      ? sharedPlace(m, (prefs as { trackBy?: unknown } | null)?.trackBy)
      : { bookmark: null }),
    // their stars, unless they keep those to themselves
    rating: shareRatings ? m.rating : null,
    // as on their shelf: "up to N", or the exact list when there are gaps
    volumesOwned: m.volumesOwned ?? null,
    ...(m.ownedList?.length ? { ownedList: m.ownedList } : {}),
    // the next volume to get, for the page's "To get" tab; and that they
    // have every volume that's out
    ...(facts?.[i]?.next ? { next: facts[i]!.next } : {}),
    ...(facts?.[i]?.ownsAll ? { ownsAll: true } : {}),
    // notes only when they've chosen to share them
    ...(shareNotes && m.description ? { notes: m.description } : {}),
  })),
});
