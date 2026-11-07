// The key a series' saved volume list is stored under (series_volumes). The
// version changes when the rules for which books belong change, so lists built
// by older rules are left behind and each series is looked up afresh once.
// v3: light novels told apart from the manga (see lightNovel.ts)
// v5: self-published books left out; Japanese-titled English editions and
// books holding several volumes ("Vinland Saga, Book 9") found
import { seriesOf } from "./stores/match.js";

// v10: Google Books fills in new and upcoming volumes, and their dates
export const VOLUMES_KEY_VERSION = "v10:";
export const volumesKey = (name: string) =>
  VOLUMES_KEY_VERSION + seriesOf(name);
