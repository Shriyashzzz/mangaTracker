// Cloudflare Turnstile: a live price check spends paid searches, so it only
// runs for a page that passed Turnstile's invisible "are you a person" check.
// The page sends its token as ?human=; anyone without a good one (a bot, a
// script, a crawler) gets the stored prices, as crawlers always have. Needs
// TURNSTILE_SECRET_KEY; without it every visitor counts, as before.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
import config from "../config/config.js";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function isHuman(token: unknown, ip?: string): Promise<boolean> {
  const secret = config.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Turnstile responded ${res.status}`);
    const { success } = (await res.json()) as { success?: boolean };
    return success === true;
  } catch (e) {
    // Cloudflare out of reach (Railway's addresses get blocked at times): a
    // person isn't kept from fresh prices for it, and a bot can't cause it
    console.error("Turnstile check failed:", (e as Error).message);
    return true;
  }
}
