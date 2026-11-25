// Where Cloudflare's "are you human?" box goes on a prices page, in the page
// rather than floating over it (lib/turnstile.ts). Empty and taking no room,
// not even a gap, for almost everyone; when Cloudflare asks, one line says
// what the tap is for, with the box under it
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  humanCheckAsking,
  onHumanCheckAsking,
  setHumanCheckSlot,
} from "../../lib/turnstile";

export default function HumanCheck() {
  const place = useRef<HTMLDivElement>(null);
  const asking = useSyncExternalStore(onHumanCheckAsking, humanCheckAsking);
  useEffect(() => {
    const el = place.current;
    setHumanCheckSlot(el);
    return () => setHumanCheckSlot(null);
  }, []);
  return (
    // out of the page's flow until it asks, so a column's gap doesn't count
    // an empty place
    <div className={asking ? "flex flex-col items-start gap-2" : "absolute"}>
      {asking ? (
        <p className="font-medium text-[0.95rem] text-ink" role="status">
          Tap to get today's prices
        </p>
      ) : null}
      <div ref={place} />
    </div>
  );
}
