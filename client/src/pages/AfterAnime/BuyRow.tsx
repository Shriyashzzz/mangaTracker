// One volume to buy in a season's panel: its cover, why it's this volume,
// and the way to a store. With a saved price the button goes straight to
// that store (our affiliate link, where we have one), and "Compare all
// stores" opens the volume's own page; without one, the button opens that
// page, where its prices are looked up.
import { NavLink } from "react-router";
import type { BuyOffer } from "../../lib/afterAnime";
import {
  coverSrc,
  formatCents,
  hideBrokenCover,
  hidePlaceholderCover,
  timeAgo,
  volumePath,
} from "../../lib/prices";
import type { SeriesVolume } from "../../lib/types";
import { linkRel } from "../Prices/offerLabels";
import { afterAnimeStyles as styles } from "./styles";

export default function BuyRow({
  volume,
  why,
  book,
  offer,
}: {
  volume: number;
  // "Chapter 95 is in this one"
  why: string;
  book: SeriesVolume;
  // its cheapest saved copy at a store readers know; undefined when there
  // isn't one
  offer: BuyOffer | undefined;
}) {
  const pricePage = volumePath(book.isbn13, book.title);
  // a cheaper copy at a seller we don't name here is on the volume's page
  const cheaperElsewhere =
    offer && book.knownPriceCents !== null && book.knownPriceCents < offer.cents
      ? ` (from ${formatCents(book.knownPriceCents)})`
      : "";
  return (
    <li className={styles.buy}>
      <NavLink
        to={pricePage}
        className={styles.buyCover}
        aria-hidden
        tabIndex={-1}
        viewTransition
      >
        <span className={styles.buyCoverNumber}>{volume}</span>
        {book.coverUrl && (
          <img
            src={coverSrc(book.coverUrl)}
            alt=""
            loading="lazy"
            onError={hideBrokenCover}
            onLoad={hidePlaceholderCover}
          />
        )}
      </NavLink>
      <div className={styles.buyWords}>
        <h3 className={styles.buyTitle}>Volume {volume}</h3>
        <p className={styles.buyWhy}>{why}</p>
        {offer && (
          <p className={styles.buyPrice}>
            <strong>{formatCents(offer.cents)}</strong> at {offer.store}
            <span className={styles.buyChecked}>
              Price checked {timeAgo(offer.checkedAt)}
            </span>
          </p>
        )}
        <div className={styles.buyActions}>
          {offer ? (
            <>
              <a
                href={offer.url}
                className="btn btn-primary"
                target="_blank"
                rel={linkRel(offer)}
              >
                Buy vol. {volume}
              </a>
              <NavLink to={pricePage} className={styles.link} viewTransition>
                Compare all stores{cheaperElsewhere}
              </NavLink>
            </>
          ) : (
            <NavLink to={pricePage} className="btn btn-primary" viewTransition>
              Check vol. {volume} prices
            </NavLink>
          )}
        </div>
      </div>
    </li>
  );
}
