// Trusted books (prices/trustedBooks.ts applyTrusted): a collector's printed
// book fills a volume the catalogs had none for, or takes the place of an
// ISBN no store ever priced, and nothing else. A wrong swap would put a book
// nobody sells on a series page; a missed one leaves a volume with no price
import {
  applyTrusted,
  lastInEnglish,
  type TrustedRow,
} from "../../prices/trustedBooks.js";
import { readTitle } from "../../prices/trustedTitles.js";
import type { CatalogBook } from "../../prices/types.js";

const listed = (
  volume: number,
  isbn13: string,
  extra: Partial<Omit<CatalogBook, "volume">> = {},
) => ({
  isbn13,
  title: `Tropical Fish, Vol. ${volume}`,
  authors: null,
  publisher: "VIZ Media",
  year: 2020,
  coverUrl: `/api/prices/cover/${isbn13}`,
  ...extra,
  volume,
});

const row = (
  volume: number,
  isbn13: string,
  extra: Partial<TrustedRow> = {},
): TrustedRow => ({
  isbn13,
  source: "collector-viz",
  trust: 3,
  series: "Tropical Fish",
  seriesKey: "tropical fish",
  kind: "single",
  volume,
  holds: [],
  title: `Tropical Fish, Vol. ${volume}`,
  publisher: "Viz Media",
  published: "2019-11-12",
  pages: 192,
  ...extra,
});

const isbns = (volumes: { isbn13: string }[]) => volumes.map((v) => v.isbn13);

