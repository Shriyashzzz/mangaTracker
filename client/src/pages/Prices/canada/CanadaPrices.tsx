// Canadian prices on a volume page, for anyone who picked Canada. Live from the
// server's sandboxed Canadian check (prices/canada), in Canadian dollars, with
// the stores' own searches always there as well, and on their own when there's
// nothing live to show.
import { useEffect, useState } from "react";
import { getJson } from "../../../lib/api";
import { canadaStoreLinks, timeAgo } from "../../../lib/prices";
import type { Offer } from "../../../lib/types";
import { pricesStyles as styles } from "../styles";
import CountrySwitch from "./CountrySwitch";
import OfferList from "../OfferList";

type Answer = {
  links?: { store: string; url: string; affiliate: boolean }[];
  status: "ok" | "off" | "budget" | "error";
  offers: Offer[];
  checkedAt: string | null;
};

// "CA$15.99": never mistaken for US dollars
const cad = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "CAD",
});

export default function CanadaPrices({ isbn }: { isbn: string }) {
  const [answer, setAnswer] = useState<{ isbn: string; data: Answer } | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();
    getJson<Answer>(`/api/prices/ca/${isbn}`, controller.signal)
      .then((data) => setAnswer({ isbn, data }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") {
          setAnswer({
            isbn,
            data: { status: "error", offers: [], checkedAt: null },
          });
        }
      });
    return () => controller.abort();
  }, [isbn]);

  const data = answer?.isbn === isbn ? answer.data : null;
  const offers = data?.offers ?? [];

  return (
    <section className="mb-8" aria-labelledby="ca-prices-title">
      <div className={styles.sectionHeadRow}>
        <h2 id="ca-prices-title" className={styles.sectionTitle}>
          Prices in Canada
        </h2>
        <span className="flex items-center gap-3">
          {data?.checkedAt && (
            <span className={styles.checked}>
              checked {timeAgo(data.checkedAt)}
            </span>
          )}
          <CountrySwitch />
        </span>
      </div>

      {!data ? (
        <p className={styles.note} role="status">
          Checking Canadian stores…
        </p>
      ) : offers.length > 0 ? (
        <OfferList
          key={isbn}
          offers={offers}
          formatPrice={(cents) => cad.format(cents / 100)}
        />
      ) : (
        <p className={styles.note}>
          {data.status === "budget"
            ? "We've checked as many Canadian prices as we can this month. The stores below have it."
            : data.status === "ok"
              ? "No Canadian store listed this volume when we checked. Try the stores below."
              : "Canadian prices aren't available right now. Try the stores below."}
        </p>
      )}

      <div className={`${styles.otherStores} mt-4`}>
        <h3 className={styles.otherStoresTitle}>Check this volume at:</h3>
        <ul className={styles.storeLinks}>
          {(data?.links?.length ? data.links : canadaStoreLinks(isbn)).map(
            (s) => (
              <li key={s.store}>
                <a
                  href={s.url}
                  target="_blank"
                  rel={
                    "affiliate" in s && s.affiliate
                      ? "sponsored noreferrer"
                      : "noreferrer"
                  }
                  aria-label={`${s.store}. Opens the store in a new tab`}
                >
                  {s.store}
                </a>
              </li>
            ),
          )}
        </ul>
      </div>
      {data?.links?.some((s) => s.affiliate) && (
        <p className={styles.disclosure}>
          The Amazon.ca link is an affiliate link, which helps keep the site
          running at no cost to you.
        </p>
      )}
    </section>
  );
}
