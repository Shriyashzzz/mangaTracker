// A series' box sets, beside its title: the ones found while pricing its
// volumes (cheapest first, each a link to the listing) and searches for more
// at the stores that sell them. Collectors often buy a whole run as a set.
// On a laptop it's an inked box at the right of the heading; on a phone, a
// row of tickets to swipe under it. Saved prices only: showing them never
// asks a store or spends a search. Every link carries our affiliate tag
// where we have one
import { formatCents } from "../../lib/prices";
import { noteStoreClick } from "../../lib/support";
import type { BoxSet, StoreLink } from "../../lib/types";
import { linkRel } from "./offerLabels";
import { shownSets } from "./boxSetRules";
import { pricesStyles as styles } from "./styles";

const KIND: Record<string, string> = {
  set: "Box set",
  // a 3-in-1 and the like: one book holding several volumes, not a box
  omnibus: "Omnibus",
};
const CONDITION: Record<string, string> = { new: "new", used: "used" };
// shown at once in the box; the rest are a tap away
const FIRST_SHOWN = 2;

// with no set priced yet: where to look for one, a quiet row under the page
export function BoxSetSearch({ links }: { links: StoreLink[] }) {
  if (!links.length) return null;
  return (
    <section className={styles.setSearch} aria-labelledby="box-set-search">
      <h2 id="box-set-search" className={styles.setSearchTitle}>
        Looking for a box set? Try
      </h2>
      <ul className={styles.setSearchStores}>
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
      {links.some((l) => l.affiliate) && (
        <p className={styles.setDisclosure}>
          Some store links are affiliate links, which help keep the site running
          at no cost to you.
        </p>
      )}
    </section>
  );
}

export default function BoxSets({
  sets: found,
  links,
  editionsListed,
}: {
  sets: BoxSet[];
  links: StoreLink[];
  // the page lists the series' omnibus and deluxe books itself ("Other
  // editions"): a stray omnibus listing here would only say it twice
  editionsListed: boolean;
}) {
  const sets = shownSets(found, editionsListed);
  // nothing priced: no box (BoxSetSearch offers the stores, further down)
  if (!sets.length) return null;
  const hasOmnibus = sets.some((s) => s.format === "omnibus");
  const affiliate = [...sets, ...links].some((l) => l.affiliate);

  const ticket = (s: BoxSet, first: boolean, where?: string) => {
    const kind = KIND[s.format] ?? "Set";
    const condition = CONDITION[s.condition] ?? "marketplace";
    const body = (
      <>
        <span className={first ? styles.setKindFirst : styles.setKind}>
          {first ? "Cheapest found" : `${kind} · ${condition}`}
        </span>
        <span className={styles.setStore}>
          {s.store}
          {first && <span className={styles.setAside}> · {condition}</span>}
        </span>
        <span className={styles.setPrice}>{formatCents(s.priceCents)}</span>
      </>
    );
    return (
      <li key={`${s.store}-${s.priceCents}-${s.url}`} className={where}>
        {s.url ? (
          <a
            className={first ? styles.setTicketFirst : styles.setTicket}
            href={s.url}
            target="_blank"
            rel={linkRel(s)}
            onClick={noteStoreClick}
            onAuxClick={noteStoreClick}
            aria-label={`${kind}, ${condition}, at ${s.store}: ${formatCents(s.priceCents)}. Opens the store in a new tab`}
          >
            {body}
          </a>
        ) : (
          <span className={first ? styles.setTicketFirst : styles.setTicket}>
            {body}
          </span>
        )}
      </li>
    );
  };

  const stores = (
    <>
      <ul className={styles.setStores}>
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
      {affiliate && (
        <p className={styles.setDisclosure}>
          Some store links are affiliate links, which help keep the site running
          at no cost to you.
        </p>
      )}
    </>
  );

  return (
    <aside aria-labelledby="box-sets-title" className={styles.setsBox}>
      <h2 id="box-sets-title" className={styles.setsTitle}>
        {hasOmnibus ? "Box sets & omnibuses" : "Box sets"}
      </h2>
      {/* the first two in the box; on a phone, all of them in one row */}
      <ul className={styles.setsList}>
        {sets.map((s, i) =>
          ticket(s, i === 0, i >= FIRST_SHOWN ? styles.setLater : undefined),
        )}
      </ul>
      <details className={styles.setsMore}>
        <summary className={styles.setsMoreSummary}>
          {sets.length > FIRST_SHOWN && (
            <span className={styles.setsMoreCount}>
              {sets.length - FIRST_SHOWN} more, and{" "}
            </span>
          )}
          other stores
        </summary>
        {sets.length > FIRST_SHOWN && (
          <ul className={styles.setsRest}>
            {sets.slice(FIRST_SHOWN).map((s) => ticket(s, false))}
          </ul>
        )}
        {stores}
      </details>
    </aside>
  );
}
