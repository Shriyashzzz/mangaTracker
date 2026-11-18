// One volume to buy after a season: its cover, why it's this volume, what
// it costs, and the way to a store. Top to bottom, in the order someone
// decides: the price (said large), one button that names the store it goes
// to (our affiliate link, where we have one), then the other ways in as a
// quiet row (a cheaper used copy, every store on the volume's own page),
// and last when the price was checked. With no saved price the button opens
// the volume's page, where its prices are looked up. With no new copy
// priced, the used one is the price and the button.
import { volumesStyles } from "../Home/volumesStyles";
import clsx from "clsx";
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
  lead = false,
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
  // in the page's opening ticket: the price is said larger still
  lead?: boolean;
}) {
  // "Volume 14", or the book it's in: "Book 7 (vols. 13–14)"
  const words = bookWords(book, volume);
  const heading = words[0]!.toUpperCase() + words.slice(1);
  const short = bookShort(book, volume);
  // where the button goes: the new copy, or else the used one
  const main = offer ?? used;
  const pricePage = volumePath(book.isbn13, book.title);
  const cheaperUsed = offer && used && used.cents < offer.cents ? used : null;
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
        {main && (
          <p className={clsx(styles.buyPrice, lead && styles.buyPriceLead)}>
            <strong>{formatCents(main.cents)}</strong>
            {offer ? "new" : "used"} at {main.store}
          </p>
        )}
        <div className={styles.buyActions}>
          {main ? (
            <a
              href={main.url}
              className="btn btn-primary"
              target="_blank"
              rel={linkRel(main)}
              // the volume is in the heading above; said again for a screen
              // reader, which may meet the button on its own
              aria-label={`Buy ${short}${offer ? "" : " used"} at ${main.store}`}
            >
              Buy{!offer && " used"} at {main.store}
            </a>
          ) : (
            <NavLink to={pricePage} className="btn btn-primary" viewTransition>
              Check {short} prices
            </NavLink>
          )}
          {main && (
            <p className={styles.buyOthers}>
              {/* the cheaper used copy, when it is cheaper */}
              {cheaperUsed && (
                <a
                  href={cheaperUsed.url}
                  target="_blank"
                  rel={linkRel(cheaperUsed)}
                >
                  Used, {formatCents(cheaperUsed.cents)} at {cheaperUsed.store}
                </a>
              )}
              <NavLink to={pricePage} viewTransition>
                Compare all stores{cheaperElsewhere}
              </NavLink>
            </p>
          )}
        </div>
        {main && (
          <p className={styles.buyChecked}>
            Price checked {timeAgo(main.checkedAt)}
          </p>
        )}
      </div>
    </li>
  );
}
