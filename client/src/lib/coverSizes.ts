// A series cover at the size it's shown. AniList keeps each cover at three
// widths under one file name, so a 44px thumbnail needn't download the 460px
// picture saved on the shelf. Given to an <img> as srcSet, beside a `sizes`
// that says how wide it's drawn; the browser picks. Never wider than the one
// saved, and a cover from anywhere else is left alone.
const ANILIST =
  /^(https:\/\/s4\.anilist\.co\/file\/anilistcdn\/media\/manga\/cover\/)(small|medium|large)(\/[^?#]+)$/;
const WIDTHS = [
  ["small", 100],
  ["medium", 230],
  ["large", 460],
] as const;

export const coverSet = (url?: string | null) => {
  const found = url?.match(ANILIST);
  if (!found) return undefined;
  const [, base, saved, file] = found;
  const upTo = WIDTHS.findIndex(([name]) => name === saved);
  return WIDTHS.slice(0, upTo + 1)
    .map(([name, width]) => `${base}${name}${file} ${width}w`)
    .join(", ");
};
