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
  KEEPA_API_KEY: optional,
  GOOGLE_BOOKS_API_KEY: optional,
  // Cloudflare Turnstile's secret: live price checks only for people
  TURNSTILE_SECRET_KEY: optional,

  // Open Library allows 3 requests a second instead of 1 with a contact email
  EMAIL_FOR_OPEN_LIB: optional,

  // affiliate programs
  AMAZON_ASSOCIATE_TAG: optional,
  BOOKSHOP_AFFILIATE_ID: optional,
  EBAY_CAMPAIGN_ID: optional,
  WALMART_AFFILIATE: optional,
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
