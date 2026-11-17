// One volume to buy in a season's panel: its cover, why it's this volume,
// and the way to a store. With a saved price the button goes straight to
// that store (our affiliate link, where we have one), and "Compare all
// stores" opens the volume's own page; without one, the button opens that
// page, where its prices are looked up. A cheaper used copy is offered under
// a new one; with no new copy priced, the used one is the button.
import { volumesStyles } from "../Home/volumesStyles";
import Cover from "../../components/cover/Cover";
import { NavLink } from "react-router";
import type { BuyOffer, UsedOffer } from "../../lib/afterAnime";
import { formatCents, timeAgo, volumePath } from "../../lib/prices";
import type { SeriesVolume } from "../../lib/types";
import { linkRel } from "../Prices/offerLabels";
import { CoverFallback } from "../Prices/VolumeCard";
import { bookShort, bookWords } from "./bookFor";
import { afterAnimeStyles as styles } from "./styles";

export default function BuyRow({
  volume,
  why,
  book,
  offer,
  used,
  seriesCoverUrl,
  seriesName,
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
  seriesName: string;
}) {
  // "Volume 14", or the book it's in: "Book 7 (vols. 13–14)"
  const words = bookWords(book, volume);
  const heading = words[0]!.toUpperCase() + words.slice(1);
  const short = bookShort(book, volume);
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
        <CoverFallback
          number={volume}
          seriesCoverUrl={seriesCoverUrl}
          seriesName={seriesName}
          numbered
        />
        <Cover url={book.coverUrl} sizes="80px" />
        {/* its number on the corner, as a series page's covers carry it
            (the small tile's stamp, from the shelf) */}
        <span className={`${volumesStyles.vol} text-[1.05rem]!`}>{volume}</span>
      </NavLink>
      <div className={styles.buyWords}>
        <h3 className={styles.buyTitle}>{heading}</h3>
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
                Buy {short}
                {!offer && " used"}
              </a>
              <NavLink to={pricePage} className={styles.link} viewTransition>
                Compare all stores{cheaperElsewhere}
              </NavLink>
            </>
          ) : (
            <NavLink to={pricePage} className="btn btn-primary" viewTransition>
              Check {short} prices
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
