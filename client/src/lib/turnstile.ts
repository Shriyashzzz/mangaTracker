// Cloudflare Turnstile: a live price check spends paid searches, so the page
// first gets a token proving a person is here, and the server checks it
// (server/src/prices/human.ts). Invisible for almost everyone; it only shows
// a box when Cloudflare wants to ask: in the page's own place for it
// (components/humanCheck), under "Tap to get today's prices", or in the corner
// on a page without one. Without a site key, or if it can't load, there's no
// token and the page gets the stored prices.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
// waited for at most this long; then the stored prices it is
const WAIT_MS = 15_000;

type Turnstile = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      appearance?: "always" | "execute" | "interaction-only";
      callback: (token: string) => void;
      "before-interactive-callback"?: () => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    },
  ) => string;
  remove: (id: string) => void;
};

// the page's place for the box (HumanCheck), while it's on screen
let slot: HTMLElement | null = null;
// checks waiting for that place to appear (whenSlot)
let waitingForSlot: (() => void)[] = [];
export const setHumanCheckSlot = (el: HTMLElement | null) => {
  slot = el;
  if (!el) return;
  const waiting = waitingForSlot;
  waitingForSlot = [];
  waiting.forEach((go) => go());
};

// A check started before its page is drawn (a volume page starts it with
// the stored prices: useVolumeLoad) waits for the page's place, so a box
// Cloudflare wants tapped shows under its words, not in a corner. Gives up
// after a while (the box then goes in the corner) or when called off
const SLOT_WAIT_MS = 10_000;
const whenSlot = (signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (slot || signal?.aborted) return resolve();
    const go = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(go, SLOT_WAIT_MS);
    waitingForSlot.push(go);
    signal?.addEventListener("abort", go, { once: true });
  });

// whether Cloudflare is asking right now: HumanCheck shows its words then
let asking = false;
const listeners = new Set<() => void>();
const setAsking = (now: boolean) => {
  if (asking === now) return;
  asking = now;
  listeners.forEach((listen) => listen());
};
export const humanCheckAsking = () => asking;
export const onHumanCheckAsking = (listen: () => void) => {
  listeners.add(listen);
  return () => {
    listeners.delete(listen);
  };
};

let loading: Promise<Turnstile | null> | null = null;
const load = () =>
  (loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () =>
      resolve(
        (window as unknown as { turnstile?: Turnstile }).turnstile ?? null,
      );
    script.onerror = () => {
      loading = null;
      resolve(null);
    };
    document.head.append(script);
  }));

// a fresh token, one per live check (each can be used once), or null.
// `signal`: the page was left, so stop waiting and take the widget away
// `inItsPlace`: started before its page is drawn, so it waits for the page's
// place for the box (whenSlot); Cloudflare's script loads meanwhile
async function humanToken(
  signal?: AbortSignal,
  inItsPlace = false,
): Promise<string | null> {
  if (!SITE_KEY || signal?.aborted) return null;
  const turnstile = await load();
  if (inItsPlace) await whenSlot(signal);
  if (!turnstile || signal?.aborted) return null;
  return new Promise((resolve) => {
    const box = document.createElement("div");
    if (slot) slot.append(box);
    else {
      box.style.cssText = "position:fixed;right:12px;bottom:84px;z-index:60";
      document.body.append(box);
    }
    let id = "";
    let done = false;
    const finish = (token: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      setAsking(false);
      resolve(token);
      // after its own callback has returned
      setTimeout(() => {
        try {
          if (id) turnstile.remove(id);
        } catch {
          /* already gone */
        }
        box.remove();
      });
    };
    const timer = setTimeout(() => finish(null), WAIT_MS);
    signal?.addEventListener("abort", () => finish(null), { once: true });
    id = turnstile.render(box, {
      sitekey: SITE_KEY,
      appearance: "interaction-only",
      callback: (token) => finish(token),
      "before-interactive-callback": () => setAsking(true),
      "error-callback": () => finish(null),
      "expired-callback": () => finish(null),
    });
  });
}

// "?human=<token>" for a live price request, or "" when there's none
export const humanQuery = async (
  joiner: "?" | "&" = "?",
  signal?: AbortSignal,
  inItsPlace = false,
) => {
  const token = await humanToken(signal, inItsPlace);
  return token ? `${joiner}human=${encodeURIComponent(token)}` : "";
};
