// A volume's prices, one row per store: the cheapest copies get their stamps,
// the best one stands out, and the whole row is the way to the store. US and
// Canadian prices both use it, so they always look the same; only the money
// differs.
import { useState } from "react";
import { ChevronRightIcon } from "../../components/icons/Icons";
import { noteStoreClick } from "../../lib/support";
import { isCollection, type Offer } from "../../lib/types";
import { pricesStyles as styles } from "./styles";
import { awardsOf, linkRel } from "./offerLabels";

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
  // the cheapest new copy at a store people know, when the cheapest new one
  // is a seller nobody has heard of
  knownLow: { label: "Cheapest big store", className: styles.awardNew },
  marketLow: { label: "Cheapest marketplace", className: styles.awardMarket },
  // when a new copy costs no more, "cheapest" would oversell a used one
  market: { label: "Marketplace", className: styles.awardMarket },
  // every box set and omnibus gets one: it holds several volumes, never
  // just this one
  boxSet: { label: "Box set", className: styles.awardSet },
  omnibus: { label: "Omnibus", className: styles.awardSet },
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
  // only stores people know by name, when some sellers here are ones nobody
  // has heard of (a choice, never the default: the cheapest is still shown)
  const [bigOnly, setBigOnly] = useState(false);
  const mixed =
    offers.some((o) => o.knownStore === false) &&
    offers.some((o) => o.knownStore);
  // new copies only, when there are used or marketplace ones too
  const [newOnly, setNewOnly] = useState(false);
  const usedToo =
    offers.some((o) => o.condition === "new") &&
    offers.some((o) => o.condition !== "new" && o.format !== "ebook");
  const kept = offers.filter(
    (o) =>
      !(bigOnly && mixed && !o.knownStore) &&
      !(newOnly && usedToo && o.condition !== "new" && o.format !== "ebook"),
  );
  // people come here for a physical copy, so single copies come first, then
  // box sets holding this volume, then ebooks. The awards still use the true
  // cheapest-first order
  const listed = [
    ...kept.filter((o) => o.format !== "ebook" && !isCollection(o)),
    ...kept.filter(isCollection),
    ...kept.filter((o) => o.format === "ebook"),
  ];
  const shown = open ? listed : listed.slice(0, VISIBLE_OFFERS);
  const { lowest, newLow, marketLow, knownLow } = awardsOf(offers);
  // one row stands out, and it's the one the headline names
  const highlighted = newLow ?? lowest;
  // stamps are awards only: what kind of copy it is is the line under the
  // store (New, Used, Marketplace, Ebook), so it isn't said twice
  const stampsOf = (o: Offer) =>
    o === lowest
      ? [AWARDS.lowest]
      : [
          ...(o === newLow ? [AWARDS.newLow] : []),
          ...(o === knownLow ? [AWARDS.knownLow] : []),
          ...(o === marketLow
            ? [
                newLow && newLow.priceCents <= o.priceCents
                  ? AWARDS.market
                  : AWARDS.marketLow,
              ]
            : []),
          ...(o.format === "set" ? [AWARDS.boxSet] : []),
          ...(o.format === "omnibus" ? [AWARDS.omnibus] : []),
        ];

  return (
    <ul className={styles.offers} data-tour={tourTarget}>
      {shown.map((o) => {
        // an ebook is an ebook, not a "new" copy (a box set has its stamp)
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
                {isCollection(o) && " · holds this and other volumes"}
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
      {listed.length > VISIBLE_OFFERS && (
        <li className={styles.moreRow}>
          <button
            type="button"
            className={styles.textBtn}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open
              ? "Show fewer"
              : `Show ${listed.length - VISIBLE_OFFERS} more`}
          </button>
        </li>
      )}
      {(mixed || usedToo) && (
        <li className={styles.filterRow}>
          {mixed && (
            <button
              type="button"
              className={styles.textBtn}
              aria-pressed={bigOnly}
              onClick={() => setBigOnly(!bigOnly)}
            >
              {bigOnly ? "Show every seller" : "Big stores only"}
            </button>
          )}
          {usedToo && (
            <button
              type="button"
              className={styles.textBtn}
              aria-pressed={newOnly}
              onClick={() => setNewOnly(!newOnly)}
            >
              {newOnly ? "Show used too" : "New only"}
            </button>
          )}
        </li>
      )}
    </ul>
  );
}
