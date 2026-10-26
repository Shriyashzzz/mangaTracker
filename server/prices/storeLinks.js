// stores without a price API we can use: we link straight to their search
// for this ISBN so people can check the price there themselves.
//
// AMAZON_ASSOCIATE_TAG (from Amazon Associates, e.g. "yourname-20") turns the
// Amazon link into an affiliate link. Purchases through it earn a commission
// and count toward the sales Amazon requires before it grants API access.
// Walmart links are turned into affiliate links in the browser by the
// Impact script in client/index.html.
const amazonUrl = (isbn13) => {
  const params = new URLSearchParams({ k: isbn13 });
  const tag = process.env.AMAZON_ASSOCIATE_TAG?.trim();
  if (tag) params.set("tag", tag);
  return `https://www.amazon.com/s?${params}`;
};

export const amazonAffiliate = () =>
  Boolean(process.env.AMAZON_ASSOCIATE_TAG?.trim());

export const storeLinks = (isbn13) => [
  { store: "Amazon", url: amazonUrl(isbn13), affiliate: amazonAffiliate() },
  {
    store: "Barnes & Noble",
    url: `https://www.barnesandnoble.com/s/${isbn13}`,
    affiliate: false,
  },
  {
    store: "Bookshop.org",
    url: `https://bookshop.org/search?keywords=${isbn13}`,
    affiliate: false,
  },
  {
    store: "Walmart",
    url: `https://www.walmart.com/search?q=${isbn13}`,
    affiliate: true,
  },
  {
    store: "Books-A-Million",
    url: `https://www.booksamillion.com/search?query=${isbn13}`,
    affiliate: false,
  },
];
