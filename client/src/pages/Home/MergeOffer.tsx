// "One series, three entries": the shelf's offer to put entries of one series
// under one name. A scan, a price page and the add form used to name a series
// each their own way ("Vagabond Definitive Edition", "Vagabond VIZBIG
// Edition", "Vagabond"); new ones land on one entry now, and this tidies up
// the ones already apart. lib/sameSeries.ts finds them.
//
// Each entry has a tick, all ticked to start: untick one to leave it out.
// Nothing changes until Merge is pressed, and "Keep them apart" is remembered
// on this device, so the same offer doesn't come back.
import { useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { readLocal, writeLocal } from "../../lib/prefs";
import { entryToKeep, sameSeriesGroups } from "../../lib/sameSeries";
import { ownedOf } from "../../lib/ownedVolumes";
import type { Manga } from "../../lib/types";
import { useShelf } from "../../store/shelf";
import SeriesPicture from "../../components/cover/SeriesPicture";
import { ownedTextOf } from "../../components/mangaCard/cardText";

const KEPT_APART_KEY = "mergeKeptApart";
const MOST_REMEMBERED = 200;

const keptApart = (): string[] => {
  try {
    const kept: unknown = JSON.parse(readLocal(KEPT_APART_KEY) ?? "[]");
    return Array.isArray(kept) ? kept.map(String) : [];
  } catch {
    return [];
  }
};

// what an entry holds, in a few words: what they own of it, or where it is
const whatItHolds = (manga: Manga) => {
  const owned = ownedTextOf(ownedOf(manga));
  if (owned) return owned;
  if (manga.status) return "finished";
  return manga.planned ? "to read" : "reading";
};

const countWord = (n: number) =>
  ["no", "one", "two", "three", "four", "five", "six"][n] ?? String(n);

export default function MergeOffer({ shelf }: { shelf: Manga[] }) {
  const [apart, setApart] = useState(keptApart);
  const groups = useMemo(
    () => sameSeriesGroups(shelf).filter((g) => !apart.includes(g.key)),
    [shelf, apart],
  );
  const group = groups[0];
  // the ones unticked, for the group showing
  const [left, setLeft] = useState<{ key: string; ids: number[] }>({
    key: "",
    ids: [],
  });
  const [merging, setMerging] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!group) return null;

  const leftOut = left.key === group.key ? left.ids : [];
  const ticked = group.entries.filter((e) => !leftOut.includes(e.id));
  const toggle = (id: number) =>
    setLeft({
      key: group.key,
      ids: leftOut.includes(id)
        ? leftOut.filter((x) => x !== id)
        : [...leftOut, id],
    });

  const keepApart = () => {
    const next = [...apart, group.key].slice(-MOST_REMEMBERED);
    writeLocal(KEPT_APART_KEY, JSON.stringify(next));
    setApart(next);
    setFailed(false);
  };

  const merge = async () => {
    const keep = entryToKeep(ticked);
    if (!keep || ticked.length < 2) return;
    setMerging(true);
    setFailed(false);
    try {
      const res = await apiFetch(`/api/manga/${keep.id}/merge`, {
        method: "POST",
        body: { otherIds: ticked.filter((e) => e !== keep).map((e) => e.id) },
      });
      if (!res.ok) throw new Error(`merge ${res.status}`);
      await useShelf.getState().load();
    } catch {
      setFailed(true);
    } finally {
      setMerging(false);
    }
  };

  return (
    <section
      className="mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-8 gap-y-3.5 rounded-ink border-[2.5px] border-line bg-card px-[1.15rem] pt-4 pb-[1.05rem] shadow-ink upto-720:mb-4 upto-720:grid-cols-[minmax(0,1fr)] upto-720:px-3.5 upto-720:pt-3.5 upto-720:pb-4"
      aria-labelledby="merge-offer-title"
    >
      <div>
        <h2
          id="merge-offer-title"
          className="font-brand text-[1.45rem] leading-none font-normal tracking-[1px] uppercase"
        >
          One series, {countWord(group.entries.length)} entries
          {groups.length > 1 && (
            <span className="ml-2.5 font-mono text-[0.75rem] tracking-normal text-muted normal-case">
              1 of {groups.length}
            </span>
          )}
        </h2>
        <p className="mt-1.5 max-w-[60ch] text-[0.95rem] text-ink-soft">
          These look like <strong className="text-ink">{group.name}</strong>.
          Tick the ones to put under one name. Your volumes, notes and ratings
          stay, and each book keeps its edition.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-[1.1rem] gap-y-1">
        <button
          type="button"
          className="btn btn-primary upto-720:flex-1"
          onClick={merge}
          disabled={merging || ticked.length < 2}
        >
          {merging
            ? "Merging…"
            : ticked.length < 2
              ? "Tick two or more"
              : `Merge ${ticked.length} into ${group.name}`}
        </button>
        <button
          type="button"
          className="tap py-2.5 text-[0.92rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-current"
          onClick={keepApart}
          disabled={merging}
        >
          Keep them apart
        </button>
      </div>

      <ul className="col-span-full flex flex-wrap gap-x-6 gap-y-3 border-t-[1.5px] border-dashed border-line-soft pt-3.5 upto-720:flex-col upto-720:gap-y-2.5">
        {group.entries.map((entry) => {
          const on = !leftOut.includes(entry.id);
          return (
            <li key={entry.id} className="min-w-0">
              <label
                className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 transition-opacity duration-120 ${on ? "" : "opacity-55"}`}
              >
                <input
                  type="checkbox"
                  className="size-5 shrink-0 cursor-pointer accent-accent"
                  checked={on}
                  onChange={() => toggle(entry.id)}
                  disabled={merging}
                />
                <span className="relative block aspect-2/3 w-[38px] shrink-0 border-[1.5px] border-line bg-paper-2">
                  <SeriesPicture
                    name={entry.name}
                    lightNovel={entry.lightNovel}
                    url={entry.image}
                    sizes="38px"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[0.98rem] leading-[1.2] font-semibold wrap-anywhere">
                    {entry.name}
                  </span>
                  <span className="font-mono text-[0.76rem] text-muted">
                    {whatItHolds(entry)}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {failed && (
        <p className="col-span-full text-[0.9rem] text-accent" role="alert">
          That didn't merge. Try again.
        </p>
      )}
    </section>
  );
}
