// Sits on top of a loading skeleton. Quick loads never see it; a slow one
// (a big series, a cold price check) gets a quote to read meanwhile, and a
// new one every few seconds after that. Rendered into <body> so it stays
// pinned to the window whatever the skeleton's container is doing.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QUOTES } from "../../lib/quotes";
import Mascot from "../mascot/Mascot";

const SHOW_AFTER_MS = 1000;
const NEXT_QUOTE_MS = 5000;

export default function SlowLoadQuote() {
  const [shown, setShown] = useState(false);
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * QUOTES.length),
  );

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!shown) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % QUOTES.length),
      NEXT_QUOTE_MS,
    );
    return () => clearInterval(timer);
  }, [shown]);

  if (!shown) return null;
  const quote = QUOTES[index]!;

  return createPortal(
    // a printed panel floating over the skeleton, in the middle of the window
    <div className="printed fixed top-1/2 left-1/2 z-40 grid w-[min(460px,calc(100vw-32px))] -translate-1/2 grid-cols-[64px_1fr] items-center gap-[0.9rem] rounded-ink border-[2.5px] border-line bg-card py-[0.9rem] pr-[1.1rem] pl-[0.9rem] shadow-[0_18px_40px_-18px_rgba(20,14,8,0.55)] animate-panel-in motion-reduce:animate-none">
      <span
        className="block aspect-square w-16 rounded-full border-2 border-line bg-paper px-[0.35rem] pt-[0.35rem] pb-[0.1rem]"
        aria-hidden
      >
        <Mascot mood="happy" />
      </span>
      <div>
        <p className="text-[1rem] text-muted" role="status">
          Taking a moment. One to read while you wait:
        </p>
        <figure key={index} className="mt-[0.3rem] animate-quote-in motion-reduce:animate-none">
          <blockquote className="font-letter text-[1rem] leading-[1.3] font-bold tracking-[0.02em] text-balance uppercase">
            {quote.text}
          </blockquote>
          <figcaption className="mt-[0.3rem] font-mono text-[0.72rem] text-ink-soft">
            {quote.who}, <cite className="text-accent not-italic">{quote.series}</cite>
          </figcaption>
        </figure>
      </div>
    </div>,
    document.body,
  );
}
