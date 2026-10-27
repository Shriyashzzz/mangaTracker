// Google Books: US ebook prices from Google Play Books.
// Needs a free key (GOOGLE_BOOKS_API_KEY): the keyless quota is shared
// worldwide and is usually used up. https://developers.google.com/books
//
// Ebooks have their own ISBN, so looking up the print ISBN finds nothing.
// Instead we search the volume's title and keep the ebook whose series name
// and volume number match.
import config from "../../config/config.js";
import { sameVolume } from "../match.js";
import type { Provider } from "../types.js";

const URL = "https://www.googleapis.com/books/v1/volumes";

type Item = {
  volumeInfo?: { title?: string };
  saleInfo?: {
    saleability?: string;
    retailPrice?: { amount: number; currencyCode: string };
    buyLink?: string;
  };
};

const googleBooks: Provider = {
  id: "google-books",
  store: "Google Play Books",
  enabled: () => Boolean(config.GOOGLE_BOOKS_API_KEY),

  async fetchOffers(_isbn13, signal, book) {
    if (!book.title) return [];
    const params = new URLSearchParams({
      q: book.title,
      country: "US",
      filter: "ebooks",
      maxResults: "20",
      key: config.GOOGLE_BOOKS_API_KEY!,
    });
    const res = await fetch(`${URL}?${params}`, { signal });
    if (!res.ok) throw new Error(`Google Books responded ${res.status}`);
    const { items = [] } = (await res.json()) as { items?: Item[] };

    const match = items.find((item) => {
      const s = item.saleInfo;
      return (
        s?.saleability === "FOR_SALE" &&
        s.retailPrice?.currencyCode === "USD" &&
        sameVolume(item.volumeInfo?.title ?? "", book.title)
      );
    });
    const price = match?.saleInfo?.retailPrice;
    if (!match || !price) return [];

    return [
      {
        store: this.store,
        format: "ebook",
        condition: "new",
        priceCents: Math.round(price.amount * 100),
        currency: "USD",
        inStock: true,
        url: match.saleInfo?.buyLink ?? null,
      },
    ];
  },
};

export default googleBooks;
