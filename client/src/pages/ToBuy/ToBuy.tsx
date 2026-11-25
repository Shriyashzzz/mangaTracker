// /to-buy  The reader's To buy list: the volumes they kept from price pages,
// each with its cheapest new and used copy now, and what the lot costs
// (above the list, so it's there without scrolling). 24 to a page, in the
// order they pick; both live in the address (?sort=, ?page=).
// "On my shelf" (bought, theirs) and "Ordered" take one off and, when its series is on
// their shelf and the volumes it holds are certain, make them owned or on
// order there (server toBuy.ts settleToBuy). Nothing is guessed or added: a
// series not on the shelf, or an edition's book whose volumes aren't
// certain, is only taken off, and the note says what to do. A volume that
// isn't out yet says when it is, and can only be ordered. One the shelf
// already has, or has on order, says so. Stored prices only: nothing here
// asks a store.
import PullPage from "../../components/pullRefresh/PullPage";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router";
import Cover from "../../components/cover/Cover";
import LightNovelBand from "../../components/cover/LightNovelBand";
import Mascot from "../../components/mascot/Mascot";
import RangePager from "../../components/rangePager/RangePager";
import { useUrlPages } from "../../components/rangePager/useUrlPages";
import { signInPath } from "../../lib/api";
import { formatCents, novelParts, volumePath } from "../../lib/prices";
import { usePageMeta } from "../../lib/seo";
import {
  settleToBuy,
  sortToBuy,
  TO_BUY_SORTS,
  type AddedFromToBuy,
  type Settled,
  type ToBuyItem,
  type ToBuyList,
  type ToBuyPrice,
  type ToBuySort,
} from "../../lib/toBuy";
import { useAuth } from "../../store/auth";
import { useToBuy } from "../../store/toBuy";
import { pricesStyles } from "../Prices/styles";
import ClearListModal from "./ClearListModal";
import AddSeriesModal from "./AddSeriesModal";
import { runsText } from "../../lib/volumeRuns";
import Toast from "../../components/toast/Toast";
import { toastAction } from "../../components/toast/toastStyles";
import { offerAddNow } from "../../lib/prefs";
import { isDemo } from "../../lib/demo";
import { useShelf } from "../../store/shelf";
import { SortMenu } from "../Home/ShelfBar";
import { volumesStyles } from "../Home/volumesStyles";
import { CoverFallback } from "../Prices/VolumeCard";
import { releaseDay } from "../Prices/volumePageRules";
import { orOffline } from "../../lib/offline";

const styles = {
  // the sort, close above the list it orders
  // the sort at the left, "Clear list" at the right; its question wraps
  // under the sort on a phone
  controls: "-mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
  // quiet: it's rarely wanted, and it empties everything
  clearBtn:
    "tap ml-auto text-[0.9rem] text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-accent",
  list: "flex flex-col border-2 border-line bg-card shadow-ink",
  // cover, then what it is and costs, then its two buttons; on a phone the
  // buttons go under the words, side by side and the same width
  row: "grid grid-cols-[60px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b-[1.5px] border-dashed border-line-soft px-4 py-3 last:border-b-0 upto-720:grid-cols-[60px_minmax(0,1fr)]",
  cover:
    "relative block aspect-2/3 w-[60px] overflow-hidden border-[1.5px] border-line bg-paper-2 [&>img]:relative [&>img]:size-full [&>img]:object-cover",
  words: "flex min-w-0 flex-col gap-1",
  name: "tap text-[1rem] leading-snug font-semibold underline decoration-transparent underline-offset-3 hover:decoration-accent",
  prices:
    "flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[0.85rem] text-ink-soft [&_b]:font-medium [&_b]:text-ink [&_b]:tabular-nums",
  // on a phone: a pair the same width across the row, 38px tall (44 read
  // as too big here; smaller than 38 is hard to hit)
  actions:
    "flex items-center gap-x-3 gap-y-2 upto-720:col-span-2 upto-720:flex-wrap upto-720:[&_.btn]:h-[38px]",
  // Remove: quiet, it's the least wanted of the three
  removeBtn:
    "tap text-[0.88rem] text-ink-soft underline decoration-line-soft underline-offset-3 hover:text-ink hover:decoration-accent disabled:opacity-50",
  // "Already yours", "On order": under its name
  shelfTag:
    "self-start font-mono text-[0.7rem] tracking-[0.06em] text-ok uppercase",
  // how the last tap went; takes no room until there's something to say
  note: "text-[0.9rem] text-ink-soft empty:hidden",
};

