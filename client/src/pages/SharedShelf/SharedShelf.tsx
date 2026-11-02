// Someone's shelf, opened from the link they shared. Read-only.
import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router";
import Avatar from "../../components/avatar/Avatar";
import Mascot from "../../components/mascot/Mascot";
import StarRating from "../../components/starRating/StarRating";
import { getSharedShelf, type SharedShelf } from "../../lib/account";
import { FALLBACK_COVER } from "../../lib/api";
import { usePageMeta } from "../../lib/seo";
import { settingsStyles } from "../Settings/styles";

const styles = {
  page: "flex flex-col gap-8",
  head: "flex items-center gap-4",
  grid: "grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-9 upto-520:grid-cols-2 upto-520:gap-x-4 upto-520:gap-y-7",
  card: "flex min-w-0 flex-col gap-2",
  cover: "relative aspect-2/3 rounded-[2px] border-[1.5px] border-line bg-paper-2 shadow-ink-lg",
  name: "line-clamp-2 font-display text-[1.05rem] leading-[1.25] font-semibold",
  meta: "truncate font-mono text-[0.78rem] text-muted",
  notes: "text-[0.9rem] leading-[1.4] whitespace-pre-line text-ink-soft",
  stamp: "absolute top-2.5 right-2 rotate-8 rounded-[3px] border-2 border-accent bg-[color-mix(in_srgb,var(--card)_85%,transparent)] px-2 py-[0.15rem] font-brand text-[1rem] leading-[1.2] tracking-[1.5px] text-accent",
  missing: "mx-auto my-12 flex max-w-[440px] flex-col items-center gap-3 text-center",
} as const;

export default function SharedShelfPage() {
  const code = useParams().code!;
  const [state, setState] = useState<{
    code: string;
    shelf: SharedShelf | null;
    failed: boolean;
  } | null>(null);
  const shelf = state?.code === code ? state.shelf : null;
  const finished = state?.code === code;

  usePageMeta({
    title: shelf ? `${shelf.displayName}'s shelf` : "A shared shelf",
    noindex: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    getSharedShelf(code, controller.signal)
      .then((found) => setState({ code, shelf: found, failed: false }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setState({ code, shelf: null, failed: true });
      });
    return () => controller.abort();
  }, [code]);

  if (!finished) {
    return <div className={`skeleton ${styles.page} min-h-96`} aria-busy="true" aria-label="Loading" />;
  }

  if (!shelf) {
    return (
      <div className={`${styles.missing} fade-in`}>
        <span className="printed mascot-spot" aria-hidden>
          <Mascot mood="confused" />
        </span>
        <h1 className={settingsStyles.heading}>This shelf isn't shared</h1>
        <p className={settingsStyles.body}>
          The link might be wrong, or its owner may have made their list private.
        </p>
        <NavLink to="/" className="btn btn-secondary" viewTransition>
          Go to Manga Tracker
        </NavLink>
      </div>
    );
  }

  return (
    <article className={`${styles.page} fade-in`}>
      <header className={styles.head}>
        <Avatar id={shelf.avatar} className={settingsStyles.headArt} />
        <div>
          <h1 className={settingsStyles.title}>{shelf.displayName}</h1>
          <p className={settingsStyles.body}>
            {shelf.manga.length} series on the shelf
          </p>
        </div>
      </header>

      {shelf.manga.length === 0 ? (
        <p className={settingsStyles.body}>Nothing on this shelf yet.</p>
      ) : (
        <ul className={styles.grid}>
          {shelf.manga.map((m, i) => (
            <li key={`${m.name}-${i}`} className={styles.card}>
              <div className={styles.cover}>
                <img
                  src={m.image || FALLBACK_COVER}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                  onError={(e) => {
                    if (e.currentTarget.src !== FALLBACK_COVER) {
                      e.currentTarget.src = FALLBACK_COVER;
                    }
                  }}
                />
                {m.status && <span className={styles.stamp}>Done</span>}
              </div>
              <p className={styles.name}>{m.name}</p>
              <p className={styles.meta}>
                {[
                  m.status ? "finished" : m.bookmark ? `ch. ${m.bookmark}` : null,
                  m.genre && m.genre !== "unlabled" ? m.genre : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {m.rating ? <StarRating value={m.rating} size="sm" /> : null}
              {m.notes && <p className={styles.notes}>{m.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
