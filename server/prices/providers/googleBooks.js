// Google Books: US ebook prices from Google Play Books.
// Needs a free key (GOOGLE_BOOKS_API_KEY): the keyless quota is shared
// worldwide and is usually used up. https://developers.google.com/books
//
// Ebooks have their own ISBN, so looking up the print ISBN finds nothing.
// Instead we search the volume's title and keep the ebook whose series name
// and volume number match.
const URL = "https://www.googleapis.com/books/v1/volumes";

const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const volumeOf = (title) =>
  Number(
    title.match(/\bvol(?:ume)?\.?\s*(\d+)/i)?.[1] ??
      title.match(/(\d+)\s*$/)?.[1] ??
      NaN,
  );

const seriesOf = (title) =>
  normalize(
    title
      .replace(/\(.*?\)/g, "")
      .replace(/,?\s*\bvol(?:ume)?\.?\s*\d+.*$/i, "")
      .replace(/\s\d+\s*$/, ""),
  );

const sameVolume = (a, b) =>
  seriesOf(a) === seriesOf(b) &&
  (volumeOf(a) === volumeOf(b) || (isNaN(volumeOf(a)) && isNaN(volumeOf(b))));

export default {
  id: "google-books",
  store: "Google Play Books",
  enabled: () => Boolean(process.env.GOOGLE_BOOKS_API_KEY),

  async fetchOffers(isbn13, signal, book) {
    if (!book?.title) return [];
    const params = new URLSearchParams({
      q: book.title,
      country: "US",
      filter: "ebooks",
      maxResults: "20",
      key: process.env.GOOGLE_BOOKS_API_KEY,
    });
    const res = await fetch(`${URL}?${params}`, { signal });
    if (!res.ok) throw new Error(`Google Books responded ${res.status}`);
    const { items = [] } = await res.json();

    const match = items.find((item) => {
      const s = item.saleInfo;
      return (
        s?.saleability === "FOR_SALE" &&
        s.retailPrice?.currencyCode === "USD" &&
        sameVolume(item.volumeInfo?.title ?? "", book.title)
      );
    });
    if (!match) return [];

    const s = match.saleInfo;
    return [
      {
        store: this.store,
        format: "ebook",
        condition: "new",
        priceCents: Math.round(s.retailPrice.amount * 100),
        currency: "USD",
        inStock: true,
        url: s.buyLink ?? null,
      },
    ];
  },
};
