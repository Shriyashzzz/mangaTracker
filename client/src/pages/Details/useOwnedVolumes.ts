// The volume shelf by the title: each tick shows at once and saves in the
// background, one save at a time per manga. Ticks in quick succession send
// only where they ended up. A save that fails is followed by the newer state
// if one is waiting (it has the failed tick in it too); only when the last
// one fails does the shelf go back to what the server last said.
import { useRef, type Dispatch, type SetStateAction } from "react";
import { ownedVolumes, toggleVolume } from "../../lib/ownedVolumes";
import { setVolumesOwned, type Owned } from "../../lib/shelf";
import type { Manga } from "../../lib/types";
import { useShelf } from "../../store/shelf";

type Queue = { saved: Owned; next: Owned | null; saving: boolean };

export function useOwnedVolumes({
  manga,
  setManga,
  onTick,
  onFailed,
}: {
  manga: Manga | null;
  setManga: Dispatch<SetStateAction<Manga | null>>;
  // a tick, before it's saved (the page clears its notes)
  onTick: () => void;
  // the last save failed and the shelf went back
  onFailed: () => void;
}) {
  const queues = useRef(new Map<number, Queue>());

  const save = async (mangaId: number) => {
    const queue = queues.current.get(mangaId);
    if (!queue || queue.saving) return;
    queue.saving = true;
    let failed = false;
    while (queue.next) {
      const sending = queue.next;
      queue.next = null;
      try {
        queue.saved = await setVolumesOwned(mangaId, sending);
        failed = false;
      } catch {
        failed = true;
      }
    }
    queue.saving = false;
    if (failed) {
      setManga((m) => (m?.id === mangaId ? { ...m, ...queue.saved } : m));
      onFailed();
    } else {
      // the shelf's cards say what they own too
      void useShelf.getState().load();
    }
  };

  // shows what they own at once and queues its save
  const change = (next: Owned) => {
    if (!manga) return;
    if (!queues.current.has(manga.id))
      queues.current.set(manga.id, {
        saved: {
          volumesOwned: manga.volumesOwned ?? null,
          ownedList: manga.ownedList ?? [],
        },
        next: null,
        saving: false,
      });
    setManga({ ...manga, ...next });
    onTick();
    queues.current.get(manga.id)!.next = next;
    void save(manga.id);
  };

  return {
    // ticks one volume, or unticks it
    toggle: (volume: number) => manga && change(toggleVolume(manga, volume)),
    // a slide across the shelf: everything they own now
    paint: (owned: number[]) => change(ownedVolumes(null, owned)),
  };
}
