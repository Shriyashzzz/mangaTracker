// A picture of the New tab, with its parts numbered and a line under it for
// each: so the page explains the screen the reader will actually see. It's
// a drawing made of the site's own shapes (it follows the theme, and can't
// go out of date the way a screenshot would), and nothing in it can be
// pressed. Each part has its number in the margin beside it.
import { CheckIcon, ChevronDownIcon } from "../../components/icons/Icons";
import { newReleasesStyles as styles } from "./styles";

const PARTS = [
  {
    name: "Upcoming Releases",
    body: "What's on its way for your shelf, and when.",
  },
  {
    name: "Volumes, Chapters, In Japan",
    body: "Three lists. The number is how many series are in each. In Japan is volumes out there that aren't in English yet.",
  },
  {
    name: "A series with news",
    body: "What's next for you. Tap it for the details. Hide takes it off the list until something newer is out; it waits under Hidden.",
  },
];

export default function NewTabPicture() {
  return (
    <figure className={styles.figure}>
      <div
        className={styles.picture}
        role="img"
        aria-label="The New tab: an Upcoming Releases bar, then Volumes, Chapters and In Japan, then a series with what's next and a Hide button"
      >
        <div className={styles.picPart}>
          <span className={styles.dot}>1</span>
          <div className={styles.picUpcoming}>
            <b>Upcoming Releases</b>
            <span>Next: Dec 12</span>
            <ChevronDownIcon className="ml-auto size-4" aria-hidden />
          </div>
        </div>

        <div className={styles.picPart}>
          <span className={styles.dot}>2</span>
          <div className={styles.picKinds}>
            <span className={styles.picKindOn}>
              Volumes <small>1</small>
            </span>
            <span>
              Chapters <small>1</small>
            </span>
            <span className={styles.picKindEmpty}>
              In Japan <small>0</small>
            </span>
          </div>
        </div>

        <div className={styles.picPart}>
          <span className={styles.dot}>3</span>
          <div className={styles.picRow}>
            <span className={styles.picBook}>15</span>
            <span className={styles.picWords}>
              <b>Your series</b>
              <span className={styles.picNews}>Vol. 15 next</span>
            </span>
            <span className={styles.picHide}>
              <CheckIcon className="size-3.5" aria-hidden />
              Hide
            </span>
          </div>
        </div>
      </div>

      {/* role: Safari stops announcing a list once its bullets are styled away */}
      <ol role="list" className={styles.parts}>
        {PARTS.map((part, i) => (
          <li key={part.name} className={styles.part}>
            <span className={styles.dot}>{i + 1}</span>
            <p>
              <b>{part.name}.</b> {part.body}
            </p>
          </li>
        ))}
      </ol>
    </figure>
  );
}
