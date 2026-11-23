// The series' omnibus and deluxe lines, and which one this reader collects:
// the one they picked, or else the one their recorded books point to.
import { useEffect, useState } from "react";
import { getJson } from "../../lib/api";
import { getBooks } from "../../lib/booksApi";
import {
  editionPlan,
  guessEdition,
  mostlyInEditionBooks,
  onlyLineInEnglish,
  type EditionLine,
} from "../../lib/editions";
import type { OwnedBook } from "../../lib/books";

export function useEditions(
  // null: nothing to ask about (a light novel, or the page isn't loaded)
  name: string | null,
  mangaId: number | null,
  // what they picked: a line's key, "singles", or null for not chosen
  chosen: string | null | undefined,
  owned: number[],
  // the ISBN of each volume the catalog lists: shared ones mean there are
  // no singles in English (onlyLineInEnglish)
  listedIsbns: (string | null)[] = [],
  // with none owned: the volume their next chapter is in (editionPlan)
  readingFrom: number | null = null,
  // goes up when their recorded books may have changed: read again
  booksChanged = 0,
) {
  const [state, setState] = useState<{
    name: string | null;
    lines: EditionLine[];
    books: OwnedBook[];
  }>({ name: null, lines: [], books: [] });

  useEffect(() => {
    if (!name || !mangaId) return;
    const controller = new AbortController();
    Promise.all([
      getJson<{ lines: EditionLine[] }>(
        `/api/prices/editions?${new URLSearchParams({ name })}`,
        controller.signal,
      ).catch(() => ({ lines: [] })),
      getBooks(mangaId, controller.signal).catch(() => []),
    ]).then(([{ lines }, books]) => {
      if (!controller.signal.aborted)
        setState({ name, lines: lines ?? [], books });
    });
    return () => controller.abort();
  }, [name, mangaId]);
  // their recorded books alone, after a change to them (a spine ticked, a
  // book added or removed): the lines don't need asking for again
  useEffect(() => {
    if (!name || !mangaId || !booksChanged) return;
    const controller = new AbortController();
    getBooks(mangaId, controller.signal)
      .then((books) =>
        setState((now) => (now.name === name ? { ...now, books } : now)),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [name, mangaId, booksChanged]);

  const lines = state.name === name ? state.lines : [];
  const guessed =
    chosen == null
      ? (guessEdition(lines, state.books, owned) ??
        onlyLineInEnglish(lines, listedIsbns))
      : null;
  const key = chosen ?? guessed;
  const line = lines.find((l) => l.key === key) ?? null;
  return {
    lines,
    line,
    // the books they've recorded, for the names over the shelf's spines
    books: state.name === name ? state.books : [],
    // they collect an edition, known even before its line is (offline, it
    // may be missing): picked, or their recorded edition books hold at least
    // half of what they own, as guessEdition decides it
    collects:
      chosen != null
        ? chosen !== "singles"
        : mostlyInEditionBooks(state.books, owned),
    // picked for them from their books, until they choose
    guessed: Boolean(line && guessed),
    plan: line ? editionPlan(line, owned, readingFrom) : null,
  };
}

export type Editions = ReturnType<typeof useEditions>;
