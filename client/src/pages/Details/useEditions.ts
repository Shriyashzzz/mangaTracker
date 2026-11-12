// The series' omnibus and deluxe lines, and which one this reader collects:
// the one they picked, or else the one their recorded books point to.
import { useEffect, useState } from "react";
import { getJson } from "../../lib/api";
import { getBooks } from "../../lib/booksApi";
import {
  editionPlan,
  guessEdition,
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

  const lines = state.name === name ? state.lines : [];
  const guessed =
    chosen == null ? guessEdition(lines, state.books, owned) : null;
  const key = chosen ?? guessed;
  const line = lines.find((l) => l.key === key) ?? null;
  return {
    lines,
    line,
    // picked for them from their books, until they choose
    guessed: Boolean(line && guessed),
    plan: line ? editionPlan(line, owned) : null,
  };
}

export type Editions = ReturnType<typeof useEditions>;
