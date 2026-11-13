// A big New tab is sorted into piles (piles.ts); one pile can be opened as a
// page of its own. Which pile is open lives in the address (?pile=), so Back
// returns to the piles. This holds that, the order a pile's page is put in,
// and the pile to give the focus back to.
import { useState } from "react";
import { useSearchParams } from "react-router";
import { isPileView, type Pile, type PileSort, type PileView } from "./piles";

export function usePileView(showingNew: boolean) {
  const [searchParams, setSearchParams] = useSearchParams();
  // what the address says, a pile or not
  const pileParam = searchParams.get("pile");
  // the pile whose page is open ("all" for everything at once); null on the
  // piles themselves, and off the New tab
  const pileView = showingNew && isPileView(pileParam) ? pileParam : null;
  // a pile's own page, in the order they pick (kept between piles)
  const [pileSort, setPileSort] = useState<PileSort>("");
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

  return {
    pileParam,
    pileView,
    pileSort,
    setPileSort,
    pileLeft,
    openPile,
    closePile,
  };
}
