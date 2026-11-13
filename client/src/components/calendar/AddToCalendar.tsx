// "Add to calendar": a small menu with the reader's choice of calendar.
// Google opens with the event filled in; everything else (Apple Calendar,
// Outlook, most phone calendars) takes the .ics file. For one release, or
// for all of them on the calendar page
import { useEffect, useId, useRef, useState } from "react";
import { CalendarPlusIcon } from "../icons/Icons";
import {
  downloadIcs,
  googleCalendarLink,
  hasDay,
} from "../../lib/addToCalendar";
import type { CalendarVolume } from "../../lib/collector";
import { volumePath } from "../../lib/prices";
import { calendarParts as styles } from "./styles";

// the volume's own page, in full, for the event's link
const pageFor = (v: CalendarVolume) =>
  new URL(volumePath(v.isbn13, v.title), window.location.origin).href;

export default function AddToCalendar({
  volumes,
  label,
  fileName,
  big = false,
  text,
  hint = false,
}: {
  volumes: CalendarVolume[];
  // what the button says to screen readers ("Add Dandadan Vol. 22 to calendar")
  label: string;
  fileName: string;
  // a month's or the page's own button, rather than a row's
  big?: boolean;
  // what that button says ("Save all 6 dates"); a row's says Add to calendar
  text?: string;
  // the word on how each calendar takes the file (once a page is enough)
  hint?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const dated = volumes.filter(hasDay);
  const one = dated.length === 1 ? dated[0]! : null;

  // a click anywhere else or Escape closes it
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      box.current?.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  // only a month to go on: no day to put it on yet
  if (!dated.length)
    return big ? null : <span className={styles.tbc}>date TBC</span>;

  // several at once: Google's link takes one event, so it's the file alone,
  // straight away, with a word on how each calendar takes it
  if (!one)
    return (
      <div className={styles.addAllBox}>
        <button
          type="button"
          className={styles.addAll}
          aria-label={label}
          onClick={() => downloadIcs(dated, fileName, pageFor)}
        >
          <CalendarPlusIcon className={styles.addIcon} />
          {text ?? `Save all ${dated.length} dates`}
        </button>
        {hint && (
          <span className={styles.addHint}>
            Works with Apple Calendar, Outlook and Google Calendar.
          </span>
        )}
      </div>
    );

  return (
    <div className={styles.addBox} ref={box}>
      <button
        type="button"
        className={big ? styles.addAll : styles.add}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen(!open)}
      >
        <CalendarPlusIcon className={styles.addIcon} />
        <span className={big ? undefined : styles.addWord}>
          {big ? (text ?? "Save the date") : "Add"}
        </span>
      </button>
      {open && (
        <div id={menuId} className={styles.addMenu}>
          <a
            href={googleCalendarLink(one, pageFor)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.addItem}
            onClick={() => setOpen(false)}
          >
            Google Calendar
          </a>
          <button
            type="button"
            className={styles.addItem}
            onClick={() => {
              downloadIcs(dated, fileName, pageFor);
              setOpen(false);
            }}
          >
            Apple, Outlook and others
            <span className={styles.addHint}>.ics file</span>
          </button>
        </div>
      )}
    </div>
  );
}
