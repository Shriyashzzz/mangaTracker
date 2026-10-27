// The last page of a manga volume: a sign-off, a parting line (one quote a
// day), and the colophon. Inked black with screentone dots.
import { NavLink } from "react-router";
import { QUOTES, type Quote } from "../../lib/quotes";

// one quote per calendar day, the same for everyone, turning over at local
// midnight. Counting whole days keeps it walking through the list in order
const quoteOfTheDay = (date = new Date()): Quote => {
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
  );
  return QUOTES[day % QUOTES.length]!;
};

const footerLink =
  "underline decoration-[rgba(127,127,127,0.6)] underline-offset-3 hover:decoration-current";

export default function Footer() {
  const quote = quoteOfTheDay();

  return (
    <footer className="screentone mt-auto bg-ink text-paper">
      {/* one slim strip on laptops; on phones the quote gets its own row and
          the links go under it, so they never run into the heading */}
      <div className="px-gutter mx-auto grid max-w-page grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-10 gap-y-4 py-[1.1rem] upto-760:grid-cols-[minmax(0,1fr)_auto] upto-760:gap-x-4 upto-760:gap-y-[0.9rem] upto-760:pt-4">
        <p className="-rotate-3 font-brand text-[1.7rem] leading-none tracking-[1.5px] whitespace-nowrap upto-760:text-[1.3rem]">
          Quote of the day
        </p>

        {/* a narration caption box, lettered like a translated manga */}
        <figure className="caption-box max-w-136 justify-self-center bg-paper px-[0.85rem] pt-[0.45rem] pb-2 text-ink upto-760:col-span-full upto-760:row-start-2 upto-760:max-w-none upto-760:justify-self-stretch">
          <div className="animate-quote-in">
            <blockquote className="font-letter text-[0.82rem] leading-[1.3] font-bold tracking-[0.02em] uppercase">
              {quote.text}
            </blockquote>
            <figcaption className="mt-[0.15rem] text-right font-mono text-[0.68rem] text-ink-soft">
              {quote.who}, <cite className="text-accent not-italic">{quote.series}</cite>
            </figcaption>
          </div>
        </figure>

        <p className="flex gap-[0.6rem] font-mono text-[0.75rem] whitespace-nowrap opacity-80 upto-760:col-span-full upto-760:row-start-3 upto-760:gap-[0.45rem] upto-760:text-[0.7rem]">
          <NavLink to="/series" className={footerLink}>
            Series
          </NavLink>
          <span aria-hidden>·</span>
          <NavLink to="/about" className={footerLink}>
            About
          </NavLink>
          <span aria-hidden>·</span>
          <span>Vol. 1, {new Date().getFullYear()}</span>
        </p>
      </div>
    </footer>
  );
}
