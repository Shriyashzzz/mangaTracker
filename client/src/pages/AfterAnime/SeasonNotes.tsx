// What else a season's answer carries: what its source says is worth
// knowing ("Skips Chap 80-81"), and that a reader corrected it.
import type { AnimeStop } from "../../lib/afterAnimeText";
import { afterAnimeStyles as styles } from "./styles";

export default function SeasonNotes({ stop }: { stop: AnimeStop }) {
  return (
    <>
      {stop.note && <p className={styles.note}>Worth knowing: {stop.note}</p>}
      {stop.corrected && (
        <span className={styles.corrected}>Corrected by a reader</span>
      )}
    </>
  );
}
