// "Which book has volume [23]?" for a series' omnibus and deluxe lines,
// answered in every line at once (lib/editionLookup.ts). On the /editions
// page and in a series page's Other editions. Started at the reader's next
// volume when the series is on their shelf
import { useId, useState } from "react";
import { NavLink } from "react-router";
import { lookUpVolume, type LookupLine } from "../../lib/editionLookup";
import { editionsStyles as styles } from "./editionsStyles";

export default function EditionFinder({
  lines,
  startAt,
  onVolume,
}: {
  lines: LookupLine[];
  // the reader's next volume, when the series is theirs
  startAt: number | null;
  // the volume asked about, for tiles that frame its book
  onVolume?: (volume: number | null) => void;
}) {
  const inputId = useId();
  const [typed, setTyped] = useState(startAt == null ? "" : String(startAt));
  const volume = /^\d{1,4}$/.test(typed.trim()) ? Number(typed) : null;
  const answers = volume ? lookUpVolume(lines, volume) : [];
  return (
    <div className={styles.finder}>
      <div className={styles.ask}>
        <label htmlFor={inputId} className={styles.askLabel}>
          Which book has volume
        </label>
        <input
          id={inputId}
          className={styles.askInput}
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="23"
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            const v = e.target.value.trim();
            onVolume?.(/^\d{1,4}$/.test(v) ? Number(v) : null);
          }}
        />
        <span className={`${styles.askLabel} -ml-2`} aria-hidden>
          ?
        </span>
        {startAt != null && volume === startAt && (
          <span className={styles.askNote}>your next volume</span>
        )}
      </div>
      {volume != null && (
        <ul className={styles.answers} aria-live="polite">
          {answers.map(({ line, book, runs }) => (
            <li key={line.key} className={styles.answer}>
              {book ? (
                <>
                  {book.path ? (
                    <NavLink
                      to={book.path}
                      className={`${styles.answerBook} ${styles.textLink}`}
                      viewTransition
                    >
                      {book.name}
                    </NavLink>
                  ) : (
                    <span className={styles.answerBook}>{book.name}</span>
                  )}
                  <span className={styles.answerInside}>{book.inside}</span>
                  {book.coming && (
                    <span className={styles.answerComing}>
                      out {book.coming}
                    </span>
                  )}
                </>
              ) : (
                <span className={styles.answerNone}>
                  No {line.label} book holds vol. {volume}{" "}
                  <span className={styles.answerInside}>({runs})</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
