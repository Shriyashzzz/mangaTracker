// What someone with a share link gets to see. Listed field by field, so a new
// column can't end up public by accident. Never the username, which is half of
// the login, nor what they own or what they've hidden.
import { defaultReaderName } from "./readerNames.js";

export type SharedSource = {
  id: number;
  displayName: string | null;
  avatar: string | null;
  shareNotes: boolean;
  manga: {
    name: string;
    image: string | null;
    genre: string | null;
    status: boolean;
    planned: boolean;
    lightNovel?: boolean;
    bookmark: number | null;
    rating: number | null;
    description: string | null;
  }[];
};

export const toSharedShelf = ({
  id,
  displayName,
  avatar,
  shareNotes,
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
    bookmark: m.bookmark,
    rating: m.rating,
    // notes only when they've chosen to share them
    ...(shareNotes && m.description ? { notes: m.description } : {}),
  })),
});
