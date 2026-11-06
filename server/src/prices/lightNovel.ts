// A light novel series has its own volumes, ISBNs, prices and AniList entry,
// apart from the manga of the same name (Overlord, Re:Zero, Slime). Prices and
// release checks key everything by series name, so the novel goes by its name
// plus "Light Novel": "Overlord Light Novel", slug overlord-light-novel,
// volumes "Overlord Light Novel, Vol. 3". Plain words, not "(Light Novel)":
// seriesName and seriesOf drop anything in brackets
const SUFFIX = "Light Novel";
const ENDS_IN_SUFFIX = /\s+light\s+novel$/i;

export const isNovelName = (name: string) => ENDS_IN_SUFFIX.test(name.trim());

// "Overlord" -> "Overlord Light Novel" (already one: as it is)
export const novelName = (name: string) =>
  isNovelName(name) ? name.trim() : `${name.trim()} ${SUFFIX}`;

// "Overlord Light Novel" -> "Overlord"
export const baseName = (name: string) =>
  name.trim().replace(ENDS_IN_SUFFIX, "");

// the name prices know a shelf entry by
export const priceName = (manga: { name: string; lightNovel?: boolean }) =>
  manga.lightNovel ? novelName(manga.name) : manga.name;
