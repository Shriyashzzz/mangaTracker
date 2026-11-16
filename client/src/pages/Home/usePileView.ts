// A big New tab is sorted into piles (piles.ts); one pile can be opened as a
// page of its own. Which pile is open lives in the address (?pile=), so Back
// returns to the piles. This holds that, the order a pile's page is put in,
// and the pile to give the focus back to. The series whose list of volumes
// to get is open is in the address too (?list=), so coming Back from one
// of its price pages finds the list still open. So is the side of New that's
// showing (?side=chapters): a link to New opens on the fallback side
// (Volumes, or Chapters for a reader who owns no volumes), a pile's link
// means one pile only, and Back still returns to the side they were on.
import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  isPileView,
  PILE_SORTS,
  type Pile,
  type PileSort,
  type PileView,
} from "./piles";
import {
  readSession,
  RELEASE_KINDS,
  writeSession,
  type ReleaseKind,
} from "./shelfViews";

// the order a pile's page was last put in, for the rest of the visit
const SORT_KEY = "libraryPileSort";
const savedSort = (): PileSort => {
  const saved = readSession(SORT_KEY, "");
  return PILE_SORTS.some((o) => o.value === saved) ? (saved as PileSort) : "";
};

export function usePileView(
  showingNew: boolean,
  // the side New opens on when the address doesn't say: Volumes for a
  // collector, Chapters for a reader who owns no volumes (Home.tsx)
  fallbackSide: ReleaseKind = "volumes",
) {
  const [searchParams, setSearchParams] = useSearchParams();
  // what the address says, a pile or not
  const pileParam = searchParams.get("pile");
  // the pile whose page is open ("all" for everything at once); null on the
  // piles themselves, and off the New tab
  const pileView = showingNew && isPileView(pileParam) ? pileParam : null;
  // a pile's own page, in the order they pick: kept between piles, and
  // when they come back from a volume's prices
  const [pileSort, setSort] = useState<PileSort>(savedSort);
  const setPileSort = (sort: PileSort) => {
    setSort(sort);
    writeSession(SORT_KEY, sort);
  };
  // the fallback side unless the address says another
  const sideParam = searchParams.get("side") ?? "";
  const side: ReleaseKind =
    sideParam in RELEASE_KINDS ? (sideParam as ReleaseKind) : fallbackSide;
  // switching sides isn't a step in the history, and leaves any pile's
  // page: each side has piles of its own. The fallback side needs no
  // ?side=; any other is written, so Volumes stays Volumes for a reader
  // whose New opens on Chapters
  const setSide = (kind: ReleaseKind) => {
    const next = new URLSearchParams(searchParams);
    if (kind === fallbackSide) next.delete("side");
    else next.set("side", kind);
    next.delete("pile");
    next.delete("list");
    setSearchParams(next, { replace: true, preventScrollReset: true });
  };
  // the pile they came back from, whose See all takes the focus again
  const [pileLeft, setPileLeft] = useState<Pile | null>(null);

  // opens a pile's page, or (null) goes back to the piles. Opening is a step
  // of its own, so Back returns to the piles
  const openPile = (view: PileView | null) => {
    const leavingAPile = !view && pileView && pileView !== "all";
    setPileLeft(leavingAPile ? pileView : null);
    const next = new URLSearchParams(searchParams);
    if (view) next.set("pile", view);
    else next.delete("pile");
    // from the piles, up to the top of the pile's page (the router's own
    // reset); between piles (the chips) the page stays where it is
    setSearchParams(next, { preventScrollReset: Boolean(pileView && view) });
  };

  // back to the piles without a step in the history: for a pile that's been
  // hidden down to nothing
  const closePile = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("pile");
    setSearchParams(next, { replace: true });
  };

  // the series whose list of volumes to get is open, by its id
  const listParam = Number(searchParams.get("list"));
  const openList = showingNew && listParam > 0 ? listParam : null;
  // opening and closing it aren't steps in the history, and don't move
  // the page
  const setOpenList = (mangaId: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (mangaId) next.set("list", String(mangaId));
    else next.delete("list");
    setSearchParams(next, { replace: true, preventScrollReset: true });
  };

  return {
    side,
    setSide,
    openList,
    setOpenList,
    pileParam,
    pileView,
    pileSort,
    setPileSort,
    pileLeft,
    openPile,
    closePile,
  };
}
