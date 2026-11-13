// One series on the shelf, as the list draws it: its card, and on the New tab
// a Hide (or Unhide) button beside it.
import { CheckIcon } from "../../components/icons/Icons";
import MangaCard from "../../components/mangaCard/MangaCard";
import type { Manga, ReleaseStatus } from "../../lib/types";
import { buyLinkFor, detailsSearchFor } from "./newTabLinks";
import { isGrouped, newsFor, type ReleaseKind } from "./shelfViews";
import { homeStyles as styles } from "./styles";

type Props = {
  manga: Manga;
  // its place on the page, for the entrance animation
  index: number;
  // what the release check found for it, when it has been checked
  found: ReleaseStatus | null | undefined;
  // compact rows, not covers
  rows: boolean;
  // on the New tab, and which kind of release it's showing
  showingNew: boolean;
  releaseKind: ReleaseKind;
  // on the New tab's list of hidden ones
  viewingHidden: boolean;
  // while Select is on: whether it's picked, and the tap that picks it
  select?: { checked: boolean; onToggle: () => void };
  // opens the list of everything out for a series with several at once
  onOpenReleases: () => void;
  onHide: () => void;
};

export default function ShelfCard({
  manga,
  index,
  found,
  rows,
  showingNew,
  releaseKind,
  viewingHidden,
  select,
  onOpenReleases,
  onHide,
}: Props) {
  // several releases out at once: the card opens their list, and Hide hides
  // them all
  const grouped = isGrouped(found, releaseKind);
  const opensList = showingNew && !viewingHidden && grouped;

  let wrapperClass: string = styles.cardWithSeen;
  if (rows) wrapperClass = styles.cardRowAlways;
  else if (showingNew) wrapperClass = styles.cardAsRow;

  let hideLabel = "Hide";
  if (viewingHidden) hideLabel = "Unhide";
  else if (grouped) hideLabel = "Hide all";

  return (
    <div className={wrapperClass}>
      <MangaCard
        currentManga={manga}
        news={
          showingNew
            ? newsFor(manga, found, releaseKind, viewingHidden)
            : undefined
        }
        linkTo={showingNew ? buyLinkFor(found, releaseKind) : undefined}
        onOpen={opensList ? onOpenReleases : undefined}
        detailsSearch={showingNew ? detailsSearchFor(releaseKind) : undefined}
        index={index}
        compact={rows}
        latestChapter={found?.latestChapter ?? manga.latestChapter}
        latestVolume={found?.latestVolume}
        select={select}
      />
      {showingNew && (
        <button
          type="button"
          className={rows ? styles.seenBtnRow : styles.seenBtn}
          aria-label={`${hideLabel}: ${manga.name}`}
          data-seen-id={manga.id}
          onClick={onHide}
        >
          {!viewingHidden && <CheckIcon />}
          {hideLabel}
        </button>
      )}
    </div>
  );
}
