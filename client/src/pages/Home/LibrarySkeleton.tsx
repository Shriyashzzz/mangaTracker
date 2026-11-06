import { MangaCardSkeleton } from "../../components/mangaCard/MangaCard";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { homeStyles as styles } from "./styles";

// the shelf while it loads: a quote for a slow load, and empty cards
export default function LibrarySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <SlowLoadQuote />
      <div className={`skeleton ${styles.skeletonTitle}`} />
      <div className={styles.classContainer}>
        {Array.from({ length: 10 }, (_, i) => (
          <MangaCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
