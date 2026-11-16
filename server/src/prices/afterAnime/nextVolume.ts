// The volume a season's next chapter is in, when MangaUpdates doesn't say:
// from where each volume starts, as the release check saved it (MangaDex or
// Wikipedia; releaseCache.ts storedVolumeStarts, never a lookup). Vinland
// Saga's season 2 ends at chapter 100, the last of vol. 14; chapter 101
// opens vol. 15. Without it the page buys the volume the season ends in,
// the safe pick, while New and Buy next (which do know) say the next one.
//
// Only an answer that agrees with MangaUpdates is taken: the volume the
// season ends in, or the one after it. Anything else means the two number
// the chapters differently, and the safe pick stays
import { volumeOfChapter } from "../../util/releases/volumeStarts.js";
import type { VolumeStart } from "../../util/releases/volumeStarts.js";
import type { ShownStop } from "./animeFixes.js";

export function withNextVolumes<S extends ShownStop>(
  stops: S[],
  starts: VolumeStart[],
): S[] {
  if (!starts.length) return stops;
  return stops.map((stop) => {
    if (
      stop.nextVolume != null ||
      stop.nextChapter == null ||
      stop.endVolume == null
    )
      return stop;
    const holds = volumeOfChapter(stop.nextChapter, starts);
    const agrees = holds === stop.endVolume || holds === stop.endVolume + 1;
    return agrees ? { ...stop, nextVolume: holds } : stop;
  });
}
