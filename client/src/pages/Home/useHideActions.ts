// The New tab's Hide, Hide all, Unhide and Unhide all, and the note with the
// undo they leave ("Hidden: Berserk · Undo"). Hiding saves how far they've
// seen; the undo puts back exactly what was there before. The note leaves on
// its own (useLingeringNote), and focus moves to its Undo, since the card it
// came from is gone.
import { useEffect, useState } from "react";
import { isStillNew, type SeenKind } from "../../lib/releaseMath";
import type { Manga } from "../../lib/types";
import { useShelf } from "../../store/shelf";
import { useLingeringNote } from "./useLingeringNote";
import {
  isGrouped,
  isHiddenAs,
  newestOf,
  SEEN_KIND,
  seenOf,
  type ReleaseKind,
  type Releases,
} from "./shelfViews";

type Before = { id: number; previous: number | null; previousList: number[] };
// the last Hide or Unhide, for its undo
export type Hidden = Before & {
  name: string;
  kind: SeenKind;
  // true when they've just brought it back rather than hidden it
  restored?: boolean;
  // after Hide all or Unhide all: everything to put back for the undo
  others?: Before[];
};

const before = (m: Manga, kind: SeenKind): Before => ({
  id: m.id,
  previous: seenOf(m, kind),
  previousList: m.hiddenVolumes ?? [],
});

export function useHideActions({
  releases,
  releaseKind,
  viewingHidden,
  shown,
  closeRelease,
}: {
  releases: Releases;
  releaseKind: ReleaseKind;
  // on the list of what they've hidden: Hide is Unhide there
  viewingHidden: boolean;
  // what the view shows right now (Hide all hides these)
  shown: Manga[];
  // closes the grouped list (ReleaseModal) when its last entry is hidden
  closeRelease: () => void;
}) {
  const markSeen = useShelf((s) => s.markSeen);
  const [hidden, setHidden] = useState<Hidden | null>(null);
  const [failed, setFailed] = useState(false);
  const note = useLingeringNote(hidden, failed, setHidden, setFailed);
  // the card that was just hidden is gone, so its focus moves to the undo
  useEffect(() => {
    if (hidden)
      note.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [hidden, note]);

  const kind = SEEN_KIND[releaseKind];

  const hide = async (m: Manga) => {
    const found = releases[m.id];
    const grouped = isGrouped(found, releaseKind);
    const newest = newestOf(found, releaseKind);
    if (newest == null) return;
    const was = before(m, kind);
    setFailed(false);
    // clearing what they've hidden is what puts it back on the list
    const restored = viewingHidden;
    const saved = await markSeen(
      m.id,
      kind,
      restored ? null : newest,
      kind === "volume" && (restored || grouped) ? [] : undefined,
    );
    if (saved) setHidden({ ...was, name: m.name, kind, restored });
    else setFailed(true);
  };

  // from the grouped list: part of it hidden. The last of it closes the list and
  // offers the undo, as hiding the whole card does
  const hideFromList = async (
    m: Manga,
    number: number | null,
    list?: number[],
  ) => {
    const was = before(m, kind);
    const found = releases[m.id];
    const saved = await markSeen(m.id, kind, number, list);
    if (!saved) return false;
    const changed: Manga = {
      ...m,
      ...(kind === "volume" ? { seenVolume: number } : {}),
      ...(kind === "chapter" ? { seenChapter: number } : {}),
      ...(kind === "japan" ? { seenJapanVolume: number } : {}),
      ...(list ? { hiddenVolumes: list } : {}),
    };
    if (found && !isStillNew(kind, changed, found)) {
      closeRelease();
      setHidden({ ...was, name: m.name, kind });
    }
    return true;
  };

  // several at once, then one note for all of them
  const many = async (
    series: { m: Manga; number: number | null; list?: number[] }[],
    summary: { name: string; restored?: boolean },
  ) => {
    const others = series.map(({ m }) => before(m, kind));
    setFailed(false);
    const saved = await Promise.all(
      series.map(({ m, number, list }) => markSeen(m.id, kind, number, list)),
    );
    if (saved.every(Boolean))
      setHidden({
        id: 0,
        previous: null,
        previousList: [],
        kind,
        others,
        ...summary,
      });
    else setFailed(true);
  };

  // everything hidden that the view shows (on a pile's page, that pile),
  // back on the list at once
  const unhideAll = async () => {
    const series = shown.filter((m) => isHiddenAs(releases[m.id], releaseKind));
    await many(
      series.map((m) => ({
        m,
        number: null,
        list: kind === "volume" ? [] : undefined,
      })),
      { name: `${series.length} series`, restored: true },
    );
  };

  // every card shown, hidden as its own "Hide" would. The undo puts each back
  // as it was
  const hideAll = async () => {
    const series = shown.flatMap((m) => {
      const found = releases[m.id];
      const newest = newestOf(found, releaseKind);
      return newest == null
        ? []
        : [
            {
              m,
              number: newest,
              list:
                kind === "volume" && isGrouped(found, releaseKind)
                  ? []
                  : undefined,
            },
          ];
    });
    if (!series.length) return;
    await many(series, {
      name: series.length === 1 ? series[0]!.m.name : `${series.length} series`,
    });
  };

  const undo = async () => {
    if (!hidden) return;
    const { id, kind, previous, previousList, others } = hidden;
    setHidden(null);
    if (others) {
      const saved = await Promise.all(
        others.map((o) =>
          markSeen(
            o.id,
            kind,
            o.previous,
            kind === "volume" ? o.previousList : undefined,
          ),
        ),
      );
      if (!saved.every(Boolean)) setFailed(true);
      return;
    }
    const list = kind === "volume" ? previousList : undefined;
    if (!(await markSeen(id, kind, previous, list))) setFailed(true);
    // back on the card it came from
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-seen-id="${id}"]`)
        ?.focus({ preventScroll: true }),
    );
  };

  return {
    hidden,
    failed,
    note,
    hide,
    hideFromList,
    hideAll,
    unhideAll,
    undo,
  };
}
