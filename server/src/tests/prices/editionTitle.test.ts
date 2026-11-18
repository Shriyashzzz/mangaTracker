// A book's title as its own Open Library record says it
// (prices/sources/editionTitle.ts), on records read from Open Library on
// 2026-11-17, and what the rest of the app then makes of that title.
import {
  saysMoreThan,
  titleOfRecord,
  withEditionOf,
} from "../../prices/sources/editionTitle.js";
import { editionVolumes } from "../../util/shelf/editions.js";
import { editionVolumes as pageEditionVolumes } from "../../../../client/src/lib/imports/bookVolumes.js";
import {
  editionOfTitle,
  omnibusVolumes,
  seriesName,
  seriesOfBook,
} from "../../prices/stores/match.js";
import {
  volumesByName,
  withoutEdition,
} from "../../util/shelf/editionNames.js";
import { titleVolume } from "../../prices/volumeNames.js";

// [the record, the title made of it, its series, its edition]
const RECORDS: [
  { title: string; subtitle?: string; edition_name?: string },
  string,
  string,
  string | null,
][] = [
  [
    { title: "Monster", subtitle: "The Perfect Edition, Vol. 1" },
    "Monster: The Perfect Edition, Vol. 1",
    "Monster",
    "perfect",
  ],
  [
    {
      title: "20th Century Boys",
      subtitle: "The Perfect Edition, Vol. 1",
      edition_name: "VIZ Signature edition",
    },
    "20th Century Boys: The Perfect Edition, Vol. 1",
    "20th Century Boys",
    "perfect",
  ],
  [
    { title: "Death Note", subtitle: "Black Edition, Vol. 1" },
    "Death Note: Black Edition, Vol. 1",
    "Death Note",
    "black",
  ],
  [
    { title: "Inuyasha", subtitle: "VizBig Edition, Volume 1" },
    "Inuyasha: VizBig Edition, Volume 1",
    "Inuyasha",
    "vizbig",
  ],
  [
    {
      title: "One Piece, Vol. 1",
      subtitle: "East Blue",
      edition_name: "Omnibus Edition",
    },
    "One Piece (Omnibus Edition), Vol. 1",
    "One Piece",
    "omnibus",
  ],
  [
    { title: "Dragon Ball Z, Vol. 1", edition_name: "VIZBIG Edition" },
    "Dragon Ball Z (Vizbig Edition), Vol. 1",
    "Dragon Ball Z",
    "vizbig",
  ],
  [
    {
      title: "Pretty Guardian Sailor Moon, Vol. 1",
      edition_name: "Eternal edition. New definitive edition.",
    },
    "Pretty Guardian Sailor Moon (Eternal Edition), Vol. 1",
    "Pretty Guardian Sailor Moon",
    "eternal",
  ],
  [
    {
      title: "Fullmetal Alchemist: 3-in-1 Edition, Vol. 1",
      edition_name: "English edition",
    },
    "Fullmetal Alchemist: 3-in-1 Edition, Vol. 1",
    "Fullmetal Alchemist",
    "3in1",
  ],
  [
    {
      title: "Fruits Basket Collector's Edition, Vol. 1",
      edition_name: "Collector's edition, First Yen Press edition.",
    },
    "Fruits Basket Collector's Edition, Vol. 1",
    "Fruits Basket",
    "collectors",
  ],
  [
    { title: "Naruto 3In1, Volume 1" },
    "Naruto 3In1, Volume 1",
    "Naruto",
    "3in1",
  ],
  [
    { title: "Battle Angel Alita", subtitle: "Deluxe edition" },
    "Battle Angel Alita: Deluxe edition",
    "Battle Angel Alita",
    "deluxe",
  ],
  [
    { title: "Cardcaptor Sakura Collector's Edition 1" },
    "Cardcaptor Sakura Collector's Edition 1",
    "Cardcaptor Sakura",
    "collectors",
  ],
  // a plain volume: left exactly as it is
  [
    { title: "Chainsaw Man, Vol. 3", edition_name: "First edition" },
    "Chainsaw Man, Vol. 3",
    "Chainsaw Man",
    null,
  ],
];

