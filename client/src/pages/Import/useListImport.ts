// A list import from MyAnimeList (a file), AniList or Kitsu (a username):
// the list that was found, which of its sub-lists are ticked, and adding the
// ticked ones to the shelf. The page draws; this holds the steps.
import { useState } from "react";
import type { AccountSource } from "../../lib/imports/accountImport";
import { readAniList, readKitsu } from "../../lib/imports/accountImport";
import {
  ImportFileError,
  MAL_LISTS,
  readMalExport,
  sendToShelf,
  type ImportTotals,
  type MalItem,
} from "../../lib/imports/malImport";
import { useShelf } from "../../store/shelf";

const SITE_NAME: Record<AccountSource, string> = {
  anilist: "AniList",
  kitsu: "Kitsu",
};

// the sub-lists left unticked to begin with (Dropped, say)
const untickedByDefault = () =>
  new Set(
    MAL_LISTS.filter((list) => !list.importByDefault).map(
      (list) => list.status,
    ),
  );

export function useListImport() {
  // where the list came from, said beside what was found: a file's name, or
  // "name on AniList"
  const [fileName, setFileName] = useState("");
  // the list, once read; null before, and while another is being read
  const [items, setItems] = useState<MalItem[] | null>(null);
  // why the file or the username didn't give a list
  const [fileError, setFileError] = useState("");
  // looking up a username's list
  const [finding, setFinding] = useState(false);
  // the sub-lists (by status) that won't be added
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  // how many have gone to the shelf; null when nothing is being added
  const [progress, setProgress] = useState<number | null>(null);
  const [totals, setTotals] = useState<ImportTotals | null>(null);
  // adding stopped partway
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);

  // a fresh start, before a new list is read
  const clear = () => {
    setFileError("");
    setItems(null);
    setFailed(false);
  };
  // a list that was read: shown with the usual sub-lists ticked, or `empty`
  // said when it holds nothing
  const show = (found: MalItem[], empty: string) => {
    if (!found.length) {
      setFileError(empty);
      return;
    }
    setItems(found);
    setUnticked(untickedByDefault());
  };

  // AniList or Kitsu: their public list, by username
  const findList = async (site: AccountSource, username: string) => {
    const name = username.trim();
    if (!name) return;
    clear();
    setFinding(true);
    try {
      const found = await (site === "anilist"
        ? readAniList(name)
        : readKitsu(name));
      setFileName(`${name} on ${SITE_NAME[site]}`);
      show(found, "That list has no manga on it yet.");
    } catch (err) {
      setFileError(
        err instanceof ImportFileError
          ? err.message
          : "That list couldn't be reached. Check your connection and try again.",
      );
    } finally {
      setFinding(false);
    }
  };

  // MyAnimeList: the export file they downloaded
  const openFile = async (file: File | undefined) => {
    if (!file) return;
    clear();
    setFileName(file.name);
    try {
      const found = await readMalExport(file);
      show(
        found,
        "That list is empty. Add some manga on MyAnimeList, then export it again.",
      );
    } catch (e) {
      setFileError(
        e instanceof ImportFileError
          ? e.message
          : "That file couldn't be read. Try downloading it again.",
      );
    }
  };

  const toggle = (status: string) => {
    const next = new Set(unticked);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setUnticked(next);
  };

  const countOf = (status: string) =>
    (items ?? []).filter((item) => item.status === status).length;
  const chosen = (items ?? []).filter((item) => !unticked.has(item.status));

  // the ticked ones go to the shelf, a piece at a time
  const start = async () => {
    setFailed(false);
    setProgress(0);
    try {
      const done = await sendToShelf(
        chosen.map((item) => item.entry),
        (sent, soFar) => {
          setProgress(sent);
          setTotals(soFar);
        },
      );
      setTotals(done);
      setFinished(true);
      // the shelf picks up what's new when they go back to it
      void useShelf.getState().load();
    } catch (e) {
      // what went in before it stopped is still said, and is on the shelf
      const soFar = (e as { totals?: ImportTotals }).totals;
      if (soFar) setTotals(soFar);
      setFailed(true);
      void useShelf.getState().load();
    } finally {
      setProgress(null);
    }
  };

  return {
    fileName,
    items,
    fileError,
    finding,
    unticked,
    progress,
    totals,
    failed,
    finished,
    chosen,
    countOf,
    // another place to import from: what was found for the last one goes
    reset: () => {
      clear();
      setFileName("");
    },
    findList,
    openFile,
    toggle,
    start,
  };
}
