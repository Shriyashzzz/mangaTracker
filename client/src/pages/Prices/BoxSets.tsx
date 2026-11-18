// A series' box sets, beside its title: the ones found while pricing its
// volumes (cheapest first, each a link to the listing) and searches for more
// at the stores that sell them. Collectors often buy a whole run as a set.
// On a laptop it's an inked box at the right of the heading; on a phone, a
// row of tickets to swipe under it. Saved prices only: showing them never
// asks a store or spends a search. Every link carries our affiliate tag
// where we have one
import { formatCents, shopName } from "../../lib/prices";
import { noteStoreClick } from "../../lib/support";
import type { BoxSet, StoreLink } from "../../lib/types";
import { linkRel } from "./offerLabels";
import { setsTitle, shownSets } from "./boxSetRules";
import { pricesStyles as styles } from "./styles";

const KIND: Record<string, string> = {
  set: "Box set",
  // a 3-in-1 and the like: one book holding several volumes, not a box
  omnibus: "Omnibus",
};
const CONDITION: Record<string, string> = { new: "new", used: "used" };

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
  bare = false,
}: {
  // just the tickets and the stores, with no box or title of its own: for
  // the box that holds box sets and editions together (SetsBox.tsx)
  bare?: boolean;
  sets: BoxSet[];
  links: StoreLink[];
  // the page lists the series' omnibus and deluxe books itself ("Other
  // editions"): a stray omnibus listing here would only say it twice
  editionsListed: boolean;
}) {
  const sets = shownSets(found, editionsListed);
  // nothing priced: no box (BoxSetSearch offers the stores, further down)
  if (!sets.length) return null;
  const affiliate = [...sets, ...links].some((l) => l.affiliate);

  // what a set is, in words: for a link's label, and a row's
  const said = (s: BoxSet) => ({
    kind: KIND[s.format] ?? "Set",
    condition: CONDITION[s.condition] ?? "resold",
    store: shopName(s.store),
    price: formatCents(s.priceCents),
  });
  const linked = (s: BoxSet, className: string, body: React.ReactNode) => {
    const { kind, condition, store, price } = said(s);
    return s.url ? (
      <a
        className={className}
        href={s.url}
        target="_blank"
        rel={linkRel(s)}
        onClick={noteStoreClick}
        onAuxClick={noteStoreClick}
        aria-label={`${kind}, ${condition}, at ${store}: ${price}. Opens the store in a new tab`}
      >
        {body}
      </a>
    ) : (
      <span className={className}>{body}</span>
    );
  };
  // The cheapest is the one ticket. The rest are a short price list under
  // it: one line each, since four tickets saying "Box set · eBay" four times
  // filled the box (and a phone's screen) with the same words
  const [cheapest, ...rest] = sets;
  const lead = said(cheapest!);

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

  // a ticket, as every set is drawn below a laptop
  const ticket = (s: BoxSet, first: boolean) => {
    const { kind, condition, store, price } = said(s);
    return (
      <li key={`${s.store}-${s.priceCents}-${s.url}`}>
        {linked(
          s,
          first ? styles.setTicketFirst : styles.setTicket,
          <>
            <span className={first ? styles.setKindFirst : styles.setKind}>
              {first ? `Cheapest · ${condition}` : `${kind} · ${condition}`}
            </span>
            <span className={styles.setStore}>{store}</span>
            <span className={styles.setPrice}>{price}</span>
          </>,
        )}
      </li>
    );
  };

  const tickets = (
    <>
      {/* on a laptop, in the narrow box: the cheapest as a ticket, the rest
          a price list under it */}
      <div className={styles.setsOnLaptop}>
        {linked(
          cheapest!,
          styles.editionsBoxTicket,
          <>
            <span className={styles.setKindFirst}>
              Cheapest · {lead.condition}
            </span>
            <span className={styles.setStore}>{lead.store}</span>
            <span className={styles.setPrice}>{lead.price}</span>
          </>,
        )}
        {rest.length > 0 && (
          <ul className={styles.setRows}>
            {rest.map((s) => {
              const { kind, condition, store, price } = said(s);
              return (
                <li key={`${s.store}-${s.priceCents}-${s.url}`}>
                  {linked(
                    s,
                    styles.setRow,
                    <>
                      {/* what tells them apart first: new or used (and an
                          omnibus, when the box holds those too) */}
                      <span className={styles.setRowKind}>
                        {s.format === "omnibus" ? `${kind} · ` : ""}
                        {condition}
                      </span>
                      <span className={styles.setStore}>{store}</span>
                      <span className={styles.setPrice}>{price}</span>
                    </>,
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {/* below a laptop there's the width for it: every set a ticket, in a
          row on a tablet and stacked on a phone, as it always was */}
      <div className={styles.setsBelowLaptop}>
        <ul className={styles.setsList}>
          {sets.map((s, i) => ticket(s, i === 0))}
        </ul>
      </div>
      {links.length > 0 && (
        <details className={styles.setsMore}>
          <summary className={styles.setsMoreSummary}>
            <span className={styles.setsOnLaptop}>Look in other stores</span>
            <span className={styles.setsBelowLaptop}>other stores</span>
          </summary>
          {stores}
        </details>
      )}
    </>
  );
  if (bare) return tickets;
  return (
    <aside aria-labelledby="box-sets-title" className={styles.setsBox}>
      <h2 id="box-sets-title" className={styles.setsTitle}>
        {setsTitle(sets)}
      </h2>
      {tickets}
    </aside>
  );
}
