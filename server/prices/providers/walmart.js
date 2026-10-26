import { createSign } from "node:crypto";

// Walmart affiliate API (walmart.io): print copies on Walmart.com.
// Needs WALMART_CONSUMER_ID, WALMART_KEY_VERSION and WALMART_PRIVATE_KEY
// (the PEM you generated for walmart.io, with newlines written as \n).
// Requests are signed with that key. Untested against a live account yet.
// https://walmart.io/docs/affiliates/v1/introduction
const SEARCH_URL =
  "https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search";

function signedHeaders() {
  const consumerId = process.env.WALMART_CONSUMER_ID;
  const keyVersion = process.env.WALMART_KEY_VERSION;
  const timestamp = String(Date.now());
  const signer = createSign("RSA-SHA256");
  signer.update(`${consumerId}\n${timestamp}\n${keyVersion}\n`);
  const privateKey = process.env.WALMART_PRIVATE_KEY.replace(/\\n/g, "\n");
  return {
    "WM_CONSUMER.ID": consumerId,
    "WM_CONSUMER.INTIMESTAMP": timestamp,
    "WM_SEC.KEY_VERSION": keyVersion,
    "WM_SEC.AUTH_SIGNATURE": signer.sign(privateKey, "base64"),
  };
}

export default {
  id: "walmart",
  store: "Walmart",
  enabled: () =>
    Boolean(
      process.env.WALMART_CONSUMER_ID &&
      process.env.WALMART_KEY_VERSION &&
      process.env.WALMART_PRIVATE_KEY,
    ),

  async fetchOffers(isbn13, signal) {
    const params = new URLSearchParams({ query: isbn13, numItems: "10" });
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      headers: signedHeaders(),
      signal,
    });
    if (!res.ok) throw new Error(`Walmart search responded ${res.status}`);
    const { items = [] } = await res.json();

    // a text search can return near misses; only keep this exact ISBN
    const match = items.find(
      (i) => i.upc === isbn13 || i.isbn === isbn13 || i.upc === `0${isbn13}`,
    );
    if (!match?.salePrice) return [];
    return [
      {
        store: this.store,
        format: "print",
        condition: "new",
        priceCents: Math.round(match.salePrice * 100),
        currency: "USD",
        inStock: match.stock !== "Not available",
        url: match.productTrackingUrl ?? match.productUrl ?? null,
      },
    ];
  },
};
