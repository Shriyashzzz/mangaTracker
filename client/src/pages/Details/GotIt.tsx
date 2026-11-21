// Buy next's "I've got this one": on my shelf, or ordered. In the app, two
// pills on the ticket, one tap each, as Android lays out a card's actions.
// On the website, one quiet "Got it" that opens the site's own dropdown
// (the shelf's menu, pages/Home/ShelfBar.tsx) with the two in it: pills on a
// website ticket read as stray buttons
import { ChevronDownIcon } from "../../components/icons/Icons";
import { inApp } from "../../lib/inApp";
import { offlineLink, useIsOffline } from "../../lib/offline";
import { Menu } from "../Home/Menu";
import { useMenu } from "../Home/useMenu";
import { shelfBarStyles as menuStyles } from "../Home/shelfBarStyles";
import { detailsStyles as styles } from "./styles";

type Props = {
  // what it's about, for screen readers: "Vol. 7", "Deluxe 3"
  name: string;
  // missing when the page can't put it on the shelf from here
  onShelf?: () => void;
  onOrdered?: () => void;
  owning: boolean;
  ordering: boolean;
};

export default function GotIt({
  name,
  onShelf,
  onOrdered,
  owning,
  ordering,
}: Props) {
  const offline = useIsOffline();
  const { open, setOpen, ref } = useMenu();
  const choices = [
    onShelf && {
      label: owning ? "Saving…" : "On my shelf",
      said: `${name}: on my shelf`,
      busy: owning,
      run: onShelf,
      offline: false,
    },
    onOrdered && {
      label: ordering ? "Saving…" : "Ordered",
      said: `${name}: ordered`,
      busy: ordering,
      run: onOrdered,
      offline: true,
    },
  ].filter((c): c is Exclude<typeof c, false | undefined> => Boolean(c));
  if (!choices.length) return null;

  if (inApp())
    return (
      <span className={styles.ticketPills}>
        {choices.map((c) => (
          <button
            key={c.said}
            type="button"
            className={styles.ticketPill}
            disabled={c.busy}
            aria-label={c.said}
            onClick={c.run}
            {...(c.offline ? offlineLink(offline) : {})}
          >
            {c.label}
          </button>
        ))}
      </span>
    );

  const busy = owning || ordering;
  return (
    <span className={styles.ticketPills}>
      <div ref={ref} className={menuStyles.sortWrap}>
        <button
          type="button"
          className={menuStyles.pickButton}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={`${name}: got it? On my shelf, or ordered`}
          disabled={busy}
          onClick={() => setOpen(!open)}
        >
          <span className={menuStyles.pickWords}>
            {busy ? "Saving…" : "Got it"}
          </span>
          <ChevronDownIcon className={menuStyles.pickChevron} />
        </button>
        {open && (
          <Menu label="Got it" alignRight>
            {choices.map((c) => (
              <li key={c.said}>
                <button
                  type="button"
                  className={menuStyles.sortOption}
                  aria-label={c.said}
                  onClick={() => {
                    setOpen(false);
                    c.run();
                  }}
                  {...(c.offline ? offlineLink(offline) : {})}
                >
                  {c.label}
                </button>
              </li>
            ))}
          </Menu>
        )}
      </div>
    </span>
  );
}
