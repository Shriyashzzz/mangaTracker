// Which view of the shelf is open (All, Reading, Finished, To read, Volumes,
// New), kept in step with the address (/shelf?tab=to-read) so a view can be
// bookmarked, shared and linked to. A link wins over where they were last;
// with release checks off there's no New, and a link to New that arrives
// before the account's choice does waits on All until checks turn on.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { readLocal, useReleaseChecksOn } from "../../lib/prefs";
import {
  readSession,
  TAB_FROM_URL,
  URL_FROM_TAB,
  writeSession,
} from "./shelfViews";

export function useShelfTab() {
  // in the address, so it's a step of its own: the back gesture leaves the list
  // and returns to New, and coming back from a volume lands on it again
  const [searchParams, setSearchParams] = useSearchParams();
  const wantHidden = searchParams.get("view") === "hidden";
  const checksOn = useReleaseChecksOn();
  const [tab, setTab] = useState(() => {
    if (wantHidden && checksOn) return "new";
    // a link to a view (/shelf?tab=reading) wins over where they were last
    const linked = TAB_FROM_URL[searchParams.get("tab") ?? ""];
    const saved =
      linked ?? readSession("libraryStatus", readLocal("shelfTab") ?? "all");
    // no New tab with release checks off
    return saved === "new" && !checksOn ? "all" : saved;
  });
  // a link to New that arrived before the account's choice did: shown as All
  // for now, and New once checks turn on (unless they pick something else)
  const [newWaiting, setNewWaiting] = useState(false);
  // switched off while on the New tab, or the account's choice just arrived
  if (!checksOn && tab === "new") {
    setTab("all");
    if (searchParams.get("tab") === "new") setNewWaiting(true);
  }
  if (newWaiting && tab !== "all") setNewWaiting(false);
  if (newWaiting && checksOn) {
    setNewWaiting(false);
    setTab("new");
  }
  // a link to another view while already on the shelf switches to it
  const urlTab = searchParams.get("tab");
  const [seenUrlTab, setSeenUrlTab] = useState(urlTab);
  if (urlTab !== seenUrlTab) {
    setSeenUrlTab(urlTab);
    const linked = TAB_FROM_URL[urlTab ?? ""];
    if (linked && linked !== tab) setTab(linked);
  }
  // the view is in the address too, so it can be bookmarked or shared
  // (replaced, not pushed: switching views doesn't fill the back button)
  useEffect(() => {
    const word = URL_FROM_TAB[tab];
    if (!word || searchParams.get("tab") === word) return;
    // showing All only until checks turn on: the link to New stays in the
    // address meanwhile
    if (newWaiting) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", word);
    setSearchParams(next, { replace: true });
  }, [tab, searchParams, setSearchParams, newWaiting]);

  // picked by them: remembered for this visit
  const pickTab = (value: string) => {
    setTab(value);
    writeSession("libraryStatus", value);
  };

  return { tab, pickTab, wantHidden, checksOn };
}
