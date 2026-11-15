// "checked 1 day ago" above a volume's prices: the newest check on the page,
// and, behind it, how old each store's price is. Opened by a click or tap
// (a <details>, so the browser handles opening, closing and the keyboard);
// a click elsewhere or Escape closes it.
//
// The stores are looked at on their own timers (eBay, Books-A-Million and
// Better World Books every few days, the rest every few weeks:
// server prices/volumeService.ts freshForMs), so one date can't say it all.
import { useEffect, useRef, useState } from "react";
import { shopName, timeAgo } from "../../lib/prices";
import type { Offer } from "../../lib/types";
import { pricesStyles as styles } from "./styles";

type StoreAge = { store: string; at: string };

// each store once, at its newest price, newest store first
function storeAges(offers: Offer[]): StoreAge[] {
  const newest = new Map<string, string>();
  for (const offer of offers) {
    const store = shopName(offer.store);
    const seen = newest.get(store);
    if (!seen || Date.parse(offer.fetchedAt) > Date.parse(seen))
      newest.set(store, offer.fetchedAt);
  }
  return [...newest]
    .map(([store, at]) => ({ store, at }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export default function PriceAges({
  offers,
  checkedAt,
}: {
  offers: Offer[];
  // the server's date for the page, used when there are no prices to date
  checkedAt: string | null;
}) {
  const box = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  // while it's open: a click anywhere else, or Escape, closes it
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const details = box.current;
      if (!details) return;
      const outside =
        e instanceof KeyboardEvent
          ? e.key === "Escape"
          : !details.contains(e.target as Node);
      if (outside) details.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const ages = storeAges(offers);
  const newest = ages[0]?.at ?? checkedAt;
  if (!newest) return null;
  // one store, or none: there's nothing more to say than the one date
  if (ages.length < 2)
    return <span className={styles.checked}>checked {timeAgo(newest)}</span>;
  return (
    <details
      ref={box}
      className={styles.ages}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className={styles.agesToggle}>checked {timeAgo(newest)}</summary>
      <div className={styles.agesBox}>
        <p className={styles.agesTitle}>Each store, last checked</p>
        <ul className={styles.agesList}>
          {ages.map(({ store, at }) => (
            <li key={store} className={styles.agesRow}>
              <span>{store}</span>
              <span className={styles.agesWhen}>{timeAgo(at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
