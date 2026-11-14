// Which series show on the New tab, set separately for volumes and
// chapters: every series, or only the ones the reader is nearly caught up
// on (a slider says how nearly; its first stop is "new releases only").
// Saved on the account; the shelf checks again so the change shows straight
// away.
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";
import type {
  Prefs,
  RangeMode,
  ReleaseRange,
  ReleaseSettings,
} from "../../lib/types";
import { useShelf } from "../../store/shelf";
import { newReleasesStyles as styles } from "./styles";

const DEFAULTS: ReleaseSettings = {
  volumes: { mode: "next", within: 1 },
  chapters: { mode: "within", within: 3 },
};

// What's saved, as one of the two choices on offer. Settings saved before
// November 2026 can hold a third ("all": everything as one card), which
// the server now reads as every series ("next"); so does this, or neither
// choice would show as picked
const asOffered = (saved: ReleaseSettings | undefined): ReleaseSettings => {
  const range = (kind: keyof ReleaseSettings): ReleaseRange => {
    const one = saved?.[kind];
    if (!one) return DEFAULTS[kind];
    return { ...one, mode: one.mode === "within" ? "within" : "next" };
  };
  return { volumes: range("volumes"), chapters: range("chapters") };
};

// a slider moves through lots of values on its way; only the last is worth saving
const SAVE_AFTER_MS = 400;

// The words for each kind. `closest` is what the slider's first stop is
// called: a series shows only when its newest one is the one they need
const KINDS = {
  volumes: {
    title: "Volumes",
    note: "English volumes.",
    one: "volume",
    many: "volumes",
    newest: "newest",
    closest: "New releases only",
    max: 10,
    // finished vol. 22, vol. 30 is the newest in English
    example: ({ mode, within }: ReleaseRange) => {
      const start = "You own up to vol. 22 and vol. 30 is out.";
      if (mode === "next") return `${start} New shows vol. 23.`;
      if (within >= 8) return `${start} New shows vol. 23.`;
      if (within === 1)
        return `${start} New waits. Get vol. 29 and it shows vol. 30.`;
      return `${start} That's 8 behind, so New waits. Get vol. ${30 - within} and it shows vol. ${31 - within}.`;
    },
  },
  chapters: {
    title: "Chapters",
    note: "English only, since nobody tracks Japanese chapters.",
    one: "chapter",
    many: "chapters",
    newest: "latest",
    closest: "New chapters only",
    max: 50,
    // on ch. 247, ch. 250 is the latest
    example: ({ mode, within }: ReleaseRange) => {
      const start = "You're on ch. 247 and ch. 250 is out.";
      if (mode === "next") return `${start} New shows ch. 248.`;
      if (within >= 3) return `${start} New shows ch. 248.`;
      if (within === 1)
        return `${start} New waits. Read ch. 249 and it shows ch. 250.`;
      return `${start} That's 3 behind, so New waits. Read ch. ${250 - within} and it shows ch. ${251 - within}.`;
    },
  },
} as const;

export default function ReleaseControls() {
  const recheckReleases = useShelf((s) => s.recheckReleases);
  const [settings, setSettings] = useState<ReleaseSettings | null>(null);
  const [status, setStatus] = useState<
    "" | "saving" | "saved" | "failed" | "unloaded"
  >("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch("/api/prefs", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        const { releases } = (await res.json()) as Prefs;
        setSettings(asOffered(releases));
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setStatus("unloaded");
      });
    return () => {
      controller.abort();
      clearTimeout(timer.current);
    };
  }, []);

  if (status === "unloaded") {
    return (
      <p className={styles.failed} role="alert">
        Couldn't load your settings. Refresh the page to try again.
      </p>
    );
  }
  if (!settings) {
    return (
      <div
        className={`skeleton ${styles.panel} min-h-80`}
        aria-busy="true"
        aria-label="Loading"
      />
    );
  }

  const save = (next: ReleaseSettings) => {
    setSettings(next);
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await apiFetch("/api/prefs", {
          method: "PUT",
          body: { releases: next },
        });
        if (!res.ok) throw new Error(res.statusText);
        setStatus("saved");
        recheckReleases();
      } catch {
        setStatus("failed");
      }
    }, SAVE_AFTER_MS);
  };

  return (
    <div className={styles.panel}>
      {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((kind) => {
        const copy = KINDS[kind];
        const range = settings[kind];
        const change = (patch: Partial<ReleaseRange>) =>
          save({ ...settings, [kind]: { ...range, ...patch } });
        const option = (mode: RangeMode, label: string) => (
          <label className={styles.option}>
            <input
              type="radio"
              name={`${kind}-mode`}
              checked={range.mode === mode}
              // choosing "nearly caught up" starts the slider at its
              // first stop, new releases only, whatever it was left on
              onChange={() =>
                change(mode === "within" ? { mode, within: 1 } : { mode })
              }
            />
            {label}
          </label>
        );
        // what the slider is set to, in words: its first stop is the
        // newest one only
        const howClose =
          range.within === 1
            ? copy.closest
            : `Up to ${range.within} ${copy.many} behind`;
        return (
          <fieldset key={kind} className={styles.group}>
            <legend className={styles.legend}>{copy.title}</legend>
            <p className={styles.groupNote}>{copy.note}</p>
            {option("next", "Every series")}
            {option("within", "Only series I'm nearly caught up on")}
            {/* how nearly: only with the choice it belongs to */}
            {range.mode === "within" && (
              <div className={styles.sliderRow}>
                <input
                  type="range"
                  className={styles.slider}
                  min={1}
                  max={copy.max}
                  value={range.within}
                  aria-label={`How many ${copy.many} behind the ${copy.newest}`}
                  aria-valuetext={howClose}
                  onChange={(e) => change({ within: Number(e.target.value) })}
                />
                <span className={styles.sliderValue} aria-hidden>
                  {howClose}
                </span>
              </div>
            )}
            <p className={styles.example}>{copy.example(range)}</p>
          </fieldset>
        );
      })}
      <p
        className={status === "failed" ? styles.failed : styles.status}
        role="status"
      >
        {status === "saving" && "Saving…"}
        {status === "saved" &&
          "Saved. Your New tab will use this next time it opens."}
        {status === "failed" && "That didn't save. Try again."}
      </p>
    </div>
  );
}
