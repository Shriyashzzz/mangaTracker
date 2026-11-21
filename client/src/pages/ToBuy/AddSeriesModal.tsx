// "Add it to your shelf?": after On my shelf or Ordered on To buy, for a
// series that isn't on the shelf. Its cover and how many volumes are out in
// English, so they can see it's the right series; its name, cleaned from the
// store's title and theirs to correct (nothing is added under a name they
// didn't see); the series' spines, the book already ticked (or striped,
// ordered), to tick the ones they own already; To read or Reading (To read
// unless they say: it's new to the shelf), with where they've read up to
// when reading; and "Don't ask again" (Settings, Your shelf, turns it back
// on). An edition's book adds the series as that edition, and its books are
// ticked on its page. The server
// adds it with the book's volumes when they're certain, or puts them on the
// series already there by that name (server toBuy.ts addFromToBuy).
// The dialog the list's "Clear your To buy list?" is (native: focus trap,
// Escape, backdrop), with its styles.
import { useEffect, useRef, useState, type FormEvent } from "react";
import SeriesPicture from "../../components/cover/SeriesPicture";
import VolumeShelf from "../../components/volumeShelf/VolumeShelf";
import { getSeries } from "../../lib/prices";
import { onSale } from "../../lib/releaseDate";
import type { Series } from "../../lib/types";
import { homeStyles as styles } from "../Home/styles";
import { savePrefs } from "../../lib/prefs";
import { novelParts } from "../../lib/prices";
import {
  addSeriesFromToBuy,
  type AddedFromToBuy,
  type Settled,
  type ToBuyItem,
} from "../../lib/toBuy";
import { useAuth } from "../../store/auth";

type Props = {
  item: ToBuyItem;
  settled: Settled;
  how: "owned" | "ordered";
  // the book's own name, as the list says it
  bookName: string;
  // added (or put on the one there); null: not now
  // with the volumes they ticked, for the toast
  onDone: (added: AddedFromToBuy | null, ticked: number[]) => void;
};

const field =
  "border-[1.5px] border-line bg-card px-3 py-2 text-[1rem] text-ink focus:outline-2 focus:outline-offset-2 focus:outline-accent";

