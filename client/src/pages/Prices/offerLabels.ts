// What kind of copy a price is for, and how store links are marked: shared by
// the price list and the price history
import { pricesStyles as styles } from "./styles";

export const TYPE_LABEL = {
  newPrint: { label: "New print", className: styles.labelNew },
  used: { label: "Used", className: styles.labelMarket },
  marketplace: { label: "Marketplace", className: styles.labelMarket },
  ebook: { label: "Ebook", className: styles.labelEbook },
};

// affiliate links are marked as paid links, as search engines ask
export const linkRel = (link: { affiliate?: boolean }) =>
  link.affiliate ? "sponsored noreferrer" : "noreferrer";