// "Chainsaw Man, Vol. 3", or the book's own title when it isn't one plain
// volume (an edition's book: "Berserk Deluxe Edition, Vol. 3" is no vol. 3)
const nameOf = (item: ToBuyItem) =>
  item.volume != null && !item.edition
    ? `${novelParts(item.series).title}, Vol. ${item.volume}`
    : novelParts(item.title).title;

// What adding it did, for the toast: "Added vol. 2 of Blue Box to your
// shelf", "Blue Box was on your shelf already: vol. 2 is there now"
function addedText(a: AddedFromToBuy, ticked: number[] = []) {
  const all =
    a.done === "owned"
      ? [...new Set([...(a.volumes ?? []), ...ticked])].sort((x, y) => x - y)
      : (a.volumes ?? []);
  const which = !all.length
    ? null
    : all.length === 1
      ? `vol. ${all[0]}`
      : `vols. ${runsText(all)}`;
  if (a.added) {
    if (!which || !a.done)
      return `Added ${a.name} to your shelf. Tick the volumes it holds there.`;
    return a.done === "owned"
      ? `Added ${which} of ${a.name} to your shelf.`
      : `Added ${a.name} to your shelf, ${which} ordered.`;
  }
  if (!which || !a.done) return `${a.name} was on your shelf already.`;
  return a.done === "owned"
    ? `${a.name} was on your shelf already: ${which} is yours there now.`
    : `${a.name} was on your shelf already: ${which} is ordered there now.`;
}

// What a tap did, in words: on the shelf, or what to do now
function settledNote(item: ToBuyItem, settled: Settled): ReactNode {
  const name = nameOf(item);
  const link = (to: string, words: string) => (
    <NavLink to={to} className="font-medium text-ink underline" viewTransition>
      {words}
    </NavLink>
  );
  if (settled.done && settled.shelf)
    return (
      <>
        {name} is off the list, and{" "}
        {settled.done === "owned" ? "yours" : "ordered"} on{" "}
        {link(`/details/${settled.shelf.id}`, settled.shelf.name)}.
      </>
    );
  if (settled.shelf)
    return (
      <>
        {name} is off the list. Tick the volumes it holds on{" "}
        {link(`/details/${settled.shelf.id}`, settled.shelf.name)}.
      </>
    );
  const single = settled.volumes?.length === 1 ? settled.volumes[0] : null;
  const add = new URLSearchParams({ title: settled.series });
  if (single && settled.done === null) add.set("ownedVolume", String(single));
  return (
    <>
      {name} is off the list. {settled.series} isn't on your shelf yet:{" "}
      {link(`/add?${add}`, "add it")}.
    </>
  );
}

function Price({ label, price }: { label: string; price: ToBuyPrice }) {
  if (!price) return null;
  return (
    <span>
      {label} <b>{formatCents(price.cents)}</b> at {price.store}
    </span>
  );
}

// "New: $21.98 for all 3", or "for 2 of 3" while some have no price
function Total({
  label,
  sum,
  of,
}: {
  label: string;
  sum: ToBuyList["totals"]["new"];
  of: number;
}) {
  if (!sum.volumes) return null;
  return (
    <p className={pricesStyles.costNote}>
      {label}: <strong>{formatCents(sum.cents)}</strong> for{" "}
      {sum.volumes === of ? `all ${of}` : `${sum.volumes} of ${of}`}
    </p>
  );
}

