// What a volume's page says about the book itself ("About this volume"):
// its English release date, page count, the publisher's description, and
// its list price. A trusted source's word first (a collector's list:
// trustedBooks.ts), the catalog's (Google Books: models/volumeDetails.ts)
// for what it doesn't say. The list price is the trusted source's alone.
//
// Google's details mostly come free, kept from the series searches the site
// makes anyway. The rest are filled slowly, a few lookups a day
// (DAILY_LOOKUPS, counted in api_usage like the other allowances), the
// pages people opened first. A book asked about is never asked again
import config from "../config/config.js";
import { claimApiCall } from "../models/apiAllowance.js";
import {
  saveVolumeDetails,
  volumeDetailsOf,
  volumesWithoutDetails,
} from "../models/volumeDetails.js";
import { fillSwitchOn, startEvery } from "../collector/fillShared.js";
import { googleDetailsOf } from "./sources/googleBooksCatalog.js";
import { trustedAbout } from "./trustedBooks.js";
import { notOutYet } from "./preorder.js";

export type VolumeAbout = {
  published: string | null;
  pages: number | null;
  description: string | null;
  listCents: number | null;
};

// one book's "About this volume", or null when nothing is known
export async function volumeAbout(isbn13: string): Promise<VolumeAbout | null> {
  const [trusted, catalog] = await Promise.all([
    trustedAbout(isbn13).catch(() => null),
    volumeDetailsOf(isbn13).catch(() => null),
  ]);
  const published = trusted?.published ?? catalog?.published ?? null;
  const about = {
    // "Out in English" only once it is: a preorder has its own line
    published: published && !notOutYet(published) ? published : null,
    pages: trusted?.pages ?? catalog?.pages ?? null,
    description: trusted?.description ?? catalog?.description ?? null,
    listCents: trusted?.listCents ?? null,
  };
  return Object.values(about).some((v) => v != null) ? about : null;
}

// ---------- the slow fill ----------

// lookups a day, of Google's 1,000 free ones: series lists, covers and
// ebook prices keep the rest
export const DAILY_LOOKUPS = 100;
// a few at a time, every quarter hour, so a day's run is spread out
const PER_RUN = 5;
const EVERY_MS = 15 * 60 * 1000;
const budgetLabel = () =>
  `gbooks-details:${new Date().toISOString().slice(0, 10)}`;

// Asks Google about a few books with no details yet. Stops at the day's
// allowance, or when Google can't be asked (a book it couldn't answer for
// is tried again another day); returns how many were asked
export async function fillDetails(howMany = PER_RUN) {
  if (!config.GOOGLE_BOOKS_API_KEY) return 0;
  let asked = 0;
  for (const isbn13 of await volumesWithoutDetails(howMany)) {
    if (!(await claimApiCall(budgetLabel(), DAILY_LOOKUPS))) break;
    const details = await googleDetailsOf(isbn13).catch(() => null);
    if (!details) break;
    await saveVolumeDetails([details]);
    asked++;
  }
  return asked;
}

// on where the other background fills are (production, or PRICE_FILL=on)
export function startDetailsFill() {
  if (!fillSwitchOn() || !config.GOOGLE_BOOKS_API_KEY) return;
  startEvery("Volume details", () => fillDetails(), {
    everyMs: EVERY_MS,
    firstAfterMs: 5 * 60_000,
  });
  console.log(`Volume details: up to ${DAILY_LOOKUPS} Google lookups a day`);
}
