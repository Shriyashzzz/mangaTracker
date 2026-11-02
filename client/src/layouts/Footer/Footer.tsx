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
  "tap underline decoration-[rgba(127,127,127,0.6)] underline-offset-3 hover:decoration-current";

export default function Footer() {
  const quote = quoteOfTheDay();

  return (
    <footer
      // room for the phones' bottom bar
      className="screentone mt-auto bg-ink text-paper upto-720:pb-[calc(3rem+env(safe-area-inset-bottom))]"
    >
      <div className="px-gutter mx-auto max-w-page py-6 upto-760:py-5">
        {/* equal side columns keep the quote on the page's true center, however
            wide the heading is. Narrower, the heading sits above the quote */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-x-8 gap-y-3 upto-980:grid-cols-[minmax(0,1fr)]">
          <p className="-rotate-3 justify-self-start font-brand text-[1.7rem] leading-none tracking-[1.5px] whitespace-nowrap upto-760:text-[1.3rem]">
            Quote of the day
          </p>

          {/* a narration caption box, lettered like a translated manga */}
          <figure className="caption-box max-w-136 bg-paper px-[0.85rem] pt-[0.45rem] pb-2 text-ink upto-980:max-w-none">
            <div className="animate-quote-in">
              <blockquote className="font-letter text-[0.82rem] leading-[1.3] font-bold tracking-[0.02em] uppercase">
                {quote.text}
              </blockquote>
              <figcaption className="mt-[0.15rem] text-right font-mono text-[0.75rem] text-ink-soft">
                {quote.who},{" "}
                <cite className="text-accent not-italic">{quote.series}</cite>
              </figcaption>
            </div>
          </figure>
        </div>

        {/* the colophon, on its own line under a rule: wraps on phones */}
        <div className="mt-5 flex flex-wrap justify-between gap-x-6 gap-y-[0.4rem] border-t border-[rgba(127,127,127,0.45)] pt-3 font-mono text-[0.75rem] whitespace-nowrap upto-760:mt-4">
          <p className="flex gap-[0.6rem] opacity-80">
            <NavLink to="/updates" className={footerLink}>
              What's new
            </NavLink>
            <span aria-hidden>·</span>
            <NavLink to="/about" className={footerLink}>
              About
            </NavLink>
          </p>
          <p className="flex gap-[0.6rem] opacity-80">
            <span>Vol. 2, {new Date().getFullYear()}</span>
            <span aria-hidden>·</span>
            <span>© {new Date().getFullYear()} Manga Tracker</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
