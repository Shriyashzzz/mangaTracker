// One series on the shelf, as the list draws it: its card, and on the New tab
// a Hide (or Unhide) button beside it.
import MangaCard from "../../components/mangaCard/MangaCard";
import type { Manga, ReleaseStatus } from "../../lib/types";
import { useNextFor } from "../../lib/prefs";
import { withGapFirst } from "../../lib/releaseMath";
import { buyLinkFor, detailsSearchFor } from "./newTabLinks";
import { newsFor, opensAList, type ReleaseKind } from "./shelfViews";
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
  // a long press in the app: Select, with this one picked
  onLongPress?: () => void;
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
  onLongPress,
  onHide,
}: Props) {
  // more than one volume out past theirs: the card opens their list
  const opensList =
    showingNew && !viewingHidden && opensAList(found, releaseKind);

  let wrapperClass: string = styles.cardWithSeen;
  if (rows) wrapperClass = styles.cardRowAlways;
  else if (showingNew) wrapperClass = styles.cardAsRow;

  const hideLabel = viewingHidden ? "Unhide" : "Hide";
  // what the card says is next: their first gap, for a reader who chose that
  const shown = withGapFirst(found, useNextFor());

  return (
    <div className={wrapperClass}>
      <MangaCard
        currentManga={manga}
        news={showingNew ? newsFor(manga, shown, releaseKind) : undefined}
        linkTo={showingNew ? buyLinkFor(shown, releaseKind) : undefined}
        onOpen={opensList ? onOpenReleases : undefined}
        japanFirst={showingNew && releaseKind === "japan"}
        detailsSearch={showingNew ? detailsSearchFor(releaseKind) : undefined}
        index={index}
        compact={rows}
        latestChapter={found?.latestChapter ?? manga.latestChapter}
        latestVolume={found?.latestVolume}
        select={select}
        onLongPress={onLongPress}
      />
      {showingNew && (
        <button
          type="button"
          className={rows ? styles.seenBtnRow : styles.seenBtn}
          aria-label={`${hideLabel}: ${manga.name}`}
          data-seen-id={manga.id}
          onClick={onHide}
        >
          {hideLabel}
        </button>
      )}
    </div>
  );
}
