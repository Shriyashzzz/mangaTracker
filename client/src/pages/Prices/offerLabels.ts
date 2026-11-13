// What kind of copy a price is for, and how store links are marked: shared by
// the price list and the price history
import { isCollection, type Offer } from "../../lib/types";
import { pricesStyles as styles } from "./styles";

export const TYPE_LABEL = {
  newPrint: { label: "New print", className: styles.labelNew },
  used: { label: "Used", className: styles.labelMarket },
  marketplace: { label: "Resold", className: styles.labelMarket },
  ebook: { label: "Ebook", className: styles.labelEbook },
};

// affiliate links are marked as paid links, as search engines ask
export const linkRel = (link: { affiliate?: boolean }) =>
  link.affiliate ? "sponsored noreferrer" : "noreferrer";

// the cheapest copies you can buy now, which get the stamps; offers come
// cheapest first, so each is the first match
export const awardsOf = (offers: Offer[]) => {
  // a box set or omnibus is listed, but never this volume's cheapest copy
  const inStock = offers.filter((o) => o.inStock && !isCollection(o));
  const lowest = inStock[0];
  const newLow = inStock.find(
    (o) => o.format === "print" && o.condition === "new",
  );
  const marketLow = inStock.find(
    (o) => o.format === "print" && o.condition !== "new",
  );
  const knownLow =
    newLow?.knownStore === false
      ? inStock.find(
          (o) => o.format === "print" && o.condition === "new" && o.knownStore,
        )
      : undefined;
  return { lowest, newLow, marketLow, knownLow };
};

// the cheapest new copy at a store people know, when the cheapest new copy
// overall is from a seller they may not trust (the headline names both)
export const knownStoreLow = (offers: Offer[]) => awardsOf(offers).knownLow;
