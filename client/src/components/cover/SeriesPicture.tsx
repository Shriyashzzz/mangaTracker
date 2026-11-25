// A series' cover, wherever one is shown. The one rule for which picture
// that is, in order:
//
//   1. the English cover (its first US volume's), where we know it
//   2. the Japanese cover: AniList's, saved with the series
//   3. any other cover saved with it (MyAnimeList's or Kitsu's, from a
//      list import)
//   4. a cover drawn from its name (DrawnCover), so it's never an empty
//      frame
//
// New's In Japan side swaps 1 and 2 (`japanFirst`). A cover the reader
// pasted a link to is theirs and is shown as it is. The server chooses
// between 1 and 2 (lib/coverSizes.ts says how it's asked).
//
// Fills its box: the box around it must be `relative` and have a size. A
// light novel's cover says so across its foot (LightNovelBand).
import { useState } from "react";
import { novelParts, priceName } from "../../lib/prices";
import DrawnCover from "../drawnCover/DrawnCover";
import Cover from "./Cover";
import LightNovelBand from "./LightNovelBand";

type Props = {
  // the series' name: what the English cover is found by, and what the
  // drawn cover letters
  name: string;
  // a light novel on a shelf: its English cover is the novel's, not the
  // manga's of the same name
  lightNovel?: boolean;
  // the cover saved with it, if any
  url?: string | null;
  // how wide it's drawn, as an <img>'s `sizes`
  sizes: string;
  alt?: string;
  // the page's main cover: fetched straight away
  eager?: boolean;
  japanFirst?: boolean;
  // for the drawn cover, where a page letters it differently
  drawnClassName?: string;
};

export default function SeriesPicture({
  name,
  lightNovel,
  url,
  sizes,
  alt,
  eager,
  japanFirst,
  drawnClassName,
}: Props) {
  // which picture turned out not to exist, so a new one gets its own try
  const wanted = `${name}\n${url ?? ""}`;
  const [failed, setFailed] = useState<string | null>(null);
  const band =
    lightNovel || novelParts(name).lightNovel ? <LightNovelBand /> : null;
  if (failed === wanted)
    return (
      <>
        <DrawnCover title={novelParts(name).title} className={drawnClassName} />
        {band}
      </>
    );
  return (
    <>
      <Cover
        url={url}
        series={priceName({ name, lightNovel })}
        japanFirst={japanFirst}
        sizes={sizes}
        alt={alt}
        eager={eager}
        className="absolute inset-0 size-full object-cover"
        onFail={() => setFailed(wanted)}
      />
      {band}
    </>
  );
}
