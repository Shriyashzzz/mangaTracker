// A volume's prices, one row per store: the cheapest copies get their stamps,
// the best one stands out, and the whole row is the way to the store. US and
// Canadian prices both use it, so they always look the same; only the money
// differs.
import { useState } from "react";
import { ChevronRightIcon } from "../../components/icons/Icons";
import { noteStoreClick } from "../../lib/support";
import type { Offer } from "../../lib/types";
import { pricesStyles as styles } from "./styles";
import { linkRel } from "./offerLabels";

const VISIBLE_OFFERS = 5;

const CONDITION: Record<string, string> = {
  new: "New",
  used: "Used",
  marketplace: "Marketplace",
};

// awards go to the cheapest copies; type labels say what kind of copy it is
const AWARDS = {
  lowest: { label: "Lowest overall", className: styles.awardLowest },
  newLow: { label: "Cheapest new", className: styles.awardNew },
  marketLow: { label: "Cheapest marketplace", className: styles.awardMarket },
};

// the cheapest copies you can buy now, which get the stamps; offers come
// cheapest first, so each is the first match
const awardsOf = (offers: Offer[]) => {
  const inStock = offers.filter((o) => o.inStock);
  const lowest = inStock[0];
  const newLow = inStock.find(
    (o) => o.format === "print" && o.condition === "new",
  );
  const marketLow = inStock.find(
    (o) => o.format === "print" && o.condition !== "new",
  );
  return { lowest, newLow, marketLow };
};

export default function OfferList({
  offers,
  formatPrice,
  tourTarget,
}: {
  offers: Offer[];
  formatPrice: (cents: number) => string;
  tourTarget?: string;
}) {
  const [open, setOpen] = useState(false);
  // people come here for a physical copy, so ebooks go under the print ones.
  // The awards still use the true cheapest-first order
  const listed = [
    ...offers.filter((o) => o.format !== "ebook"),
    ...offers.filter((o) => o.format === "ebook"),
  ];
  const shown = open ? listed : listed.slice(0, VISIBLE_OFFERS);
  const { lowest, newLow, marketLow } = awardsOf(offers);
  // one row stands out, and it's the one the headline names
  const highlighted = newLow ?? lowest;
  // stamps are awards only: what kind of copy it is is the line under the
  // store (New, Used, Marketplace, Ebook), so it isn't said twice
  const stampsOf = (o: Offer) =>
    o === lowest
      ? [AWARDS.lowest]
      : [
          ...(o === newLow ? [AWARDS.newLow] : []),
          ...(o === marketLow ? [AWARDS.marketLow] : []),
        ];

  return (
    <ul className={styles.offers} data-tour={tourTarget}>
      {shown.map((o) => {
        // an ebook is an ebook, not a "new" copy
        const condition =
          o.format === "ebook"
            ? "Ebook"
            : (CONDITION[o.condition] ?? o.condition);
        const row = (
          <>
            <span className={styles.offerStore}>
              <span className={styles.offerName}>
                {o.store}
                {stampsOf(o).map(({ label, className }) => (
                  <span key={label} className={className}>
                    {label}
                  </span>
                ))}
              </span>
              <span className={styles.offerTags}>
                {condition}
                {!o.inStock && " · out of stock"}
              </span>
            </span>
            <span className={styles.offerPrice}>
              {formatPrice(o.priceCents)}
            </span>
          </>
        );
        return (
          <li
            key={`${o.store}-${o.format}-${o.condition}`}
            className={o === highlighted ? styles.lowestOffer : ""}
          >
            {/* the whole row is the way to the store */}
            {o.url ? (
              <a
                className={styles.offerRow}
                href={o.url}
                target="_blank"
                rel={linkRel(o)}
                onClick={noteStoreClick}
                onAuxClick={noteStoreClick}
                aria-label={`${o.store}, ${formatPrice(o.priceCents)}, ${condition}. Opens the store in a new tab`}
              >
                {row}
                <span className={styles.offerGo} aria-hidden>
                  <span className="upto-720:hidden">Go to store</span>
                  <ChevronRightIcon />
                </span>
              </a>
            ) : (
              <span className={styles.offerRow}>{row}</span>
            )}
          </li>
        );
      })}
      {offers.length > VISIBLE_OFFERS && (
        <li className={styles.moreRow}>
          <button
            type="button"
            className={styles.textBtn}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open
              ? "Show fewer"
              : `Show ${offers.length - VISIBLE_OFFERS} more`}
          </button>
        </li>
      )}
    </ul>
  );
}
