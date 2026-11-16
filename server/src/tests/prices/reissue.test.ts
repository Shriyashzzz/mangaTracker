// A series sold in English today as a reissue numbered its own way
// (prices/reissue.ts, a hand table): its list is that edition, and every
// series not in the table is left exactly as it was
import { editionSoldToday } from "../../prices/reissue.js";
import type { CatalogBook } from "../../prices/types.js";

const book = (volume: number, isbn13: string, year = 2003) =>
  ({
    isbn13,
    title: `Sailor Moon, Vol. ${volume}`,
    authors: null,
    publisher: null,
    year,
    volume,
    coverUrl: "",
  }) as CatalogBook & { volume: number };
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
// Kodansha's: 1 to 3 at 978-1-935429, 4 to 12 at 978-1-61262
const kodansha = range(1, 12).map((v) =>
  book(v, `${v <= 3 ? "978193542" : "978161262"}${String(v).padStart(4, "0")}`),
);
// Mixx's run to 18
const mixx = range(1, 18).map((v) =>
  book(v, `978189221${String(v).padStart(4, "0")}`, 1997),
);
// what the merge picked: a mix, to 18, 13 missing
const mixed = range(1, 18)
  .filter((v) => v !== 13)
  .map((v) => (v <= 12 && v % 2 === 0 ? kodansha[v - 1]! : mixx[v - 1]!));

test("Sailor Moon is Kodansha's 12, under either of its names", () => {
  for (const name of ["Sailor Moon", "Pretty Guardian Sailor Moon"]) {
    const out = editionSoldToday([name], mixed, [...mixx, ...kodansha]);
    expect(out.map((v) => v.volume)).toEqual(range(1, 12));
    expect(out.every((v) => /^97819354|^97816126/.test(v.isbn13))).toBe(true);
  }
  // AniList's name is enough when the page was asked another way
  expect(
    editionSoldToday(["sailor-moon-x", "Sailor Moon"], mixed, kodansha),
  ).toHaveLength(12);
});

test("a series not in the table is left exactly as it was", () => {
  expect(editionSoldToday(["Fairy Tail", null], mixed, mixx)).toBe(mixed);
});

test("a volume of the edition the catalogs didn't have: no change", () => {
  const without7 = kodansha.filter((v) => v.volume !== 7);
  expect(editionSoldToday(["Sailor Moon"], mixed, [...mixx, ...without7])).toBe(
    mixed,
  );
});
