// Cloudflare Turnstile: a live price check spends paid searches, so it only
// runs for a page that passed Turnstile's invisible "are you a person" check.
// The page sends its token as ?human=; anyone without a good one (a bot, a
// script, a crawler) gets the stored prices, as crawlers always have. Needs
// TURNSTILE_SECRET_KEY; without it every visitor counts, as before. Paid
// searches need a clear "yes" (humanCheck, spender.ts mayPay).
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
import config from "../config/config.js";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// What Turnstile says of a visit's token: "yes" a person, "no" not (or no
// token), "unsure" when Cloudflare couldn't be reached. Unsure still gets a
// live check of the free stores (a person isn't kept from fresh prices for
// Railway's address being blocked at times), but no paid search: a bot can't
// cause an outage, yet one shouldn't be a way past the check either
export type Human = "yes" | "no" | "unsure";
export async function humanCheck(token: unknown, ip?: string): Promise<Human> {
  const secret = config.TURNSTILE_SECRET_KEY;
  if (!secret) return "yes";
  if (typeof token !== "string" || !token || token.length > 2048) return "no";
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
    return success === true ? "yes" : "no";
  } catch (e) {
    console.error("Turnstile check failed:", (e as Error).message);
    return "unsure";
  }
}

// a free search's check: anything but a clear "no"
export const isHuman = async (token: unknown, ip?: string) =>
  (await humanCheck(token, ip)) !== "no";
