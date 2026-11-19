// A page opened offline that can't work without a connection (prices, To
// buy, adding and importing, someone's shared shelf...): one calm message
// and the way back to the shelf, which works offline. A page that opened
// online stays as it is if the connection drops (OnlineOnly).
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import Mascot from "../mascot/Mascot";
import { useOffline } from "../../lib/offline";

// keyed by the page's address (App.tsx), so each page decides on arrival
export function OnlineOnly({ children }: { children: ReactNode }) {
  // no connection as the browser knows it (a kept copy on screen with a
  // weak signal still lets the page try)
  const offline = useOffline((s) => !s.online);
  const [blocked, setBlocked] = useState(offline);
  // back online: the page itself, from then on
  if (blocked && !offline) setBlocked(false);
  return blocked ? <NeedsConnection /> : children;
}

function NeedsConnection() {
  return (
    <section className="px-gutter flex min-h-[60dvh] flex-col items-center justify-center gap-4 py-8 text-center">
      <span className="printed mascot-spot" aria-hidden>
        <Mascot mood="confused" />
      </span>
      <h1 className="font-brand text-[clamp(1.8rem,4vw,2.4rem)] tracking-[0.04em]">
        This page needs a connection
      </h1>
      <p className="mb-2 max-w-sm text-ink-soft">
        Your shelf works offline. This opens when you're back.
      </p>
      <Link className="btn btn-primary" to="/shelf" viewTransition>
        Back to your shelf
      </Link>
    </section>
  );
}
