// Which volume the page's stars are about, how it's asking, and the rating
// they give it. The page asks one of two ways (RateVolume.tsx): out loud,
// in a banner, about a volume they've just finished; otherwise quietly,
// with small stars beside the series' rating.
//
// The stars are about the last volume they've read. The quiet stars show
// only while there's something to say: that volume isn't rated yet (or was
// rated on this visit, so "Add a few words" stays in reach), and they
// haven't closed them for it. Closing is remembered in this browser, per
// series, until they've read on to a later volume.
import { useState } from "react";
import { readLocal, writeLocal } from "../../lib/prefs";
import {
  closeFinishedVolume,
  deleteShelfReview,
  saveShelfReview,
  type ShelfReviews,
  type ShelfVolume,
} from "../../lib/reviews";

export type VolumeRating = {
  // the volume the stars are about; null when there's none of theirs
  asked: ShelfVolume | null;
  // asked out loud, in the banner: it's the volume they've just finished
  inBanner: boolean;
  // its stars: 0 until they've rated it
  rating: number;
  // they've written words for it too
  hasWords: boolean;
  // the quiet stars beside the series' rating are shown: not rated before
  // this visit, and not closed for this volume
  showTicket: boolean;
  // their cross: hidden until they've read on to a later volume
  hideTicket: () => void;
  // why the last rating didn't save, or ""
  problem: string;
  rate: (stars: number) => Promise<void>;
  // the banner's cross: this volume isn't asked about out loud again
  closeBanner: () => Promise<void>;
};

export function useRateVolume(
  // the series and their place in it (what they own, how far they've
  // read): a volume they moved to or rated is held only while this is the
  // same, so reading on, going back or opening another series lets go of it
  place: string,
  mangaId: number,
  // the last volume they've read, what they've written, and the volume
  // they've just finished, if any
  { latest, written, justFinished }: ShelfReviews,
  // something was saved: the page asks for the lists again
  reload: () => Promise<void>,
): VolumeRating {
  // The volume they just rated: it stays in place for the visit. Without this a rating given in the banner
  // would close it the moment it saved, and "Add a few words" would be
  // gone before they could reach it
  const [held, setHeld] = useState<{
    place: string;
    volume: ShelfVolume;
    // the stars they tapped (0: taken away), shown at once while it
    // saves; null when the saved rating is the one to show
    stars: number | null;
    // it was rated in the banner, which stays up for the rest of the visit
    inBanner: boolean;
  } | null>(null);
  // why the last rating didn't save, held the same way
  const [failed, setFailed] = useState<{
    place: string;
    problem: string;
  } | null>(null);

  // Their place changed: let go for good, so coming back to the same
  // place later doesn't bring an old banner back with it. (Setting state
  // while rendering is React's way to reset state when an input changes.)
  if (held && held.place !== place) setHeld(null);
  const mine = held?.place === place ? held : null;
  const asked = mine?.volume ?? latest;
  const inBanner = mine ? mine.inBanner : justFinished !== null;
  const saved = written.find((one) => one.volume === asked?.volume);
  // the volume they closed the quiet stars for, in this browser
  const hiddenKey = `rateHidden:${mangaId}`;
  const [hiddenFor, setHiddenFor] = useState(
    () => Number(readLocal(hiddenKey)) || 0,
  );
  const ratedBefore = Boolean(saved?.review.rating) && !mine;
  const showTicket =
    Boolean(asked) && !ratedBefore && (asked?.volume ?? 0) > hiddenFor;

  const rate = async (stars: number) => {
    if (!asked) return;
    // A second tap on the same star takes the rating away, as it does for
    // the series. Not when they've written words too: those would go with
    // it, so the review box is where a written review is deleted
    if (!stars && saved?.review.text) return;
    setHeld({ place, volume: asked, stars, inBanner });
    setFailed(null);
    const problem = stars
      ? await saveStars(stars)
      : (await deleteShelfReview(mangaId, asked.volume))
        ? ""
        : "That didn't save. Try again.";
    if (problem) {
      setHeld(null);
      setFailed({ place, problem });
      return;
    }
    await reload();
    // the lists are fresh: what's saved is what shows from here
    setHeld({ place, volume: asked, stars: null, inBanner });
  };
  // the problem, or "" when the stars were kept
  const saveStars = async (stars: number) => {
    if (!asked) return "";
    const result = await saveShelfReview(mangaId, asked.volume, {
      rating: stars,
      // their words, if they've written some, are kept
      text: saved?.review.text ?? "",
      spoiler: saved?.review.spoiler ?? false,
    });
    return "problem" in result ? result.problem : "";
  };

  return {
    asked,
    inBanner,
    rating: mine?.stars ?? saved?.review.rating ?? 0,
    hasWords: Boolean(saved?.review.text),
    showTicket,
    hideTicket: () => {
      if (!asked) return;
      writeLocal(hiddenKey, String(asked.volume));
      setHiddenFor(asked.volume);
    },
    problem: failed?.place === place ? failed.problem : "",
    rate,
    closeBanner: async () => {
      setHeld(null);
      await closeFinishedVolume(mangaId);
      await reload();
    },
  };
}
