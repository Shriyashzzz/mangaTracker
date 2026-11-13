// One series on a shared shelf, as a cover card or a compact row, with a row
// of ticks for the volumes its owner has.
import { placeText } from "../../lib/reading";
import StarRating from "../../components/starRating/StarRating";
import { Cover } from "./SeriesSheet";
import {
  ownedVolumesOf,
  shelfOf,
  volumeRanges,
  type SharedManga,
} from "./shareParts";
import { shareStyles as styles } from "./styles";
import { plural } from "./sharedShelfView";

export function SeriesCard({
  m,
  pointHere,
  onOpen,
}: {
  m: SharedManga;
  pointHere: boolean;
  onOpen: () => void;
}) {
  const owned = ownedVolumesOf(m);
  return (
    <li>
      <button
        type="button"
        className={styles.card}
        aria-haspopup="dialog"
        aria-label={`${m.name}: ${owned.length ? `owns ${plural(owned.length, "volume")}` : "no volumes yet"}. Open`}
        onClick={onOpen}
      >
        <Cover m={m} className={styles.cover}>
          {m.status && <span className={styles.stamp}>Done</span>}
          {pointHere && (
            <span className={styles.tapMe} aria-hidden>
              Tap me
            </span>
          )}
        </Cover>
        <span className={styles.cardName}>{m.name}</span>
        <span className={styles.cardMeta}>
          {owned.length ? (
            <span className={styles.cardVols}>Vol. {volumeRanges(owned)}</span>
          ) : (
            "No volumes yet"
          )}
          {/* a saved place only: never "ch. 0" */}
          {!m.status &&
            placeText(m, "both", true) &&
            ` · ${placeText(m, "both", true)}`}
          {m.lightNovel && " · novel"}
        </span>
        {m.rating ? <StarRating value={m.rating} size="sm" /> : null}
      </button>
    </li>
  );
}

// the same series as a compact row: what they own comes first
export function SeriesRow({
  m,
  pointHere,
  onOpen,
}: {
  m: SharedManga;
  pointHere: boolean;
  onOpen: () => void;
}) {
  const owned = ownedVolumesOf(m);
  const more = [
    !m.status && placeText(m, "both", true),
    m.lightNovel && "light novel",
  ].filter(Boolean);
  return (
    <li className={styles.row}>
      <button
        type="button"
        className={styles.rowCard}
        aria-haspopup="dialog"
        aria-label={`${m.name}: ${owned.length ? `owns ${plural(owned.length, "volume")}` : "no volumes yet"}. Open`}
        onClick={onOpen}
      >
        <Cover m={m} className={styles.rowCover} />
        <span className={styles.rowText}>
          <span className={styles.rowName}>{m.name}</span>
          <span className={styles.cardMeta}>
            {owned.length ? (
              <span className={styles.cardVols}>
                Vol. {volumeRanges(owned)}
              </span>
            ) : (
              "No volumes yet"
            )}
          </span>
          <VolumeTicks owned={owned} />
          {/* one line for the rest, so every row is the same height */}
          <span className={styles.rowMore}>
            {more.length > 0 && <span>{more.join(" · ")}</span>}
            {m.rating ? <StarRating value={m.rating} size="sm" /> : null}
          </span>
        </span>
        {pointHere && (
          <span className={styles.rowTapMe} aria-hidden>
            Tap me
          </span>
        )}
      </button>
    </li>
  );
}

// the volumes they own as a strip of ticks, 1 to the furthest: a gap shows
// as an empty tick, so "1–3, 5, 8–10" can be seen at a glance
// as many ticks as the row has room for; past that, each tick stands for a run
// of volumes and is a gap if any of them is missing (the ranges say which)
const MAX_TICKS = 40;

function VolumeTicks({ owned }: { owned: number[] }) {
  if (!owned.length) return null;
  const shelf = shelfOf(owned);
  const per = Math.ceil(shelf.length / MAX_TICKS);
  const ticks = Array.from({ length: Math.ceil(shelf.length / per) }, (_, i) =>
    shelf.slice(i * per, (i + 1) * per).every((s) => s.mine),
  );
  return (
    <span className={styles.ticks} aria-hidden>
      {ticks.map((mine, i) => (
        <span key={i} className={mine ? styles.tick : styles.tickGap} />
      ))}
    </span>
  );
}