export default function AddSeriesModal({
  item,
  settled,
  how,
  bookName,
  onDone,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const [name, setName] = useState(() => novelParts(settled.series).title);
  const [planned, setPlanned] = useState(true);
  // the series as the price pages know it: its cover and volumes out.
  // Looked up by the name in the box (again when they correct it), strictly:
  // a near miss would show another series' cover over their name.
  // undefined while it's asked; null when it couldn't be found
  const [lookedUp, setLookedUp] = useState(name);
  const [found, setFound] = useState<{
    name: string;
    series: Series | null;
  } | null>(null);
  const plain = lookedUp.trim();
  const series = !plain
    ? null
    : found?.name === plain
      ? found.series
      : undefined;
  useEffect(() => {
    if (!plain) return;
    const asked = new AbortController();
    getSeries(
      settled.lightNovel ? `${plain} Light Novel` : plain,
      asked.signal,
      true,
    )
      .then((s) => setFound({ name: plain, series: s }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setFound({ name: plain, series: null });
      });
    return () => asked.abort();
  }, [plain, settled.lightNovel]);
  // the book's volumes, owned when bought; the others they tick
  const book = settled.volumes ?? [];
  const [owned, setOwned] = useState<number[]>(how === "owned" ? book : []);
  const [chapter, setChapter] = useState("");
  // how many are out in English: the shelf has that many spines (or as many
  // as the volumes ticked, when the catalog knows fewer)
  const out = series
    ? onSale(series.volumes)
        .map((v) => v.volume)
        .filter((v): v is number => v != null && Number.isInteger(v))
    : [];
  const outCount = out.length ? Math.max(...out) : 0;
  const spines = Math.max(outCount, ...book, ...owned, 1);
  const [dontAsk, setDontAsk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState("");
  // what the dialog ends with, said to the page once it's closed
  const result = useRef<AddedFromToBuy | null>(null);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  // "Don't ask again", whichever way it closes
  const close = () => {
    if (dontAsk) savePrefs({ offerAdd: "off" }, isSignedIn);
    dialog.current?.close();
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFailed("");
    try {
      const read = Number(chapter);
      result.current = await addSeriesFromToBuy(item.isbn13, {
        name: name.trim(),
        planned,
        how,
        owned,
        bookmark: !planned && Number.isInteger(read) && read > 0 ? read : null,
      });
      close();
    } catch (error) {
      setFailed((error as Error).message);
      setSaving(false);
    }
  };

  const sure = Boolean(settled.volumes?.length);
  return (
    <dialog
      ref={dialog}
      className={`${styles.confirm} app-sheet-dialog`}
      aria-labelledby="add-series-title"
      onClose={() => onDone(result.current, owned)}
      onCancel={(e) => {
        // not while it's saving: the page has to hear how it went
        if (saving) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target === dialog.current && !saving) close();
      }}
    >
      <form
        className={`${styles.confirmBox} max-h-[86dvh] overflow-y-auto pb-0`}
        onSubmit={add}
        noValidate
      >
        <h2 id="add-series-title" className={styles.confirmTitle}>
          Add it to your shelf?
        </h2>
        {/* is it the right series? its cover and what's out */}
        <div className="mt-3 flex items-center gap-3">
          <span className="relative block aspect-[2/3] w-14 shrink-0 overflow-hidden border-[1.5px] border-line bg-paper-2 [&_img]:size-full [&_img]:object-cover">
            <SeriesPicture
              name={name || settled.series}
              url={series?.info?.coverUrl ?? null}
              sizes="56px"
            />
          </span>
          <span className="text-[0.88rem] leading-[1.35] text-ink-soft">
            <b className="block text-[1rem] text-ink">
              {series?.info?.name ?? (name || settled.series)}
            </b>
            {series === undefined
              ? "Looking it up…"
              : outCount
                ? `${outCount} volume${outCount === 1 ? "" : "s"} out in English`
                : "Not in the catalog yet"}
          </span>
        </div>
        <p className={styles.confirmBody}>
          {bookName} is {how === "owned" ? "yours" : "ordered"}, but its series
          isn't on your shelf yet.
        </p>
        <label className="mt-4 block text-[0.85rem] font-medium text-ink-soft">
          Series name
          <input
            className={`${field} mt-1 w-full`}
            value={name}
            maxLength={150}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setLookedUp(name)}
            disabled={saving}
          />
        </label>
        <fieldset className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[0.95rem]">
          <legend className="mb-1 text-[0.85rem] font-medium text-ink-soft">
            Put it in
          </legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="add-series-status"
              checked={planned}
              onChange={() => setPlanned(true)}
              disabled={saving}
            />
            To read
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="add-series-status"
              checked={!planned}
              onChange={() => setPlanned(false)}
              disabled={saving}
            />
            Reading
          </label>
        </fieldset>
        {/* reading it: where they are (optional) */}
        {!planned && (
          <label className="mt-3 flex items-center gap-2 text-[0.9rem] whitespace-nowrap text-ink-soft">
            Read up to chapter
            <input
              className={`${field} w-24`}
              inputMode="numeric"
              value={chapter}
              onChange={(e) => setChapter(e.target.value.replace(/\D/g, ""))}
              disabled={saving}
              aria-label="Read up to chapter"
            />
          </label>
        )}
        {/* the series' spines: the book ticked (or striped, ordered); tap
            or slide across the ones they own already */}
        {item.edition ? (
          <p className={styles.confirmBody}>
            It's added as that edition: tick its books on its page after.
          </p>
        ) : (
          <div className="mt-4">
            <p className="mb-1 text-[0.85rem] font-medium text-ink-soft">
              {how === "owned"
                ? "Tap any others you own"
                : "Tap the ones you own already"}
            </p>
            <VolumeShelf
              total={spines}
              owned={owned}
              onToggle={(v) =>
                setOwned((now) =>
                  now.includes(v)
                    ? now.filter((x) => x !== v)
                    : [...now, v].sort((a, b) => a - b),
                )
              }
              onPaint={setOwned}
              name={name}
              ordered={how === "ordered" ? book : []}
            />
            {!sure && (
              <p className={styles.confirmBody}>
                We can't tell which volumes this book holds: tick them here.
              </p>
            )}
          </div>
        )}
        <label className="mt-4 flex items-center gap-2 text-[0.9rem] text-ink-soft">
          <input
            type="checkbox"
            checked={dontAsk}
            onChange={(e) => setDontAsk(e.target.checked)}
            disabled={saving}
          />
          Don't ask again
        </label>
        {failed && (
          <p className={styles.confirmError} role="alert">
            {failed}
          </p>
        )}
        {/* pinned to the foot while the rest scrolls on a small screen */}
        <div
          className={`${styles.confirmActions} sticky bottom-0 -mx-5 border-t-[1.5px] border-line-soft bg-card px-5 pt-3 pb-5`}
        >
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={close}
          >
            Not now
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !name.trim()}
          >
            {saving ? "Adding…" : "Add to my shelf"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
