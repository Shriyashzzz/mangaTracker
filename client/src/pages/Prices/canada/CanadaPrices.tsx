// Canadian prices on a volume page, for anyone who picked Canada. Live from the
// server's sandboxed Canadian check (prices/canada), in Canadian dollars, with
// the stores' own searches always there as well, and on their own when there's
// nothing live to show. The server sends those links, affiliate tags included.
import { humanQuery } from "../../../lib/turnstile";
import { useEffect, useState } from "react";
import { getJson } from "../../../lib/api";
import { readLocal } from "../../../lib/prefs";
import BoxSetNote from "../BoxSetNote";
import { timeAgo } from "../../../lib/prices";
import { noteStoreClick } from "../../../lib/support";
import type { Offer } from "../../../lib/types";
import { pricesStyles as styles } from "../styles";
import CountrySwitch from "./CountrySwitch";
import OfferList from "../OfferList";

type Answer = {
  links?: { store: string; url: string; affiliate: boolean }[];
  status: "ok" | "off" | "budget" | "unknown" | "error";
  offers: Offer[];
  checkedAt: string | null;
};

// "CA$15.99": never mistaken for US dollars
const cad = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "CAD",
});

const WHY_NONE: Record<Answer["status"], string> = {
  ok: "No Canadian store listed this volume when we checked. Try the stores below.",
  budget:
    "We've checked as many Canadian prices as we can this month. The stores below have it.",
  unknown:
    "We don't have Canadian prices for this volume yet. Try the stores below.",
  off: "Canadian prices aren't available right now. Try the stores below.",
  error: "Canadian prices aren't available right now. Try the stores below.",
};

// a volume not out yet: a button for each of these (the affiliate stores),
// the first the main one, as the US page has; the others are links under them
const PREORDER_STORES = ["Amazon.ca", "eBay.ca"];

export default function CanadaPrices({
  isbn,
  volume,
  preorder,
  seriesLink,
}: {
  // the series' price page, where its box sets are
  seriesLink: string;
  isbn: string;
  volume: number | null;
  // the day it comes out ("Mar 30, 2027"), when it isn't out yet
  preorder: string | null;
}) {
  const [answer, setAnswer] = useState<{ isbn: string; data: Answer } | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();
    const ask = (human: string) =>
      getJson<Answer>(`/api/prices/ca/${isbn}${human}`, controller.signal);
    const failed = (e: Error) => {
      if (e.name !== "AbortError")
        setAnswer((had) =>
          // a live check failing after the saved prices showed keeps them
          had?.isbn === isbn
            ? had
            : { isbn, data: { status: "error", offers: [], checkedAt: null } },
        );
    };
    // what's saved shows at once, as the US prices do; then a live check
    // (with its Turnstile token, which can take a few seconds) replaces it.
    // A preorder gets no live check, so the first answer is the only one
    ask("")
      .then((data) => setAnswer({ isbn, data }))
      .catch(failed);
    if (!preorder)
      humanQuery("?", controller.signal)
        .then((human) => (human ? ask(human) : null))
        .then((data) => data && setAnswer({ isbn, data }))
        .catch(failed);
    return () => controller.abort();
  }, [isbn, preorder]);

  const data = answer?.isbn === isbn ? answer.data : null;
  // only physical copies, if that's what they've asked for, like the US list
  const hideEbooks = readLocal("hideEbooks") === "yes";
  const allOffers = data?.offers ?? [];
  const hiddenEbooks = hideEbooks
    ? allOffers.filter((o) => o.format === "ebook").length
    : 0;
  // a box set is another buy: off this list (BoxSetNote points to them)
  const offers = allOffers.filter(
    (o) => !(hideEbooks && o.format === "ebook") && o.format !== "set",
  );
  const allLinks = data?.links ?? [];
  // not out yet: no prices to compare, just where to order it
  const preorderAt = preorder
    ? PREORDER_STORES.flatMap(
        (name) => allLinks.find((s) => s.store === name) ?? [],
      )
    : [];
  const links = allLinks.filter((s) => !preorderAt.includes(s));

  return (
    <section className="mb-8" aria-labelledby="ca-prices-title">
      <div className={styles.sectionHeadRow}>
        <h2 id="ca-prices-title" className={styles.sectionTitle}>
          Prices in Canada
        </h2>
        <span className={styles.checkedRow}>
          {data?.checkedAt && (
            <span className={styles.checked}>
              checked {timeAgo(data.checkedAt)}
            </span>
          )}
          <CountrySwitch />
        </span>
      </div>

      {preorder ? (
        <div id="preorder" className={styles.preorder}>
          <p className="m-0">
            Not out until <b>{preorder}</b>. Preorder it now and it ships on
            release day; prices show here once it's out.
          </p>
          {preorderAt.length > 0 && (
            <div className={styles.preorderButtons}>
              {preorderAt.map((s, i) => (
                <a
                  key={s.store}
                  href={s.url}
                  target="_blank"
                  rel={s.affiliate ? "sponsored noreferrer" : "noreferrer"}
                  onClick={noteStoreClick}
                  onAuxClick={noteStoreClick}
                  className={`btn ${i === 0 ? "btn-primary" : "btn-secondary"}`}
                  aria-label={`Preorder on ${s.store}. Opens the store in a new tab`}
                >
                  {i === 0 ? `Preorder on ${s.store}` : s.store}
                </a>
              ))}
            </div>
          )}
        </div>
      ) : !data ? (
        <p className={styles.note} role="status">
          Checking Canadian stores…
        </p>
      ) : offers.length > 0 ? (
        <OfferList
          key={isbn}
          offers={offers}
          formatPrice={(cents) => cad.format(cents / 100)}
          volume={volume}
        />
      ) : (
        <p className={styles.note}>{WHY_NONE[data.status]}</p>
      )}
      <BoxSetNote offers={allOffers} to={seriesLink} />
      {hiddenEbooks > 0 && (
        <p className={styles.checked}>
          {hiddenEbooks} ebook {hiddenEbooks === 1 ? "price" : "prices"} hidden.
        </p>
      )}

      {links.length > 0 && (
        <div className={`${styles.otherStores} mt-4`}>
          <h3 className={styles.otherStoresTitle}>
            {preorder ? "Or preorder at:" : "Check this volume at:"}
          </h3>
          <ul className={styles.storeLinks}>
            {links.map((s) => (
              <li key={s.store}>
                <a
                  href={s.url}
                  target="_blank"
                  rel={s.affiliate ? "sponsored noreferrer" : "noreferrer"}
                  onClick={noteStoreClick}
                  onAuxClick={noteStoreClick}
                  aria-label={`${s.store}. Opens the store in a new tab`}
                >
                  {s.store}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {links.some((s) => s.affiliate) && (
        <p className={styles.disclosure}>
          Some store links are affiliate links, which help keep the site running
          at no cost to you.
        </p>
      )}
    </section>
  );
}
