// What the "after the anime" pages say about themselves to search engines
// and link previews: title, description, address. Pure.
import type { AfterAnime } from "../../lib/afterAnime";
import { startText } from "../../lib/afterAnimeText";
import type { PageMeta } from "../../lib/seo";

export const INDEX_META: PageMeta = {
  title: "Where does the anime leave off in the manga?",
  description:
    "Finished a season? Look up the anime and see which manga chapter and volume to start from, with the cheapest price for that volume.",
  path: "/after-the-anime",
};

// a show's page; null while it loads. A page with no answer isn't one to
// find in a search
export function showMeta(
  show: AfterAnime | null,
  failed: boolean,
): PageMeta | null {
  if (failed) return { title: "After the anime", noindex: true };
  if (!show) return null;
  const title = `Where does the ${show.name} anime leave off in the manga?`;
  const path = `/after-the-anime/${show.slug}`;
  if (!show.stops.length) return { title, path, noindex: true };
  // the latest season is the one most people have just finished
  const latest = show.stops[show.stops.length - 1]!;
  const answer = startText(latest).toLowerCase();
  const season = latest.label === "The anime" ? "the anime" : latest.label;
  return {
    title,
    description: `After ${season} of ${show.name}, ${answer}. Every season's last chapter, the volume to buy next, and its cheapest price.`,
    path,
    image: show.coverUrl,
  };
}
