// Cloudflare Turnstile: a live price check spends paid searches, so the page
// first gets a token proving a person is here, and the server checks it
// (server/src/prices/human.ts). Invisible for almost everyone; it only shows
// a box, in the corner, when Cloudflare wants to ask. Without a site key, or
// if it can't load, there's no token and the page gets the stored prices.
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
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    },
  ) => string;
  remove: (id: string) => void;
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
export async function humanToken(signal?: AbortSignal): Promise<string | null> {
  if (!SITE_KEY || signal?.aborted) return null;
  const turnstile = await load();
  if (!turnstile || signal?.aborted) return null;
  return new Promise((resolve) => {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;right:12px;bottom:84px;z-index:60";
    document.body.append(box);
    let id = "";
    let done = false;
    const finish = (token: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
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
      "error-callback": () => finish(null),
      "expired-callback": () => finish(null),
    });
  });
}

// "?human=<token>" for a live price request, or "" when there's none
export const humanQuery = async (
  joiner: "?" | "&" = "?",
  signal?: AbortSignal,
) => {
  const token = await humanToken(signal);
  return token ? `${joiner}human=${encodeURIComponent(token)}` : "";
};
