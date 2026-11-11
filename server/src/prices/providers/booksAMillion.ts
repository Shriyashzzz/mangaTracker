// Books-A-Million through CJ (Commission Junction), where we're their
// affiliate: CJ's product search reads their catalog, which they send CJ
// about once a day, so this is their own listed price, not a scrape. Free.
// Needs CJ_API_TOKEN, CJ_COMPANY_ID, CJ_BAM_ID and CJ_WEBSITE_ID (see
// config.ts). Each search takes one from today's count (api_usage, a row a
// day, CJ_DAILY_LIMIT); none left, it throws SearchesUsedUp and the stored
// prices stay. https://developers.cj.com/graphql/reference/Product%20Search
import config from "../../config/config.js";
import priceQueries from "../../models/priceQueries.js";
import type { Provider } from "../types.js";
import { SearchesUsedUp } from "./serpapiKeys.js";

const URL = "https://ads.api.cj.com/query";

// the day in UTC: CJ doesn't say when its day turns over
const today = () => new Date().toISOString().slice(0, 10);
export const cjBudgetLabel = (day = today()) => `cj:${day}`;
const monthOf = (day: string) => `${day.slice(0, 7)}-01`;
export const cjCallsLeft = () =>
  priceQueries.anyCallsLeft(
    [cjBudgetLabel()],
    config.CJ_DAILY_LIMIT,
    monthOf(today()),
  );

type Product = {
  advertiserId?: string;
  gtin?: string;
  price?: { amount?: string; currency?: string } | null;
  salePrice?: { amount?: string; currency?: string } | null;
  availability?: string | null;
  link?: string | null;
  linkCode?: { clickUrl?: string | null } | null;
};

// GraphQL strings: the IDs are ours, but quoted safely all the same
const str = (value: string) => JSON.stringify(value);

const cents = (money: Product["price"]) => {
  const amount = Number(money?.amount);
  return money?.currency === "USD" && Number.isFinite(amount) && amount > 0
    ? Math.round(amount * 100)
    : null;
};

const booksAMillion: Provider = {
  id: "books-a-million",
  store: "Books-A-Million",
  enabled: () =>
    Boolean(
      config.CJ_API_TOKEN &&
      config.CJ_COMPANY_ID &&
      config.CJ_BAM_ID &&
      config.CJ_WEBSITE_ID,
    ),

  async fetchOffers(isbn13, signal) {
    const day = today();
    if (
      !(await priceQueries.claimApiCall(
        cjBudgetLabel(day),
        config.CJ_DAILY_LIMIT,
        monthOf(day),
      ))
    )
      throw new SearchesUsedUp(`CJ calls used up for ${day}`);

    const query = `{ products(companyId: ${str(config.CJ_COMPANY_ID!)}, partnerIds: [${str(config.CJ_BAM_ID!)}], keywords: [${str(isbn13)}], limit: 10) {
      resultList { advertiserId price { amount currency } salePrice { amount currency } link
        ... on Shopping { gtin availability }
        linkCode(pid: ${str(config.CJ_WEBSITE_ID!)}) { clickUrl } } } }`;
    const res = await fetch(URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.CJ_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal,
    });
    // too many at once: this check fails, the day's count goes on
    if (res.status === 429) throw new SearchesUsedUp("CJ answered 429");
    if (!res.ok) throw new Error(`CJ product search responded ${res.status}`);
    const body = (await res.json()) as {
      data?: { products?: { resultList?: Product[] } | null };
      errors?: { message?: string }[];
    };
    if (body.errors?.length)
      throw new Error(`CJ product search: ${body.errors[0]?.message}`);

    // a keyword search can match other books: only this exact ISBN, from
    // Books-A-Million itself
    const match = (body.data?.products?.resultList ?? []).find(
      (p) => p.advertiserId === config.CJ_BAM_ID && p.gtin === isbn13,
    );
    if (!match) return [];
    const list = cents(match.price);
    const sale = cents(match.salePrice);
    const priceCents = sale && (!list || sale < list) ? sale : list;
    if (!priceCents) return [];
    return [
      {
        store: this.store,
        format: "print",
        condition: "new",
        priceCents,
        currency: "USD",
        inStock: !/out|unavailable/i.test(match.availability ?? ""),
        url: match.linkCode?.clickUrl ?? match.link ?? null,
      },
    ];
  },
};

export default booksAMillion;
