// eBay's own API: searched by the ISBN as a keyword, and by title when that
// finds nothing; box sets holding the volume are kept and labelled
import {
  browseOffers,
  titleQueries,
  type ItemSummary,
} from "../../prices/providers/ebay.js";

const item = (over: Partial<ItemSummary>): ItemSummary => ({
  title: "Jujutsu Kaisen, Vol. 1",
  conditionId: "1000",
  price: { value: "9.99", currency: "USD" },
  shippingOptions: [{ shippingCost: { value: "4.00" } }],
  itemWebUrl: "https://www.ebay.com/itm/1",
  ...over,
});

const title = "Jujutsu Kaisen, Vol. 1";

test("price includes shipping, and the cheapest new and used are kept", () => {
  const offers = browseOffers(
    [
      item({}),
      item({ price: { value: "7.50", currency: "USD" } }),
      item({ conditionId: "3000", price: { value: "3.00", currency: "USD" } }),
    ],
    title,
    "US",
  );
  expect(offers.map((o) => [o.condition, o.priceCents])).toEqual(
    expect.arrayContaining([
      ["new", 1150],
      ["used", 700],
    ]),
  );
  expect(offers).toHaveLength(2);
});

test("other volumes, Japanese editions and unknown shipping are left out", () => {
  const offers = browseOffers(
    [
      item({ title: "Jujutsu Kaisen, Vol. 2" }),
      item({ title: "呪術廻戦 1 Japanese edition" }),
      item({ shippingOptions: [] }),
      item({ itemWebUrl: undefined }),
    ],
    title,
    "US",
  );
  expect(offers).toEqual([]);
});

test("eBay.ca listings are in Canadian dollars, and US-dollar ones are skipped", () => {
  const ca = browseOffers(
    [
      item({
        price: { value: "14.00", currency: "CAD" },
        itemWebUrl: "https://www.ebay.ca/itm/2",
      }),
      item({ price: { value: "9.00", currency: "USD" } }),
    ],
    title,
    "CA",
  );
  expect(ca).toHaveLength(1);
  expect(ca[0]).toMatchObject({
    store: "eBay.ca",
    currency: "CAD",
    priceCents: 1800,
  });
  // Canada's tracking is added where the link is shown, not here
  expect(ca[0]!.url).toBe("https://www.ebay.ca/itm/2");
});

// ---------- box sets ----------

const usd = (value: string) => ({ value, currency: "USD" });
const formats = (items: ItemSummary[], book: string, by: "isbn" | "title") =>
  browseOffers(items, book, "US", by).map((o) => `${o.format} ${o.priceCents}`);

test("a box set holding this volume is kept as a set, never as this volume", () => {
  expect(
    formats(
      [
        item({
          title:
            "That Time I Got Reincarnated as a Slime Manga Vol 1-6 Box Set",
          price: usd("46.60"),
          shippingOptions: [{ shippingCost: { value: "0" } }],
        }),
      ],
      "That Time I Got Reincarnated as a Slime, Vol. 4",
      "title",
    ),
  ).toEqual(["set 4660"]);
});

test("a set whose range doesn't hold this volume is left out", () => {
  expect(
    formats(
      [
        item({
          title:
            "Spy x Family Manga Vol. 1-3 Set/Lot by Tatsuya Endo VIZ English TPB",
          price: usd("17.00"),
        }),
      ],
      "Spy x Family, Vol. 5",
      "isbn",
    ),
  ).toEqual([]);
});

test("one volume sold from a listing naming the whole run is left out", () => {
  expect(
    formats(
      [
        // under $3 a volume
        item({
          title: "Chainsaw Man Box Set: Includes volumes 1-11Tatsuki Fujimoto",
          price: usd("7.20"),
          shippingOptions: [{ shippingCost: { value: "0" } }],
        }),
        item({
          title:
            "Blue Lock Manga Vol 1-26 English Ver - price for 1 volume only",
          price: usd("99.99"),
        }),
        item({
          title: "Blue Lock Manga Vol 1-8 English - Pick Your Volume!",
          price: usd("44.90"),
        }),
        // a lot naming no range isn't a set of this series
        item({
          title:
            "USED Books: Manga Lot Vol 1: My Hero Academia, Kaiju No. 8 & Jujutsu Kaisen TPB",
          price: usd("5.00"),
        }),
      ],
      "Chainsaw Man, Vol. 3",
      "isbn",
    ),
  ).toEqual([]);
});

// ---------- searching by title ----------

test("a title search keeps only listings that name the series, the volume and the format", () => {
  const manga = "Overlord, Vol. 16";
  const novel = "Overlord Light Novel, Vol. 16";
  const listings = [
    "Overlord, Vol. 16 (manga) by Kugane Maruyama (English) Paperback Book",
    "Overlord, Vol. 16 (light novel) Format: Hardback",
    "Kugane Maruyama Andrew Cunningham So-B Overlord, Vol. 16 (light nove (Hardback)",
    "Overlord, Vol. 16 : The Half-Elf Demigod Part II by Kugane Maruyama",
    "Primordial Overlord: A Cultivation Saga Across Multiverses, Volume 16 manga",
  ]
    .map((t) => item({ title: t }))
    .concat(
      item({
        title: "Completed Overlord Light Novels Vol 1-16 Hardcover In English",
        price: usd("196.76"),
      }),
    );
  expect(formats(listings, manga, "title")).toEqual(["print 1399"]);
  expect(
    browseOffers(listings, novel, "US", "title")
      .map((o) => o.format)
      .sort(),
  ).toEqual(["print", "set"]);
});

test("a title search leaves out the series' merchandise", () => {
  expect(
    formats(
      [
        "Sukuna * UE03BT/JJK-1-047 R * Union Arena * Jujutsu Kaisen Volume 1 Foil NM ENG",
        "JUJUTSU KAISEN Nitotan Figure Collection Vol 1 : Complete Set of 4 Figures",
        "Jujutsu Kaisen (3rd Season): Shimetsu Kaiyuu - Zenpen (Vol. 1-12 End)- *Eng Dub*",
        "One Piece CCG Tin Set Vol 2 EMPTY TIN ONLY Luffy",
      ].map((t) => item({ title: t, price: usd("60.00") })),
      "Jujutsu Kaisen, Vol. 1",
      "title",
    ),
  ).toEqual([]);
});

test("a title search asks for the volume, and for box sets", () => {
  expect(titleQueries("Overlord Light Novel, Vol. 16")).toEqual({
    volume: "Overlord light novel vol 16",
    sets: "Overlord light novel box set",
  });
  expect(titleQueries("Jujutsu Kaisen, Vol. 1")).toEqual({
    volume: "Jujutsu Kaisen vol 1",
    sets: "Jujutsu Kaisen box set",
  });
  // no number: no single-volume search
  expect(titleQueries("Case Closed").volume).toBeNull();
});
