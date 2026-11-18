// Which tables a country's prices live in. US prices are in price_samples
// and price_source_checks; Canadian ones in their own pair, ca_price_samples
// and ca_price_source_checks, kept apart so nothing about US prices can be
// touched by them. Both pairs have the same columns, so every price read
// works on either: it takes the country and asks for its tables here.
// Part of the price queries (priceQueries.ts lists the parts).
import { Prisma } from "../../generated/prisma/client.js";

export type Country = "us" | "ca";

// table names can't be query parameters, so they're written in from this
// fixed pair only, never from anything a request sent
const TABLES = {
  us: {
    samples: Prisma.raw(`"price_samples"`),
    checks: Prisma.raw(`"price_source_checks"`),
  },
  ca: {
    samples: Prisma.raw(`"ca_price_samples"`),
    checks: Prisma.raw(`"ca_price_source_checks"`),
  },
} as const;

export const tablesOf = (country: Country) => TABLES[country];

// what a request asked for: Canada only when it says so
export const countryOf = (asked: unknown): Country =>
  asked === "ca" ? "ca" : "us";
