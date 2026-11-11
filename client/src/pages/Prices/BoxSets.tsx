// A series' box sets: the ones found while pricing its volumes (cheapest
// first, each a link to the listing) and searches for more at the stores
// that sell them. Collectors often buy a whole run as a set; every link
// carries our affiliate tag where we have one
import { ChevronRightIcon } from "../../components/icons/Icons";
import { formatCents } from "../../lib/prices";
import { noteStoreClick } from "../../lib/support";
import type { BoxSet, StoreLink } from "../../lib/types";
import { linkRel } from "./offerLabels";
import { pricesStyles as styles } from "./styles";

const KIND: Record<string, string> = { set: "Box set", omnibus: "Omnibus" };
const CONDITION: Record<string, string> = { new: "New", used: "Used" };

export default function BoxSets({
  sets,
  links,
}: {
  sets: BoxSet[];
  links: StoreLink[];
}) {
  if (!sets.length && !links.length) return null;
  return (
    <section aria-labelledby="box-sets-title" className={styles.boxSets}>
      <h2 id="box-sets-title" className={styles.sectionTitle}>
        Box sets
      </h2>
      {sets.length > 0 && (
        <ul className={styles.offers}>
          {sets.map((s) => {
            const row = (
              <>
                <span className={styles.offerStore}>
                  <span className={styles.offerName}>{s.store}</span>
                  <span className={styles.offerTags}>
                    {KIND[s.format] ?? "Set"} ·{" "}
                    {CONDITION[s.condition] ?? "Marketplace"}
                  </span>
                </span>
                <span className={styles.offerPrice}>
                  {formatCents(s.priceCents)}
                </span>
              </>
            );
            return (
              <li key={`${s.store}-${s.priceCents}-${s.url}`}>
                {s.url ? (
                  <a
                    className={styles.offerRow}
                    href={s.url}
                    target="_blank"
                    rel={linkRel(s)}
                    onClick={noteStoreClick}
                    onAuxClick={noteStoreClick}
                    aria-label={`${KIND[s.format] ?? "Set"} at ${s.store}, ${formatCents(s.priceCents)}. Opens the store in a new tab`}
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
        </ul>
      )}
      <h3 className={styles.otherStoresTitle}>
        {sets.length ? "More box sets at:" : "Find its box sets at:"}
      </h3>
      <ul className={styles.storeLinks}>
        {links.map((l) => (
          <li key={l.store}>
            <a
              href={l.url}
              target="_blank"
              rel={linkRel(l)}
              onClick={noteStoreClick}
              onAuxClick={noteStoreClick}
              aria-label={`${l.store} box sets. Opens the store in a new tab`}
            >
              {l.store}
            </a>
          </li>
        ))}
      </ul>
      {[...sets, ...links].some((l) => l.affiliate) && (
        <p className={styles.disclosure}>
          Some store links are affiliate links, which help keep the site running
          at no cost to you.
        </p>
      )}
    </section>
  );
}