describe("applyTrusted", () => {
  test("an ISBN no store ever priced gives way to the printed book", () => {
    const { volumes, swaps } = applyTrusted(
      "Tropical Fish",
      [listed(1, "9781974714452"), listed(2, "9781974718337")],
      [row(1, "9781974710430")],
      new Set(),
    );
    expect(isbns(volumes)).toEqual(["9781974710430", "9781974718337"]);
    expect(swaps).toEqual([
      {
        from: "9781974714452",
        to: "9781974710430",
        volume: 1,
        source: "collector-viz",
      },
    ]);
    // the printed book's own details and cover come with it
    expect(volumes[0]).toMatchObject({
      published: "2019-11-12",
      pages: 192,
      coverUrl: "/api/prices/cover/9781974710430",
      title: "Tropical Fish, Vol. 1",
    });
  });

  test("a priced ISBN is a real book someone sells, and stays", () => {
    const { volumes, swaps } = applyTrusted(
      "Tropical Fish",
      [listed(1, "9781974714452")],
      [row(1, "9781974710430")],
      new Set(["9781974714452"]),
    );
    expect(isbns(volumes)).toEqual(["9781974714452"]);
    expect(swaps).toEqual([]);
  });

  test("a volume the catalogs had no book for is filled, named as the list names them", () => {
    const { volumes, swaps } = applyTrusted(
      "Tropical Fish",
      [listed(1, "9781974710430")],
      [row(1, "9781974710430"), row(2, "9781974710591")],
      new Set(),
    );
    expect(isbns(volumes)).toEqual(["9781974710430", "9781974710591"]);
    expect(volumes[1]).toMatchObject({
      volume: 2,
      title: "Tropical Fish, Vol. 2",
    });
    expect(swaps).toEqual([]);
  });

  test("the listed book being a trusted one keeps it, with the date it lacked", () => {
    const { volumes } = applyTrusted(
      "Tropical Fish",
      [listed(1, "9781974710430")],
      [row(1, "9781974710430")],
      new Set(),
    );
    expect(volumes[0]).toMatchObject({
      isbn13: "9781974710430",
      published: "2019-11-12",
    });
  });

  test("another publisher's run is left alone", () => {
    // Kodansha's Cardcaptor Sakura on the page, Tokyopop's in the list
    const { volumes, swaps, used } = applyTrusted(
      "Cardcaptor Sakura",
      [listed(1, "9781632364784"), listed(2, "9781632364791")],
      [row(1, "9781892213259"), row(3, "9781892213273")],
      new Set(),
    );
    expect(isbns(volumes)).toEqual(["9781632364784", "9781632364791"]);
    expect(swaps).toEqual([]);
    // so nothing they say of the series ("Complete in English") counts
    expect(used).toBe(false);
  });

  test("a series sold as books holding several volumes takes no lone ones", () => {
    const book = listed(1, "9781612624204", {
      inBook: { book: 1, from: 1, to: 2 },
    });
    const { volumes } = applyTrusted(
      "Vinland Saga",
      [book],
      [row(3, "9781612624211")],
      new Set(),
    );
    expect(volumes).toEqual([book]);
  });

  test("a manga page takes no novels, and a novel page no manga", () => {
    const novel = row(2, "9781427802125", { kind: "novel" });
    expect(
      isbns(applyTrusted("Chibi Vampire", [], [novel], new Set()).volumes),
    ).toEqual([]);
    expect(
      isbns(
        applyTrusted("Chibi Vampire Light Novel", [], [novel], new Set())
          .volumes,
      ),
    ).toEqual(["9781427802125"]);
    expect(
      applyTrusted(
        "Chibi Vampire Light Novel",
        [],
        [row(2, "9781427800640")],
        new Set(),
      ).volumes,
    ).toEqual([]);
  });

  test("edition books and one-shots never become a volume", () => {
    const { volumes } = applyTrusted(
      "Ranma 1/2",
      [],
      [
        row(19, "9781421566290", { kind: "edition", holds: [37, 38] }),
        row(0, "9781421500000", { kind: "oneshot", volume: null }),
      ],
      new Set(),
    );
    expect(volumes).toEqual([]);
  });

  test("nothing past a finished series' last volume", () => {
    const { volumes } = applyTrusted(
      "Tropical Fish",
      [listed(1, "9781974710430")],
      [
        row(1, "9781974710430"),
        row(9, "9781974733507"),
        row(10, "9781974799990"),
      ],
      new Set(),
      9,
    );
    expect(isbns(volumes)).toEqual(["9781974710430", "9781974733507"]);
  });

  test("of two trusted printings, the series' publisher's first, then the most trusted", () => {
    // 07-Ghost 2: Go! Comi's printing and VIZ's; the list is VIZ's
    const { volumes } = applyTrusted(
      "07-Ghost",
      [
        listed(1, "9781421549941"),
        listed(2, "9781605100333"),
        listed(3, "9781421549965"),
      ],
      [row(2, "9781605100333"), row(2, "9781421549958", { trust: 2 })],
      new Set(),
    );
    // the listed one is itself trusted: kept
    expect(volumes[1]!.isbn13).toBe("9781605100333");
    const fresh = applyTrusted(
      "07-Ghost",
      [listed(1, "9781421549941"), listed(3, "9781421549965")],
      [
        row(2, "9781605100333", { trust: 3 }),
        row(2, "9781421549958", { trust: 2 }),
      ],
      new Set(),
    );
    expect(fresh.volumes.map((v) => v.isbn13)).toContain("9781421549958");
  });

  test("a replacement keeps to a publisher's block the list already has", () => {
    // a Chinese ISBN mistyped onto a collector's list: never put in
    const { volumes, swaps } = applyTrusted(
      "Vagabond",
      [listed(3, "9781421519135"), listed(4, "9781421519142")],
      [row(3, "9781421519135"), row(4, "9787156931853")],
      new Set(),
    );
    expect(isbns(volumes)).toEqual(["9781421519135", "9781421519142"]);
    expect(swaps).toEqual([]);
  });

  test("an ISBN already in the list under another number isn't used twice", () => {
    const { volumes } = applyTrusted(
      "Tropical Fish",
      [listed(1, "9781974710430"), listed(2, "9781974718337")],
      [row(2, "9781974710430")],
      new Set(),
    );
    expect(isbns(volumes)).toEqual(["9781974710430", "9781974718337"]);
  });
});