test("a record's title, subtitle and note make the book's full title", () => {
  for (const [record, title] of RECORDS)
    expect(titleOfRecord(record)).toBe(title);
  expect(titleOfRecord({})).toBe(null);
});

test("the app reads the series and the edition out of each", () => {
  for (const [, title, series, edition] of RECORDS) {
    expect([title, seriesOfBook(title)]).toEqual([title, series]);
    expect([title, editionOfTitle(title)?.key ?? null]).toEqual([
      title,
      edition,
    ]);
  }
});

test("the record's title replaces a search's only when it says more", () => {
  // the search gave the work's bare name
  expect(saysMoreThan("Monster: The Perfect Edition, Vol. 1", "Monster")).toBe(
    true,
  );
  // the search's title named no edition
  expect(
    saysMoreThan(
      "Dragon Ball Z (Vizbig Edition), Vol. 1",
      "Dragon Ball Z, Vol. 1",
    ),
  ).toBe(true);
  // a plain volume the search already named: untouched
  expect(saysMoreThan("Chainsaw Man, Vol. 3", "Chainsaw Man, Vol. 3")).toBe(
    false,
  );
  expect(saysMoreThan("Chainsaw Man", "Chainsaw Man, Vol. 3")).toBe(false);
  // nothing from the search at all
  expect(
    saysMoreThan("Fullmetal Alchemist: 3-in-1 Edition, Vol. 1", null),
  ).toBe(true);
});

test("a book says what it holds when its edition's name is the count", () => {
  const holds = (title: string) => {
    const edition = editionOfTitle(title);
    return edition ? volumesByName(edition, titleVolume(title)) : null;
  };
  expect(holds("Inuyasha: VizBig Edition, Volume 2")).toEqual([4, 5, 6]);
  expect(holds("Fullmetal Alchemist: 3-in-1 Edition, Vol. 1")).toEqual([
    1, 2, 3,
  ]);
  expect(holds("Death Note: Black Edition, Vol. 3")).toEqual([5, 6]);
  // a Deluxe's books vary: the name can't say, so nothing is claimed
  expect(holds("Berserk Deluxe Volume 2")).toBe(null);
  expect(holds("Monster: The Perfect Edition, Vol. 1")).toBe(null);
});

test("titles as Open Library's search writes them: a run in place of a number", () => {
  expect(seriesOfBook("Naruto #1-3")).toBe("Naruto");
  expect(omnibusVolumes("Naruto #1-3")).toEqual([1, 2, 3]);
  expect(editionOfTitle("Naruto #1-3")?.key).toBe("3in1");
  expect(seriesOfBook("Death Note #1-2")).toBe("Death Note");
  expect(editionOfTitle("Death Note #1-2")?.key).toBe("2in1");
  // an omnibus named only by what's inside it
  expect(
    editionOfTitle(
      "One Piece, Vol. 1 (Romance Dawn / Buggy the Clown / Don't Get Fooled Again)",
    )?.key,
  ).toBe("3in1");
  // a box set far too long to be a 3-in-1
  expect(editionOfTitle("Naruto Box Set #1-27")).toBe(null);
});

test("a box set is its series' too", () => {
  expect(withoutEdition("Claymore Complete Box Set")).toBe("Claymore");
  expect(withoutEdition("Akira 35th Anniversary Box Set")).toBe("Akira");
  expect(withoutEdition("Naruto Box Set 2")).toBe("Naruto");
  expect(withoutEdition("Tokyo Ghoul Complete Box Set")).toBe("Tokyo Ghoul");
  // "box" in a name isn't a box set
  expect(withoutEdition("Black Box")).toBe("Black Box");
});

test("a search's title keeps what it says and gains its record's edition", () => {
  const search =
    "One Piece, Vol. 1 (Romance Dawn / Buggy the Clown / Don't Get Fooled Again)";
  const title = withEditionOf(search, "One Piece (Omnibus Edition), Vol. 1");
  expect(title).toBe(
    "One Piece (Omnibus Edition), Vol. 1 (Romance Dawn / Buggy the Clown / Don't Get Fooled Again)",
  );
  // still its series, now an omnibus, and still saying what's inside
  expect(seriesOfBook(title)).toBe("One Piece");
  expect(editionOfTitle(title)?.key).toBe("omnibus");
  expect(omnibusVolumes(title)).toEqual([1, 2, 3]);
  // a title that names its edition already, or a record naming none
  expect(withEditionOf("Berserk Deluxe Volume 1", "Berserk Deluxe")).toBe(
    "Berserk Deluxe Volume 1",
  );
  expect(withEditionOf("Naruto, Vol. 3", "Naruto, Vol. 3")).toBe(
    "Naruto, Vol. 3",
  );
});

