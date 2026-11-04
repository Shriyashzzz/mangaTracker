// The key a series' saved volume list is stored under (series_volumes). The
// version changes when the rules for which books belong change, so lists built
// by older rules are left behind and each series is looked up afresh once.
// v3: light novels told apart from the manga (see lightNovel.ts)
import { seriesOf } from "./stores/match.js";

export const VOLUMES_KEY_VERSION = "v3:";
export const volumesKey = (name: string) => VOLUMES_KEY_VERSION + seriesOf(name);