describe("readTitle", () => {
  test("Libib's sorting name is undone", () => {
    expect(readTitle("Way of the Househusband, The - Vol. 01")).toMatchObject({
      kind: "single",
      series: "The Way of the Househusband",
      volume: 1,
      title: "The Way of the Househusband, Vol. 1",
    });
  });

  test("its sorting name with A or An is undone too", () => {
    expect(readTitle("Devil and Her Love Song, A - Vol. 03")).toMatchObject({
      series: "A Devil and Her Love Song",
      volume: 3,
    });
    expect(readTitle("Incurable Case of Love, An - Vol. 2")).toMatchObject({
      series: "An Incurable Case of Love",
    });
  });

  test("a number given only as (v. N) is the volume", () => {
    expect(readTitle("Tokyo Tribes 5(Tokyo Tribes) (v. 5)")).toMatchObject({
      kind: "single",
      series: "Tokyo Tribes",
      volume: 5,
    });
    expect(readTitle("Welcome to the N.H.K., Volume 5 (v. 5)")).toMatchObject({
      volume: 5,
    });
  });

  test("a novel is a novel, under its series' own name", () => {
    expect(readTitle("Chibi Vampire: The Novel, Vol. 01")).toMatchObject({
      kind: "novel",
      series: "Chibi Vampire",
      volume: 1,
      title: "Chibi Vampire Light Novel, Vol. 1",
    });
  });

  test("an edition book is set aside, with what it holds when it says", () => {
    expect(
      readTitle("Ranma 1/2, Vol. 37 & 38 (2-in-1 Vol. 19) [Final]"),
    ).toMatchObject({
      kind: "edition",
      series: "Ranma 1/2",
      holds: [37, 38],
      edition: { key: "2in1", number: 19 },
    });
    expect(
      readTitle("Kuroko's Basketball, Vol. 14, (2-in-1 of Volumes 27 & 28)"),
    ).toMatchObject({ holds: [27, 28], edition: { key: "2in1", number: 14 } });
    // says nothing of what it holds: nothing guessed
    expect(readTitle("Maid-sama! (2-in-1 Edition), Vol. 03")).toMatchObject({
      kind: "edition",
      holds: [],
    });
    // an edition the site has no name for is still an edition
    expect(readTitle("Cardcaptor Sakura Pocket Edition, Vol. 02").kind).toBe(
      "edition",
    );
  });

  test("a last volume is marked", () => {
    expect(readTitle("07-Ghost, Vol. 17 (Complete)").ends).toBe(true);
    expect(readTitle("Strobe Edge, Vol. 10 (Final)").ends).toBe(true);
    expect(
      readTitle("Ranma 1/2, Vol. 37 & 38 (2-in-1 Vol. 19) [Final]").ends,
    ).toBe(true);
    expect(readTitle("07-Ghost, Vol. 16").ends).toBe(false);
    // "Complete" in a box set's name isn't a last volume
    expect(readTitle("Naruto Complete Box Set, Vol. 1").ends).toBe(false);
  });

  test("a last volume's note and repeated numbers don't change the volume", () => {
    expect(readTitle("07-Ghost, Vol. 17 (Complete)")).toMatchObject({
      series: "07-Ghost",
      volume: 17,
    });
    expect(
      readTitle("Kaguya-Sama: Love Is War, Vol. 16, Volume 16"),
    ).toMatchObject({
      volume: 16,
    });
  });
});

describe("lastInEnglish", () => {
  test("the volume a source marks as the last, of the page's kind", () => {
    const rows = [
      row(16, "9781421577784"),
      row(17, "9781421577944", { ends: true }),
    ];
    expect(lastInEnglish("07-Ghost", rows)).toBe(17);
    // a manga's last volume isn't its light novel's
    expect(lastInEnglish("07-Ghost Light Novel", rows)).toBeNull();
    expect(lastInEnglish("07-Ghost", [row(16, "9781421577784")])).toBeNull();
  });

  test("two sources naming different last volumes say nothing", () => {
    expect(
      lastInEnglish("07-Ghost", [
        row(17, "9781421577944", { ends: true }),
        row(18, "9781421599990", { ends: true, source: "readers" }),
      ]),
    ).toBeNull();
  });
});
