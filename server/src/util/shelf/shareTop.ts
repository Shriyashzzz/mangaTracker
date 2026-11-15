// The series a shelf's owner has put at the top of their shared shelf: up
// to five, by name, in their order. They lead the page and the picture its
// link shows. Kept with their preferences (users.prefs.shareTop), by name
// because a shared shelf never sends ids; one that's renamed or deleted
// just drops off.

export const MOST_TOP = 5;
// as long as a series' name can be (the shelf's own limit)
const LONGEST_NAME = 150;

// what to save: the names as given, or null when it isn't a list of up to
// five different names. An empty list is fine: it clears their picks
export function validShareTop(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MOST_TOP) return null;
  const names = value.filter(
    (name): name is string =>
      typeof name === "string" &&
      name.trim().length > 0 &&
      name.length <= LONGEST_NAME,
  );
  const allDifferent = new Set(names).size === names.length;
  return names.length === value.length && allDifferent ? names : null;
}

// their picks that are still on the shelf, in their order
export function topOf(prefs: unknown, shelfNames: string[]): string[] {
  const saved = (prefs as { shareTop?: unknown } | null)?.shareTop;
  const picks = validShareTop(saved) ?? [];
  const onShelf = new Set(shelfNames);
  return picks.filter((name) => onShelf.has(name));
}
