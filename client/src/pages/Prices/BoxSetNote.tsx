// "Also in a box set, from $133.90 →" under a volume's prices. A set is a
// different buy from the one book this page is about, so its listings stay
// off the price list; the series page has them, beside its title.
import { NavLink } from "react-router";
import { formatCents } from "../../lib/prices";
import type { Offer } from "../../lib/types";
import { pricesStyles as styles } from "./styles";

export default function BoxSetNote({
  offers,
  to,
}: {
  // every offer found for the volume, sets among them
  offers: Pick<Offer, "format" | "inStock" | "priceCents">[];
  // the series' price page
  to: string;
}) {
  const sets = offers.filter((o) => o.format === "set" && o.inStock);
  if (!sets.length) return null;
  const from = Math.min(...sets.map((o) => o.priceCents));
  return (
    <p className={styles.boxSetNote}>
      Also in a box set, from{" "}
      <NavLink to={to} className={styles.boxSetNoteLink} viewTransition>
        {formatCents(from)} →
      </NavLink>
    </p>
  );
}