test("odd titles still give the series' own name", () => {
  for (const [title, series] of [
    ["Bleach #1: (3-In-1 Edition) Vol. 1-3", "Bleach"],
    [
      "Tokyo Ghoul Complete Box Set: Includes vols. 1-14 with premium",
      "Tokyo Ghoul",
    ],
    ["Battle Angel Alita Deluxe Complete Series Box Set", "Battle Angel Alita"],
    ["Rurouni Kenshin , Vol. 1", "Rurouni Kenshin"],
    ["Dragon Ball Z (Vizbig Edition), Vol. 1", "Dragon Ball Z"],
    // names that must stay whole
    [
      "Re:ZERO -Starting Life in Another World-, Vol. 1",
      "Re:ZERO -Starting Life in Another World-",
    ],
    ["86--EIGHTY-SIX, Vol. 1", "86--EIGHTY-SIX"],
  ])
    expect([title, seriesOfBook(title!)]).toEqual([title, series]);
  expect(seriesName("Jujutsu Kaisen, Vol. 24 (Shonen Jump)")).toBe(
    "Jujutsu Kaisen",
  );
});

test("uneven editions hold the same volumes on the server and the page", () => {
  const editions: [
    series: string,
    title: (n: number) => string,
    books: number,
  ][] = [
    ["Berserk", (n) => `Berserk Deluxe Volume ${n}`, 14],
    ["Vinland Saga", (n) => `Vinland Saga Deluxe ${n}`, 10],
    ["Monster", (n) => `Monster: The Perfect Edition, Vol. ${n}`, 9],
    [
      "Fruits Basket",
      (n) => `Fruits Basket Collector's Edition, Vol. ${n}`,
      12,
    ],
    ["Vagabond", (n) => `Vagabond Definitive Edition, Vol. ${n}`, 13],
    [
      "20th Century Boys",
      (n) => `20th Century Boys: The Perfect Edition, Vol. ${n}`,
      11,
    ],
    [
      "Fullmetal Alchemist",
      (n) => `Fullmetal Alchemist: Fullmetal Edition, Vol. ${n}`,
      18,
    ],
    ["BLAME!", (n) => `BLAME! Master Edition ${n}`, 6],
    ["Knights of Sidonia", (n) => `Knights of Sidonia Master Edition ${n}`, 8],
    ["Hellsing", (n) => `Hellsing Deluxe Volume ${n}`, 3],
    ["Battle Angel Alita", (n) => `Battle Angel Alita Deluxe Edition ${n}`, 6],
    ["Gantz", (n) => `Gantz Omnibus Volume ${n}`, 12],
    ["Death Note", (n) => `Death Note: Black Edition, Vol. ${n}`, 6],
    ["Sailor Moon", (n) => `Sailor Moon Eternal Edition ${n}`, 10],
  ];
  for (const [series, title, books] of editions)
    for (let n = 1; n <= books; n++) {
      const server = editionVolumes(series, title(n), n);
      const page = pageEditionVolumes(series, title(n), n);
      expect([title(n), server]).toEqual([
        title(n),
        page && "holds" in page ? page.holds : null,
      ]);
      expect(server?.length).toBeGreaterThan(0);
    }
  // every volume of an edition is in exactly one of its books
  const hellsing = [1, 2, 3].flatMap((n) =>
    editionVolumes("Hellsing", `Hellsing Deluxe Volume ${n}`, n)!,
  );
  expect(hellsing).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("a box set is never a book of an edition", () => {
  expect(
    editionOfTitle("Battle Angel Alita Deluxe Complete Series Box Set"),
  ).toBe(null);
  expect(editionOfTitle("Naruto 3-in-1 Box Set")).toBe(null);
  expect(
    seriesOfBook("Battle Angel Alita Deluxe Complete Series Box Set"),
  ).toBe("Battle Angel Alita");
});
