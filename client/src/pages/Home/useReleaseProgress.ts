// The New tab's release check, as the shelf page needs to know it: asking
// for it at the right moment, how far along it is, and what the last full
// check found (kept on this device, so the tab's count shows before the
// next check finishes).
import { useEffect, useMemo, useState } from "react";
import { readLocal, writeLocal } from "../../lib/prefs";
import { CHECKED_BEFORE_KEY, LAST_NEW_COUNT_KEY } from "../../lib/shelf";
import type { Manga } from "../../lib/types";
import { useShelf } from "../../store/shelf";

export function useReleaseProgress({
  manga,
  showingNew,
  rowsChosen,
  checksOn,
  newCount,
}: {
  // the shelf; null while it loads
  manga: Manga[] | null;
  // the New tab is open
  showingNew: boolean;
  // the shelf is drawn as rows, whose progress needs the latest chapter
  rowsChosen: boolean;
  // release checks are switched on in Settings
  checksOn: boolean;
  // how many series have something new, as counted now
  newCount: number;
}) {
  const releases = useShelf((s) => s.releases);
  const checkedAt = useShelf((s) => s.checkedAt);
  const checkReleases = useShelf((s) => s.checkReleases);
  const total = manga?.length ?? 0;

  // what's new for each manga. Only asked for once the New tab is opened, or
  // for anyone on rows. After that it carries on even if they leave, and new
  // titles get picked up
  useEffect(() => {
    if (checksOn && (showingNew || rowsChosen) && manga?.length)
      checkReleases();
  }, [manga, releases, showingNew, rowsChosen, checksOn, checkReleases]);

  // how many series have an answer
  const checked = (manga ?? []).filter((m) => m.id in releases).length;
  // answers are still missing, with the New tab open
  const checking = showingNew && checked < total;
  const allChecked = checked > 0 && checked >= total;
  // how old the oldest answer on show is, said quietly under the list
  const oldestCheck = useMemo(
    () =>
      Math.min(
        ...(manga ?? []).map((m) => checkedAt[m.id] ?? Infinity),
        Infinity,
      ),
    [manga, checkedAt],
  );

  // read once, as the page opens: whether a full check has ever finished on
  // this device, and how many it found
  const [checkedBefore] = useState(
    () => readLocal(CHECKED_BEFORE_KEY) !== null,
  );
  const [lastNewCount] = useState(() => {
    const saved = readLocal(LAST_NEW_COUNT_KEY);
    return saved ? Number(saved) : null;
  });
  // and kept for the next visit, each time a check finishes
  useEffect(() => {
    if (!allChecked) return;
    writeLocal(CHECKED_BEFORE_KEY, "yes");
    writeLocal(LAST_NEW_COUNT_KEY, String(newCount));
  }, [allChecked, newCount]);

  return {
    checked,
    checking,
    allChecked,
    oldestCheck,
    checkedBefore,
    lastNewCount,
  };
}
