// Entries on a shelf that are one series under different names: "Vagabond",
// "Vagabond VIZBIG Edition" and "Vagabond Definitive Edition" are all
// Vagabond. The server says which series each entry is of (`seriesKey`, from
// its one list of editions); this groups them for the shelf's merge offer.
// No imports from the app, so the server's tests run it too.

type Entry = {
  id: number;
  name: string;
  seriesKey?: string;
  plainName?: string | null;
};

export type SameSeries<T> = {
  // which group this is, for remembering "keep them apart": changes when an
  // entry joins or leaves it, so the offer comes back then
  key: string;
  // the series' own name, which the merged entry takes
  name: string;
  entries: T[];
};

// every group of two or more, in the shelf's order
export function sameSeriesGroups<T extends Entry>(shelf: T[]): SameSeries<T>[] {
  const byKey = new Map<string, T[]>();
  for (const entry of shelf) {
    if (!entry.seriesKey) continue;
    byKey.set(entry.seriesKey, [...(byKey.get(entry.seriesKey) ?? []), entry]);
  }
  const groups: SameSeries<T>[] = [];
  for (const [seriesKey, entries] of byKey) {
    if (entries.length < 2) continue;
    // an entry already under the plain name gives it; else an edition's name
    // with its words taken off
    const plain = entries.find((e) => !e.plainName);
    const ids = entries.map((e) => e.id).sort((a, b) => a - b);
    groups.push({
      key: `${seriesKey}|${ids.join(",")}`,
      name: plain?.name ?? entries[0]!.plainName ?? entries[0]!.name,
      entries,
    });
  }
  return groups;
}

// which of the ticked entries the others are merged into: the one already
// under the series' own name, so its cover and address stay; else the first
export const entryToKeep = <T extends Entry>(ticked: T[]) =>
  ticked.find((e) => !e.plainName) ?? ticked[0] ?? null;
