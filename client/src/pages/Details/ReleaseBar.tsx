// "There's a new one", for someone who's caught up (releaseNews.ts says
// when): a slim red bar with the news, the white button to buy or preorder
// the book, and an × that silences this one release
import { NavLink } from "react-router";
import { InkCrossIcon } from "../../components/icons/Icons";
import { isDemo } from "../../lib/demo";
import { detailsStyles as styles } from "./styles";
import { offlineLink, useIsOffline } from "../../lib/offline";

type Props = {
  // "Vol. 44 is out!", "Ch. 125 expected Dec 3"
  headline: string;
  // the book to buy or preorder; null: the news alone
  link: { to: string; label: string } | null;
  // the ×: this release won't show again, the next one will
  onClose: () => void;
};

export default function ReleaseBar({ headline, link, onClose }: Props) {
  const offline = useIsOffline();
  return (
    <section className={styles.release} aria-label="New release">
      <div className={styles.releaseBar} data-tour="release-toggle">
        <span className={styles.releaseStamp} aria-hidden>
          Psst!
        </span>
        <p className={styles.releaseHeadline}>{headline}</p>
        {link && (
          <NavLink
            className={styles.releaseBuy}
            to={link.to}
            viewTransition
            {...offlineLink(offline)}
          >
            {link.label} →
          </NavLink>
        )}
        {/* not on the tour's practice shelf: its news is there to be seen */}
        {!isDemo() && (
          <button
            type="button"
            className={styles.releaseClose}
            aria-label="Hide this news"
            onClick={onClose}
          >
            <InkCrossIcon className="size-[0.9rem]" />
          </button>
        )}
      </div>
    </section>
  );
}
