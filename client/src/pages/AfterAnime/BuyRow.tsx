// One volume to buy in a season's panel: its cover, why it's this volume,
// and the way to a store. With a saved price the button goes straight to
// that store (our affiliate link, where we have one), and "Compare all
// stores" opens the volume's own page; without one, the button opens that
// page, where its prices are looked up. A cheaper used copy is offered under
// a new one; with no new copy priced, the used one is the button.
import { NavLink } from "react-router";
import type { BuyOffer, UsedOffer } from "../../lib/afterAnime";
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
import { CoverFallback } from "../Prices/VolumeCard";
import { afterAnimeStyles as styles } from "./styles";

export default function BuyRow({
  volume,
  why,
  book,
  offer,
  used,
  seriesCoverUrl,
}: {
  volume: number;
  // "Chapter 95 is in this one"
  why: string;
  book: SeriesVolume;
  // its cheapest saved new copy at a store readers know; null when there
  // isn't one
  offer: BuyOffer | null;
  // and its cheapest used one (Better World Books', most often)
  used: UsedOffer | null;
  // stands in, washed out, when this volume has no cover of its own
  seriesCoverUrl: string | null;
}) {
  // where the button goes: the new copy, or else the used one
  const main = offer ?? used;
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
        <CoverFallback number={volume} seriesCoverUrl={seriesCoverUrl} />
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
        {/* the price said first: a new copy's, or else a used one's */}
        {offer && (
          <p className={styles.buyPrice}>
            <strong>{formatCents(offer.cents)}</strong> at {offer.store}
            <span className={styles.buyChecked}>
              Price checked {timeAgo(offer.checkedAt)}
            </span>
          </p>
        )}
        {!offer && used && (
          <p className={styles.buyPrice}>
            <strong>{formatCents(used.cents)}</strong> used at {used.store}
            <span className={styles.buyChecked}>
              Price checked {timeAgo(used.checkedAt)}
            </span>
          </p>
        )}
        <div className={styles.buyActions}>
          {main ? (
            <>
              <a
                href={main.url}
                className="btn btn-primary"
                target="_blank"
                rel={linkRel(main)}
              >
                Buy vol. {volume}
                {!offer && " used"}
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
        {/* under a new copy: the cheaper used one, when it is cheaper */}
        {offer && used && used.cents < offer.cents && (
          <p className={styles.buyUsed}>
            Or used from{" "}
            <a href={used.url} target="_blank" rel={linkRel(used)}>
              {formatCents(used.cents)} at {used.store}
            </a>
          </p>
        )}
      </div>
    </li>
  );
}
