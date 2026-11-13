// The last page of a manga volume: a sign-off, a parting line (one quote a
// day), and the colophon. Inked black with screentone dots.
import { NavLink } from "react-router";
import { QUOTES, type Quote } from "../../lib/content/quotes";

// one quote per calendar day, the same for everyone, turning over at local
// midnight. Counting whole days keeps it walking through the list in order
const quoteOfTheDay = (date = new Date()): Quote => {
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
  );
  return QUOTES[day % QUOTES.length]!;
};

const footerLink =
  "tap underline decoration-[rgba(127,127,127,0.6)] underline-offset-3 hover:decoration-current";

export default function Footer() {
  const quote = quoteOfTheDay();

  return (
    <footer
      // room for the phones' bottom bar. Ink and paper swap in dark mode,
      // so there it's inked near-black on purpose rather than a cream slab
      className="screentone mt-auto bg-ink text-paper upto-720:pb-[calc(3.75rem+env(safe-area-inset-bottom))] dark:border-t-[1.5px] dark:border-line dark:bg-[#0b0a07] dark:text-ink"
    >
      {/* one slim strip on laptops, with equal side columns so the quote stays
          on the page's true center. Narrower, the quote gets a row of its own,
          with the heading and links above it. On phones only the two links fit
          beside the heading, so the rest signs off under the quote */}
      <div className="px-gutter mx-auto grid max-w-page grid-cols-[minmax(16.5rem,1fr)_minmax(0,auto)_minmax(16.5rem,1fr)] items-center gap-x-8 gap-y-4 py-[1.1rem] upto-980:grid-cols-[minmax(0,1fr)_auto] upto-760:gap-x-3 upto-760:gap-y-[0.6rem] upto-760:py-3">
        <p className="-rotate-3 justify-self-start font-brand text-[1.7rem] leading-none tracking-[1.5px] whitespace-nowrap upto-760:text-[1.3rem]">
          Quote of the day
        </p>

        {/* a narration caption box, lettered like a translated manga */}
        <figure className="caption-box max-w-136 justify-self-center bg-paper px-[0.85rem] pt-[0.45rem] pb-2 text-ink upto-980:col-span-full upto-980:row-start-2 upto-980:max-w-none upto-980:justify-self-stretch">
          <div className="animate-quote-in">
            <blockquote className="font-letter text-[0.82rem] leading-[1.3] font-bold tracking-[0.02em] uppercase">
              {quote.text}
            </blockquote>
            <figcaption className="mt-[0.15rem] text-right font-mono text-[0.8rem] text-ink-soft">
              {quote.who},{" "}
              <cite className="text-accent not-italic">{quote.series}</cite>
            </figcaption>
          </div>
        </figure>

        {/* two short lines, so this column stays narrow enough to leave the
            quote room */}
        <div className="flex flex-col items-end gap-y-[0.3rem] justify-self-end font-mono text-[0.75rem] whitespace-nowrap upto-760:contents">
          <p className="flex gap-[0.6rem] opacity-80 upto-760:col-start-2 upto-760:row-start-1 upto-760:gap-[0.45rem] upto-760:justify-self-end">
            {/* laptops only: a phone's row has room for three (there it's
                under the price search) */}
            <NavLink
              to="/after-the-anime"
              className={`${footerLink} upto-760:hidden`}
            >
              After the anime
            </NavLink>
            <span aria-hidden className="upto-760:hidden">
              ·
            </span>
            <NavLink to="/updates" className={footerLink}>
              What's new
            </NavLink>
            <span aria-hidden>·</span>
            <NavLink to="/faq" className={footerLink}>
              FAQ
            </NavLink>
            <span aria-hidden>·</span>
            <NavLink to="/about" className={footerLink}>
              About
            </NavLink>
          </p>
          <p className="flex gap-[0.6rem] opacity-80 upto-760:col-span-full upto-760:row-start-3 upto-760:gap-[0.45rem] upto-760:justify-self-end">
            <span>Vol. 2, {new Date().getFullYear()}</span>
            <span aria-hidden>·</span>
            <span>© {new Date().getFullYear()} Manga Tracker</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
