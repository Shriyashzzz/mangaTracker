// What's newly out for a series on the shelf (the New tab and the details
// page), and the shelf's cheapest known prices.
import {
  mangaOutcome,
  type ReleaseOutcome,
} from "../../util/releases/releaseOutcome.js";
import type { Request, Response } from "express";
import mangaQueries from "../../models/mangaQueries.js";
import { getSeriesInfo } from "../../prices/sources/anilist.js";
import { getSeries, getShelfPrices } from "../../prices/service.js";
import { novelName, priceName } from "../../prices/lightNovel.js";
import {
  getCachedReleaseDates,
  withTimeout,
} from "../../util/releases/releaseCache.js";
import {
  chapterToSave,
  getReleaseStatus,
  readReleaseSettings,
} from "../../util/releases/releaseStatus.js";
import userQueries from "../../models/userQueries.js";
import type { Manga } from "../../../generated/prisma/client.js";

const SERIES_TIMEOUT_MS = 25_000;

const INFO_TIMEOUT_MS = 10_000;

// a series that can't have news: AniList says it has finished, and they own
// as many volumes as it has (its count is Japan's, so every English one too).
// Finished reading isn't enough on its own: that's them, not the series
export const nothingLeftToCheck = (
  manga: Pick<Manga, "volumesOwned"> & { ownedList?: number[] },
  info: { status?: string | null; volumes?: number | null } | null,
) =>
  info?.status === "FINISHED" &&
  Boolean(info.volumes) &&
  // with gaps, as many as it has, not just one numbered as high
  (manga.ownedList?.length
    ? manga.ownedList.filter(Number.isInteger).length
    : (manga.volumesOwned ?? 0)) >= info.volumes!;

// release dates and what's new in English for one manga. Its own route because
// it can be slow, so the details page and the edit form don't wait for it.
// The shelf says which lane (?lane=now or later) and skips what has nothing
// left to check; the details page always asks, in "now"
export const releases = async (req: Request, res: Response) => {
  const manga: Manga = res.locals.manga;
  const lane = req.query.lane === "later" ? "later" : "now";
  const fromShelf = req.query.lane === "now" || req.query.lane === "later";
  // a problem here just means the default list
  const prefs = await userQueries
    .getPrefs(req.session.userId!)
    .catch(() => null);
  // no news to give, and why: only "failed" is worth asking again, and only
  // it means the sites didn't answer (the shelf says so if every check failed)
  const nothing = (outcome: Exclude<ReleaseOutcome, "news">) =>
    res.json({
      releaseData: null,
      releaseStatus: null,
      complete: outcome !== "failed",
      outcome,
    });
  // switched off in settings: no other site gets asked about this manga
  if (prefs?.releaseChecks === "off") return nothing("off");
  // a light novel's news is its English volumes alone: MangaDex, where the
  // chapters and Japanese volumes come from, only has the manga
  if (manga.lightNovel) {
    // side by side: a novel's check is only its catalog list, so waiting on
    // AniList first would only make it slower
    const [novelInfo, series] = await Promise.all([
      fromShelf
        ? withTimeout(
            getSeriesInfo(novelName(manga.name)).catch(() => null),
            INFO_TIMEOUT_MS,
            null,
          )
        : null,
      // not found is an answer; failing or being slow is worth asking again
      withTimeout(
        getSeries(novelName(manga.name)).catch(() => undefined),
        SERIES_TIMEOUT_MS,
        undefined,
      ),
    ]);
    if (fromShelf && nothingLeftToCheck(manga, novelInfo)) {
      return nothing("skipped");
    }
    if (!series) return nothing(series === null ? "notFound" : "failed");
    return res.json({
      releaseData: null,
      releaseStatus: getReleaseStatus(
        manga,
        { dates: null, englishVolumes: series.volumes },
        readReleaseSettings(prefs?.releases),
      ),
      complete: true,
      outcome: "news",
    });
  }
  // the catalog right away for the details page, which never skips; the shelf
  // waits on AniList first, as a finished series it owns needs neither
  // null: the catalog doesn't have it; undefined: it failed or was slow
  const startSeries = () =>
    withTimeout(
      getSeries(manga.name).catch(() => undefined),
      SERIES_TIMEOUT_MS,
      undefined,
    );
  const seriesEarly = fromShelf ? undefined : startSeries();
  // AniList: it confirms which series this is on MangaDex, says whether it has
  // finished, and is usually answered from the database
  const info = await withTimeout(
    getSeriesInfo(manga.name).catch(() => null),
    INFO_TIMEOUT_MS,
    null,
  );
  if (fromShelf && nothingLeftToCheck(manga, info)) return nothing("skipped");
  // a catalog failure or a slow one only costs the volume half of the answer;
  // if it's slow it carries on and is ready for the next check
  const [series, dates] = await Promise.all([
    seriesEarly ?? startSeries(),
    getCachedReleaseDates(
      manga.name,
      { anilistId: info?.anilistId, altNames: info?.altNames },
      lane,
    ),
  ]);
  const releaseData = dates.ok && dates.data ? dates.data : null;
  const { outcome, complete } = mangaOutcome(
    { ok: dates.ok, hasData: Boolean(releaseData) },
    series,
  );
  if (outcome !== "news") return nothing(outcome);
  const releaseStatus = getReleaseStatus(
    manga,
    { dates: releaseData, englishVolumes: series?.volumes ?? null },
    readReleaseSettings(prefs?.releases),
  );
  // kept on the manga, so progress can show straight away next time. Failing to
  // save it shouldn't cost them the answer
  const newLatest = chapterToSave(
    releaseStatus.latestChapter,
    manga.latestChapter,
  );
  if (newLatest != null) {
    await mangaQueries
      .setLatestChapter(manga.id, newLatest)
      .catch((e) => console.error("Couldn't save the latest chapter:", e));
  }
  return res.json({
    releaseData,
    releaseStatus,
    // a source didn't answer, so it's worth asking again later
    complete,
    outcome,
  });
};

// the cheapest known price for each manga on the shelf, for the cards. A light
// novel is priced as the novel, never as the manga of the same name
export const shelfPrices = async (req: Request, res: Response) => {
  const manga = await mangaQueries.getShelf(req.session.userId!);
  res.json(
    await getShelfPrices(manga.map((m) => ({ id: m.id, name: priceName(m) }))),
  );
};
