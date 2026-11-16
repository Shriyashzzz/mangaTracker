// The import's rows AniList didn't find, each with the name the site knows
// that it's a slip of the finger from ("one peice 114": One Piece), asked of
// the server's list (lib/knownNames.ts), not AniList. Only offered on the
// row ("Did you mean One Piece?"), never picked for them, as every search's
// typo help is (lib/nearMatches.ts)
import { useEffect, useState } from "react";
import { knownNamesNear } from "../../lib/knownNames";
import { plain } from "../../lib/anilist";
import { nearBothWays } from "../../lib/nearMatches";

// rows asked about, at most: one request each, well under the server's 60
// a minute
const MOST_ASKED = 20;
// the lengths the server takes a search at (a 400-character junk row isn't
// a typo of anything)
const askable = (title: string) => {
  const length = withoutVolume(title).length;
  return length >= 2 && length <= 100;
};

// "one peice 114" is asked as "one peice": a volume number on the end is in
// no series' name
export const withoutVolume = (title: string) =>
  title.replace(/[\s,]+(vol(ume)?\.?\s*)?#?\d{1,3}$/i, "").trim() || title;

export function useNearNames(titles: string[]) {
  const [near, setNear] = useState(new Map<string, string>());
  // as one string, so a list that's the same again doesn't ask again
  const asked = [...new Set(titles)]
    .filter(askable)
    .slice(0, MOST_ASKED)
    .join("\n");

  useEffect(() => {
    if (!asked) return;
    const controller = new AbortController();
    void (async () => {
      const found = new Map<string, string>();
      for (const title of asked.split("\n")) {
        const bare = withoutVolume(title);
        const names = await knownNamesNear(bare, controller.signal);
        if (controller.signal.aborted) return;
        // the closest that's near both ways, and isn't just the title again
        const name = names.find(
          (n) => plain(n) !== plain(bare) && nearBothWays(bare, n),
        );
        if (name) found.set(title, name);
      }
      setNear(found);
    })();
    return () => controller.abort();
  }, [asked]);

  return near;
}
