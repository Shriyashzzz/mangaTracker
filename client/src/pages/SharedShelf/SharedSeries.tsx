// One series on a shared shelf, as a cover card or a compact row, with a row
// of ticks for the volumes its owner has.
import { useState } from "react";
import { placeText } from "../../lib/reading";
import KeepRanges from "../../components/keepRanges/KeepRanges";
import { StarIcon } from "../../components/icons/Icons";
import StarRating from "../../components/starRating/StarRating";
import { addToRead } from "./addToRead";
import { SeriesCover } from "./SeriesSheet";
import {
  ownedVolumesOf,
  shelfOf,
  volumeRanges,
  type SharedManga,
} from "./shareParts";
import { shareStyles as styles } from "./styles";
import { plural } from "./sharedShelfView";

// which volumes its owner has: "Owns vol. 3", "Owns vols. 1–5, 8, 14". (It
// said "Vol. 3", which read as the volume they were on)
const ownsText = (owned: number[]) =>
  `Owns ${owned.length === 1 ? "vol." : "vols."} ${volumeRanges(owned)}`;

// Beside the visitor's own shelf (compare.ts): whether they have this
// series too. Not given when there's nothing to compare with (signed out,
// or their own shelf)
type Mine = "have" | "dont" | undefined;

// "+ To read" on a row they don't have: saves it to their own To read list
// without opening the sheet. `onAdded` reloads their shelf, after which the
// row says "On yours"
function QuickAdd({ m, onAdded }: { m: SharedManga; onAdded: () => void }) {
  const [state, setState] = useState<"" | "saving" | "failed">("");
  const add = async () => {
    setState("saving");
    if (await addToRead(m)) onAdded();
    else setState("failed");
  };
  return (
    <button
      type="button"
      className={styles.quickAdd}
      disabled={state === "saving"}
      aria-label={`Add ${m.name} to my To read list`}
      onClick={add}
    >
      {state === "failed" ? "Try again" : "+ To read"}
    </button>
  );
}

// "Top pick", with a star: on a series its owner put at the top of their
// shelf (TopPick.tsx), so a visitor can tell it's one of their favourites
// wherever it turns up in the lists
function TopPickStamp({ onCover = false }: { onCover?: boolean }) {
  return (
    <span className={onCover ? styles.topStampOnCover : styles.topStamp}>
      <StarIcon filled />
      Top pick
    </span>
  );
}

// "I have this", on a row, for a visitor without an account: marks the
// series as one of theirs too (lib/sharePicks.ts). Pressed again, unmarks it
function HaveThis({
  m,
  picked,
  onToggle,
}: {
  m: SharedManga;
  picked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={picked ? styles.haveThisOn : styles.quickAdd}
      aria-pressed={picked}
      aria-label={`I have ${m.name} too`}
      onClick={onToggle}
    >
      {picked ? "Yours too" : "I have this"}
    </button>
  );
}

export function SeriesCard({
  m,
  pointHere,
  isTopPick,
  mine,
  onOpen,
}: {
  m: SharedManga;
  pointHere: boolean;
  // its owner put it at the top of their shelf
  isTopPick: boolean;
  mine?: Mine;
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
        <SeriesCover
          m={m}
          className={styles.cover}
          sizes="(max-width: 720px) 110px, 160px"
        >
          {m.status && <span className={styles.stamp}>Done</span>}
          {isTopPick && <TopPickStamp onCover />}
          {pointHere && (
            <span className={styles.tapMe} aria-hidden>
              Tap me
            </span>
          )}
        </SeriesCover>
        <span className={styles.cardName}>{m.name}</span>
        <span className={styles.cardMeta}>
          {owned.length ? (
            <span className={styles.cardVols}>
              <KeepRanges text={ownsText(owned)} />
            </span>
          ) : (
            "No volumes yet"
          )}
          {/* a saved place only: never "ch. 0" */}
          {!m.status &&
            placeText(m, "both", true) &&
            ` · ${placeText(m, "both", true)}`}
        </span>
        {m.rating ? <StarRating value={m.rating} size="sm" /> : null}
        {mine === "have" && <span className={styles.onYours}>On yours</span>}
      </button>
    </li>
  );
}

// the same series as a compact row: what they own comes first
export function SeriesRow({
  m,
  pointHere,
  isTopPick,
  mine,
  onAdded,
  pick,
  onOpen,
}: {
  m: SharedManga;
  pointHere: boolean;
  isTopPick: boolean;
  mine?: Mine;
  // after "+ To read" has saved it
  onAdded: () => void;
  // for a visitor without an account: whether they've marked it as theirs
  // too, and what marks it. Not given once they're signed in
  pick?: { picked: boolean; onToggle: () => void };
  onOpen: () => void;
}) {
  const owned = ownedVolumesOf(m);
  const more = [!m.status && placeText(m, "both", true)].filter(Boolean);
  return (
    <li className={styles.row}>
      <button
        type="button"
        // room at the right for what sits there: "On yours", "+ To read",
        // "I have this", or the first visit's "Tap me"
        className={
          mine || pick || pointHere ? styles.rowCardCompared : styles.rowCard
        }
        aria-haspopup="dialog"
        aria-label={`${m.name}: ${owned.length ? `owns ${plural(owned.length, "volume")}` : "no volumes yet"}. Open`}
        onClick={onOpen}
      >
        <SeriesCover m={m} className={styles.rowCover} sizes="60px" />
        <span className={styles.rowText}>
          <span className={styles.rowName}>{m.name}</span>
          <span className={styles.cardMeta}>
            {owned.length ? (
              <span className={styles.cardVols}>
                <KeepRanges text={ownsText(owned)} />
              </span>
            ) : (
              "No volumes yet"
            )}
          </span>
          <VolumeTicks owned={owned} />
          {/* one line for the rest, so every row is the same height */}
          <span className={styles.rowMore}>
            {isTopPick && <TopPickStamp />}
            {more.length > 0 && <span>{more.join(" · ")}</span>}
            {m.rating ? <StarRating value={m.rating} size="sm" /> : null}
          </span>
        </span>
        {pointHere && (
          <span className={styles.rowTapMe} aria-hidden>
            Tap me
          </span>
        )}
        {mine === "have" && <span className={styles.rowOnYours}>On yours</span>}
      </button>
      {mine === "dont" && <QuickAdd m={m} onAdded={onAdded} />}
      {/* (not on the row that says "Tap me": the two would sit on top of
          each other) */}
      {pick && !pointHere && <HaveThis m={m} {...pick} />}
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