export default function ToBuy() {
  const navigate = useNavigate();
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const { list, loadFailed, load, remove, clear } = useToBuy();
  // the volume a tap is saving, and how the last one went
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<ReactNode>("");
  // "Add it to your shelf?", for a series not on it; then what was added
  const [addAsking, setAddAsking] = useState<{
    item: ToBuyItem;
    settled: Settled;
    how: "owned" | "ordered";
  } | null>(null);
  const [added, setAdded] = useState<
    (AddedFromToBuy & { ticked: number[] }) | null
  >(null);
  const forgetAdded = useCallback(() => setAdded(null), []);
  // "Clear list" asks once more, in a dialog, before it empties the list
  const [asking, setAsking] = useState(false);
  const clearAll = async () => {
    setNote("");
    // nothing more to say: the empty page says the list is empty
    await clear();
  };

  usePageMeta({ title: "To buy", path: "/to-buy", noindex: true });

  useEffect(() => {
    if (isSignedIn === false) {
      navigate(signInPath("/to-buy"), { replace: true });
      return;
    }
    // asked again on every visit: prices move
    if (isSignedIn) void load();
  }, [isSignedIn, navigate, load]);

  // "On my shelf", "Ordered" (the server settles it), or Remove
  const settle = async (item: ToBuyItem, how: "owned" | "ordered") => {
    setBusy(item.isbn13);
    setNote("");
    try {
      const settled = await settleToBuy(item.isbn13, how);
      await load();
      // its series isn't on the shelf: asked whether to add it (unless
      // they've said not to), else said in the note as before
      if (!settled.shelf && offerAddNow() && !isDemo())
        setAddAsking({ item, settled, how });
      else setNote(settledNote(item, settled));
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const takeOff = async (item: ToBuyItem) => {
    setBusy(item.isbn13);
    setNote("");
    try {
      await remove(item.isbn13);
      setNote(`${nameOf(item)} is off the list.`);
    } catch {
      setNote(orOffline("That didn't save. Try again."));
    } finally {
      setBusy(null);
    }
  };

  // the order they picked, in the address so a reload keeps it
  const [params, setParams] = useSearchParams();
  const sort: ToBuySort =
    TO_BUY_SORTS.find((s) => s.value === params.get("sort"))?.value ?? "added";
  // a new order starts again from the first page
  const setSort = (value: ToBuySort) => {
    const next = new URLSearchParams(params);
    if (value === "added") next.delete("sort");
    else next.set("sort", value);
    next.delete("page");
    setParams(next, { replace: true });
  };

  const items = list?.items;
  const sorted = useMemo(() => sortToBuy(items ?? [], sort), [items, sort]);
  const { pageItems, pager } = useUrlPages(sorted, "to-buy-list");
  return (
    // pulled down in the app: the list and its prices asked again
    <PullPage className={`${pricesStyles.page} fade-in`} refresh={load}>
      <header className={pricesStyles.sectionHead}>
        <h1 className={pricesStyles.title}>To buy</h1>
      </header>

      {!items && !loadFailed && (
        <div className="skeleton h-40" aria-busy="true" aria-label="Loading" />
      )}

      {!items && loadFailed && (
        <div className={pricesStyles.empty} role="alert">
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="panic" />
          </span>
          <p className={pricesStyles.emptyTitle}>The list didn't load.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void load()}
          >
            Try again
          </button>
        </div>
      )}

      {items?.length === 0 && (
        <div className={pricesStyles.empty}>
          <span className="printed mascot-spot" aria-hidden>
            <Mascot mood="confused" />
          </span>
          <p className={pricesStyles.emptyTitle}>Your list is empty.</p>
          <p>Open a volume's prices and tap “+ To buy” to keep it here.</p>
          <NavLink to="/series" className="btn btn-secondary" viewTransition>
            Browse every series
          </NavLink>
        </div>
      )}

      <p className={styles.note} role="status">
        {note}
      </p>
      {addAsking && (
        <AddSeriesModal
          item={addAsking.item}
          settled={addAsking.settled}
          how={addAsking.how}
          bookName={nameOf(addAsking.item)}
          onDone={(result, ticked) => {
            const { item, settled } = addAsking;
            setAddAsking(null);
            if (!result) return setNote(settledNote(item, settled));
            setNote("");
            setAdded({ ...result, ticked });
            void useShelf.getState().load();
          }}
        />
      )}
      {added && (
        <Toast key={`${added.id}:${added.ticked.join()}`} onGone={forgetAdded}>
          <span className="min-w-0">{addedText(added, added.ticked)}</span>
          <NavLink
            to={`/details/${added.id}`}
            className={toastAction}
            viewTransition
          >
            See it
          </NavLink>
        </Toast>
      )}

      {items && items.length > 0 && list && (
        <>
          {/* the page spaces its parts itself: the slip's own margin is dropped */}
          <section
            className={`${pricesStyles.costBox} mb-0!`}
            aria-label="What it costs"
          >
            <div className={pricesStyles.costText}>
              <h2 className={pricesStyles.costLabel}>
                {items.length === 1 ? "1 volume" : `${items.length} volumes`} to
                buy
              </h2>
              <Total label="New" sum={list.totals.new} of={items.length} />
              <Total label="Used" sum={list.totals.used} of={items.length} />
              {!list.totals.new.volumes && !list.totals.used.volumes && (
                <p className={pricesStyles.costNote}>
                  No prices found for these yet.
                </p>
              )}
            </div>
          </section>
          <div className={styles.controls}>
            <SortMenu
              sortBy={sort}
              onSort={setSort}
              options={TO_BUY_SORTS}
              wordy
              alignLeft
            />
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => setAsking(true)}
            >
              Clear list
            </button>
          </div>
          <div id="to-buy-list" className="-mt-8 scroll-mt-4" />
          <ul className={styles.list}>
            {pageItems.map((item) => (
              <li key={item.isbn13} className={styles.row}>
                <NavLink
                  to={volumePath(item.isbn13, item.title)}
                  className={styles.cover}
                  tabIndex={-1}
                  aria-hidden
                  viewTransition
                >
                  {/* the cover its price page shows, over the same stand-in */}
                  <CoverFallback
                    number={item.edition ? null : item.volume}
                    seriesCoverUrl={item.seriesCoverUrl}
                    seriesName={item.series}
                    numbered={item.volume != null && !item.edition}
                    small
                  />
                  <Cover url={item.coverUrl} sizes="60px" />
                  {(novelParts(item.title).lightNovel ||
                    novelParts(item.series).lightNovel) && <LightNovelBand />}
                  {/* its number on the corner, as a series page's covers
                      carry it (the small tile's stamp, from the shelf) */}
                  {item.volume != null && !item.edition && (
                    <span className={volumesStyles.vol} aria-hidden>
                      {item.volume}
                    </span>
                  )}
                </NavLink>
                <div className={styles.words}>
                  <NavLink
                    to={volumePath(item.isbn13, item.title)}
                    className={styles.name}
                    viewTransition
                  >
                    {nameOf(item)}
                  </NavLink>
                  {/* the shelf already has it, or has it on order */}
                  {item.shelf?.state && (
                    <span className={styles.shelfTag}>
                      {item.shelf.state === "owned"
                        ? "Already yours"
                        : "Ordered"}
                    </span>
                  )}
                  <p className={styles.prices}>
                    <Price label="New" price={item.new} />
                    <Price label="Used" price={item.used} />
                    {!item.new &&
                      !item.used &&
                      (item.outOn ? (
                        <span>
                          Preorder. Out <b>{releaseDay(item.outOn)}</b>
                        </span>
                      ) : (
                        <span>No price yet</span>
                      ))}
                  </p>
                </div>
                <div className={styles.actions}>
                  {/* out now: bought or ordered; a preorder can only be
                      ordered; a box set or guide, only bought */}
                  {!item.outOn && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy !== null}
                      onClick={() => void settle(item, "owned")}
                    >
                      {busy === item.isbn13 ? "Saving…" : "On my shelf"}
                    </button>
                  )}
                  {(item.outOn || item.volumes || item.edition) && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy !== null}
                      onClick={() => void settle(item, "ordered")}
                    >
                      Ordered
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.removeBtn}
                    disabled={busy !== null}
                    onClick={() => void takeOff(item)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <RangePager {...pager} label="To buy pages" />
        </>
      )}
      {asking && items && (
        <ClearListModal
          count={items.length}
          onClear={clearAll}
          onClose={() => setAsking(false)}
        />
      )}
    </PullPage>
  );
}
