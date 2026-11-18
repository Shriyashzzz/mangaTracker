// What the box beside a series' title offers, and which of them it opens on
// (SetsBox.tsx). No components and no imports from the app, so the server's
// tests run it too.
//
// A series can be bought whole as a box set, or in an edition's bigger books
// (Deluxe, Definitive, VIZBIG, Omnibus…). The box shows one at a time:
//   - box sets first, whenever one is priced
//   - else the series' headline edition
//   - or the one this reader picked last for this series

type Line = { key: string; label: string };
export type SetsPick = { value: string; label: string };

// the pick for box sets; an edition's is its line's key
export const BOX_SETS = "sets";

// what can be picked: box sets (when any is priced), then each edition that
// has a book to show
export function setsOptions(
  setsLabel: string | null,
  lines: Line[],
): SetsPick[] {
  return [
    ...(setsLabel ? [{ value: BOX_SETS, label: setsLabel }] : []),
    ...lines.map((line) => ({ value: line.key, label: line.label })),
  ];
}

// which one shows: theirs when it's still on offer, else box sets, else the
// headline edition, else the first there is. null with nothing to show
export function pickedOf(
  options: SetsPick[],
  remembered: string | null,
  headlineKey: string | null,
): string | null {
  const has = (value: string | null) =>
    value !== null && options.some((o) => o.value === value);
  if (has(remembered)) return remembered;
  if (has(BOX_SETS)) return BOX_SETS;
  if (has(headlineKey)) return headlineKey;
  return options[0]?.value ?? null;
}

// the lowest of the prices known, or null when none is
export function cheapestOf(cents: (number | null | undefined)[]) {
  const known = cents.filter((c): c is number => typeof c === "number");
  return known.length ? Math.min(...known) : null;
}

// ---------- remembered per series, on this device ----------

// the most series a device remembers a pick for: the oldest go first
export const MOST_REMEMBERED = 200;

// the saved picks as text, read into [series, pick] pairs, oldest first
export function readPicks(saved: string | null): [string, string][] {
  try {
    const pairs: unknown = JSON.parse(saved ?? "[]");
    if (!Array.isArray(pairs)) return [];
    return pairs.filter(
      (pair): pair is [string, string] =>
        Array.isArray(pair) &&
        typeof pair[0] === "string" &&
        typeof pair[1] === "string",
    );
  } catch {
    return [];
  }
}

// the picks with this series' set, as the newest
export function withPick(
  picks: [string, string][],
  series: string,
  pick: string,
): [string, string][] {
  return [...picks.filter(([name]) => name !== series), [series, pick]].slice(
    -MOST_REMEMBERED,
  ) as [string, string][];
}
