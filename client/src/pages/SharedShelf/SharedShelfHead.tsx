// The top of a shared shelf: the covers its owner has most of, fanned out,
// and the buttons that copy or share the link.
import { useState } from "react";
import CoverCaption, {
  COVER_WITH_CAPTION,
} from "../../components/coverCaption/CoverCaption";
import { CheckIcon, LinkIcon, ShareIcon } from "../../components/icons/Icons";
import { SeriesCover } from "./SeriesSheet";
import { ownedCountOf, type SharedManga } from "./shareParts";
import { shareStyles as styles } from "./styles";

// what they have most of, fanned out like books on a table. Each opens its
// sheet; most of the shelf in one look before any scrolling
export function CoverFan({
  manga,
  onOpen,
}: {
  manga: SharedManga[];
  onOpen: (m: SharedManga) => void;
}) {
  // only series with a cover: one without was a blank slab among the rest
  const top = manga
    .filter((m) => m.image)
    .sort(
      (a, b) =>
        ownedCountOf(b) - ownedCountOf(a) || (b.rating ?? 0) - (a.rating ?? 0),
    )
    .slice(0, 5);
  if (top.length < 2) return null;
  return (
    <ul className={styles.fan} aria-label="What they have most of">
      {top.map((m, i) => (
        <li
          key={`${m.name}-${i}`}
          className={styles.fanItem}
          style={
            {
              "--tilt": `${(i - (top.length - 1) / 2) * 4}deg`,
            } as React.CSSProperties
          }
        >
          <button
            type="button"
            className={`${styles.fanCard} ${COVER_WITH_CAPTION}`}
            aria-haspopup="dialog"
            aria-label={`${m.name}. Open`}
            onClick={() => onOpen(m)}
          >
            <SeriesCover
              m={m}
              className={styles.fanCover}
              sizes="(max-width: 720px) 54px, 104px"
            />
            <CoverCaption name={m.name} />
          </button>
        </li>
      ))}
    </ul>
  );
}

// copy the link; on phones, the share sheet too. `besideCovers`: on a phone
// they stack beside the fanned covers; with no covers there, they sit in a
// row of their own
export function ShareButtons({ besideCovers }: { besideCovers: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // no clipboard (an old browser, or blocked): the address bar has it
    }
  };
  return (
    <div className={besideCovers ? styles.actions : styles.actionsRow}>
      <button type="button" className={styles.action} onClick={copy}>
        {copied ? <CheckIcon /> : <LinkIcon />}
        <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
      </button>
      {canShare && (
        <button
          type="button"
          className={styles.action}
          onClick={() => navigator.share({ url }).catch(() => {})}
        >
          <ShareIcon />
          Share
        </button>
      )}
    </div>
  );
}
