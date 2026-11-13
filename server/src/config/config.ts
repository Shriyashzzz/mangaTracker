import dotenv from "dotenv";
import { z } from "zod";

// server/.env in development. Tests (Jest sets NODE_ENV=test) never read it,
// so real keys and affiliate IDs can't leak into them
if (process.env.NODE_ENV !== "test") dotenv.config({ quiet: true });

// every setting the server reads, checked once at startup. Optional keys
// switch features on (price providers, affiliate links) when present
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;
const optional = z.preprocess(blankToUndefined, z.string().trim().optional());

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  ENV: z.preprocess(blankToUndefined, z.enum(["DEV", "PROD"]).default("DEV")),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is missing"),
  SECRET: z.string().min(1, "SECRET (the session secret) is missing"),
  CLIENT_URL: optional,
  // the cookie domain in production, so the site and API share the session
  COOKIE_DOMAIN: z.preprocess(
    blankToUndefined,
    z.string().default(".mangatracker.xyz"),
  ),

  // price providers
  SERPAPI_API_KEY: optional,
  SERPAPI_MONTHLY_LIMIT: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive().default(250),
  ),
  // Canadian prices: their own switch ("off" turns them off) and their own
  // monthly cap. They use the same SerpApi keys, so each Canadian search also
  // counts against the US allowance: the cap limits how much of it they take.
  // Keep it well under SERPAPI_MONTHLY_LIMIT
  CANADA_PRICES: z.preprocess(
    blankToUndefined,
    z.enum(["on", "off"]).default("on"),
  ),
  // Amazon.ca's Associates tag, separate from the US one
  CANADA_AMAZON_AFFILIATE: optional,
  CANADA_SEARCH_LIMIT: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().nonnegative().default(100),
  ),
  // the shelf tools (shelf value, finishing series, the release calendar)
  // and the deals strip: "off" hides them all (server/src/collector)
  COLLECTOR_TOOLS: z.preprocess(
    blankToUndefined,
    z.enum(["on", "off"]).default("on"),
  ),
  // background pricing of shelf volumes from eBay's free API
  // (collector/filler.ts): on in production unless "off"; "on" runs it
  // anywhere (a laptop shares the eBay keys, so it's off there by default).
  // PRICE_FILL_DAILY: volumes a day, about 3 eBay calls each
  PRICE_FILL: z.preprocess(blankToUndefined, z.enum(["on", "off"]).optional()),
  PRICE_FILL_DAILY: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().nonnegative().default(160),
  ),
  EBAY_CLIENT_ID: optional,
  EBAY_CLIENT_SECRET: optional,
  // calls a day to eBay's Browse API (eBay allows about 5,000); kept under it
  EBAY_DAILY_LIMIT: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().nonnegative().default(4500),
  ),
  WALMART_CONSUMER_ID: optional,
  WALMART_KEY_VERSION: optional,
  WALMART_PRIVATE_KEY: optional,
  // CJ (Commission Junction): Books-A-Million's catalog prices, searched by
  // ISBN. The token from developers.cj.com, our CJ company ID, Books-A-
  // Million's advertiser ID and our website ID (PID, for affiliate links)
  CJ_API_TOKEN: optional,
  CJ_COMPANY_ID: optional,
  CJ_BAM_ID: optional,
  CJ_WEBSITE_ID: optional,
  // calls a day to CJ's product search; kept well under what CJ allows
  CJ_DAILY_LIMIT: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().nonnegative().default(2000),
  ),
  // Books-A-Million's own background share of that (collector/
  // newPriceFiller.ts): volumes a day, one lookup each
  BAM_FILL_DAILY: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().nonnegative().default(400),
  ),
  KEEPA_API_KEY: optional,
  GOOGLE_BOOKS_API_KEY: optional,
  // Cloudflare Turnstile's secret: live price checks only for people
  TURNSTILE_SECRET_KEY: optional,

  // Open Library allows 3 requests a second instead of 1 with a contact email
  EMAIL_FOR_OPEN_LIB: optional,

  // the one account that may review readers' corrections (after the anime)
  ADMIN_USERNAME: optional,

  // affiliate programs
  AMAZON_ASSOCIATE_TAG: optional,
  BOOKSHOP_AFFILIATE_ID: optional,
  EBAY_CAMPAIGN_ID: optional,
  WALMART_AFFILIATE: optional,
  // our impact.com tracking link for Better World Books, in full:
  // https://betterworldbooks.pxf.io/c/<account>/<ad>/<campaign>
  BETTER_WORLD_BOOKS_LINK: optional,
  // impact.com's partner API, for Better World Books' prices: the account's
  // SID and an access token with the Catalogs scope
  IMPACT_ACCOUNT_SID: optional,
  IMPACT_AUTH_TOKEN: optional,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Server settings are missing or wrong:\n${problems}`);
}

type Config = z.infer<typeof schema>;
const config: Config = parsed.data;
export const isProd = config.ENV === "PROD";
export default config;
