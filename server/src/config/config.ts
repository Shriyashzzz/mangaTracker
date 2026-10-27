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
  EBAY_CLIENT_ID: optional,
  EBAY_CLIENT_SECRET: optional,
  WALMART_CONSUMER_ID: optional,
  WALMART_KEY_VERSION: optional,
  WALMART_PRIVATE_KEY: optional,
  KEEPA_API_KEY: optional,
  GOOGLE_BOOKS_API_KEY: optional,

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

export type Config = z.infer<typeof schema>;
const config: Config = parsed.data;
export const isProd = config.ENV === "PROD";
export default config;
