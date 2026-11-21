// A volume's prices, one row per store: the cheapest copies get their stamps,
// the best one stands out, and the whole row is the way to the store. US and
// Canadian prices both use it, so they always look the same; only the money
// differs.
import { inApp } from "../../lib/inApp";
import { useState } from "react";
import { ChevronRightIcon } from "../../components/icons/Icons";
import { shopName } from "../../lib/prices";
import { noteStoreClick } from "../../lib/support";
import { isCollection, type Offer } from "../../lib/types";
import { pricesStyles as styles } from "./styles";
import { awardsOf, linkRel } from "./offerLabels";

const VISIBLE_OFFERS = 5;
const FROM_JAPAN = /japan|tokyo|osaka|kyoto|nippon|\bjp\b/i;

const CONDITION: Record<string, string> = {
  new: "New",
  used: "Used",
  marketplace: "Resold",
};

// awards go to the cheapest copies; type labels say what kind of copy it is
const AWARDS = {
  lowest: { label: "Lowest overall", className: styles.awardLowest },
  newLow: { label: "Cheapest new", className: styles.awardNew },
  // the cheapest new copy at a store people know, when the cheapest new one
  // is a seller nobody has heard of
  knownLow: { label: "Cheapest big store", className: styles.awardNew },
  marketLow: { label: "Cheapest resold", className: styles.awardMarket },
  // when a new copy costs no more, "cheapest" would oversell a used one
  market: { label: "Resold", className: styles.awardMarket },
  // every box set and omnibus gets one: it holds several volumes, never
  // just this one
  boxSet: { label: "Box set", className: styles.awardSet },
  omnibus: { label: "Omnibus", className: styles.awardSet },
};

export default function OfferList({
  offers,
  formatPrice,
  tourTarget,
  volume = null,
  preorder = false,
}: {
  offers: Offer[];
  // not out yet: a new copy's price is a preorder's
  preorder?: boolean;
  // this page's volume number, for "Vol. 3 + more" on box sets
  volume?: number | null;
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
  // which copies, when there are used or marketplace ones as well as new:
  // all, new only, or (in the app's switch) used only. Ebooks are neither
  const [copies, setCopies] = useState<"all" | "new" | "used">("all");
  const newOnly = copies === "new";
  const usedToo =
    offers.some((o) => o.condition === "new") &&
    offers.some((o) => o.condition !== "new" && o.format !== "ebook");
  const isUsed = (o: Offer) => o.condition !== "new" && o.format !== "ebook";
  const kept = offers.filter(
    (o) =>
      !(bigOnly && mixed && !o.knownStore) &&
      !(usedToo && copies === "new" && isUsed(o)) &&
      !(usedToo && copies === "used" && !isUsed(o)),
  );
  // in the app the choice is a switch above the stores, as Android filters
  // a list; the website keeps its line under them
  const app = inApp();
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
  // "lowest" of one price is no award: it needs another copy to beat
  const copiesToCompare = offers.filter(
    (o) => o.inStock && !isCollection(o),
  ).length;
  const stampsOf = (o: Offer) =>
    o === lowest
      ? copiesToCompare > 1
        ? [AWARDS.lowest]
        : []
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
    <>
      {app && usedToo && (
        <div
          className={`${styles.segmented} app-full-segmented`}
          role="group"
          aria-label="Which copies"
        >
          {(
            [
              ["all", "All"],
              ["new", "New"],
              ["used", "Used"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={copies === value}
              onClick={() => setCopies(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
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
                  {shopName(o.store)}
                  {stampsOf(o).map(({ label, className }) => (
                    <span key={label} className={className}>
                      {label}
                    </span>
                  ))}
                </span>
                <span className={styles.offerTags}>
                  {condition}
                  {preorder && o.condition === "new" && " · preorder"}
                  {isCollection(o) &&
                    (volume != null
                      ? ` · Vol. ${volume} + more`
                      : " · This vol. + more")}
                  {!o.inStock && " · out of stock"}
                  {/* "japan-market", "wabi-sabi-tokyo": often the Japanese
                    printing, listed under the English ISBN */}
                  {FROM_JAPAN.test(o.store) &&
                    " · seller in Japan, may be the Japanese edition"}
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
                  aria-label={`${shopName(o.store)}, ${formatPrice(o.priceCents)}, ${condition}. Opens the store in a new tab`}
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
        {(mixed || (usedToo && !app)) && (
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
            {usedToo && !app && (
              <button
                type="button"
                className={styles.textBtn}
                aria-pressed={newOnly}
                onClick={() => setCopies(newOnly ? "all" : "new")}
              >
                {newOnly ? "Show used too" : "New only"}
              </button>
            )}
          </li>
        )}
      </ul>
    </>
  );
}
