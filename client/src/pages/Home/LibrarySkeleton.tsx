import { MangaCardSkeleton } from "../../components/mangaCard/MangaCard";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { shelfViewNow } from "../../lib/prefs";
import { homeStyles as styles } from "./styles";

// a shelf row while it loads: the cover, three lines, and where they are on
// the right, in the real row's grid (MangaCard's compact row)
function RowSkeleton() {
  return (
    <div className={styles.cardRowAlways}>
      <div className="grid w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 py-1.5">
        <div className="skeleton aspect-2/3 w-11" />
        <div className="flex flex-col gap-2">
          <div className="skeleton h-4 w-3/5" />
          <div className="skeleton h-3 w-2/5" />
          <div className="skeleton h-3 w-1/4" />
        </div>
        <div className="flex w-[7.5rem] flex-col items-end gap-2 pr-2">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-2 w-full" />
        </div>
      </div>
    </div>
  );
}

// The shelf while it loads, drawn as it will be: its title, its bar and
// pages, then rows or covers as they've chosen (prefs shelfViewNow), so
// nothing jumps when it arrives. A quote shows for a slow load
export default function LibrarySkeleton() {
  const rows = shelfViewNow() === "rows";
  return (
    <div aria-busy="true" aria-label="Loading your shelf">
      <SlowLoadQuote />
      {/* the page's title; a phone's shelf has none to see */}
      <div className={`skeleton ${styles.skeletonTitle} upto-720:hidden`} />
      <div className={styles.skeletonBar}>
        <div className="skeleton h-8 w-24" />
        <div className="flex gap-4">
          <div className="skeleton size-7" />
          <div className="skeleton size-7" />
          <div className="skeleton h-7 w-14" />
        </div>
      </div>
      <div className={styles.skeletonPager}>
        <div className="skeleton h-10 w-12" />
        <div className="skeleton h-10 w-16" />
        <div className="skeleton h-10 w-16" />
        <div className="skeleton h-10 w-12" />
      </div>
      {rows ? (
        <div className={styles.rowsGrid}>
          {Array.from({ length: 8 }, (_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className={styles.classContainer}>
          {Array.from({ length: 10 }, (_, i) => (
            <MangaCardSkeleton key={i} />
          ))}
        </div>
      )}
    </div>
  );
}
