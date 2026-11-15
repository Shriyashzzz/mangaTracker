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
import { ArrowRightIcon } from "../../components/icons/Icons";
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

// The example under each choice: the newest one out, then each case on a
// line of its own, what you have on the left and what New does on the right.
// Worked out for wherever the slider is set (at 9 volumes: own up to vol.
// 21, New shows vol. 22; own less, New waits)
type Example = {
  newest: string;
  rows: [string, string][];
  // a line under the rows, saying the rule they show
  after?: string;
};

function atTheEdge({
  latest,
  within,
  word,
  you,
  less,
}: {
  latest: number;
  within: number;
  word: "vol." | "ch.";
  you: "Own up to" | "On";
  // the case further behind: "Own less", "Further back"
  less: string;
}): Example {
  const at = latest - within;
  return {
    newest: newestLine(word, latest),
    rows: [
      [`${you} ${word} ${at}`, `New shows ${word} ${at + 1}`],
      [less, "New waits"],
    ],
  };
}

// "If vol. 30 is a new release:", "If ch. 250 is the latest released
// chapter:"
const newestLine = (word: "vol." | "ch.", latest: number) =>
  word === "vol."
    ? `If vol. ${latest} is a new release:`
    : `If ch. ${latest} is the latest released chapter:`;

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
    // vol. 30 is the newest in English; the example moves with the slider
    example: ({ mode, within }: ReleaseRange): Example =>
      mode === "next"
        ? {
            newest: newestLine("vol.", 30),
            // close or far behind, the next one shows
            rows: [
              ["Own up to vol. 29", "New shows vol. 30"],
              ["Own up to vol. 5", "New shows vol. 6"],
            ],
            after:
              "And so on: wherever you are, if your next volume is out, New shows it.",
          }
        : atTheEdge({
            latest: 30,
            within,
            word: "vol.",
            you: "Own up to",
            less: "Own less",
          }),
  },
  chapters: {
    title: "Chapters",
    note: "English only, since nobody tracks Japanese chapters.",
    one: "chapter",
    many: "chapters",
    newest: "latest",
    closest: "New chapters only",
    max: 50,
    // ch. 250 is the latest; the example moves with the slider
    example: ({ mode, within }: ReleaseRange): Example =>
      mode === "next"
        ? {
            newest: newestLine("ch.", 250),
            rows: [
              ["On ch. 249", "New shows ch. 250"],
              ["On ch. 12", "New shows ch. 13"],
            ],
            after:
              "And so on: wherever you are, if your next chapter is out, New shows it.",
          }
        : atTheEdge({
            latest: 250,
            within,
            word: "ch.",
            you: "On",
            less: "Further back",
          }),
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
            <ExampleBox example={copy.example(range)} />
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

// the example as it's drawn: the newest one, then a row per case with an
// arrow between what you have and what New does
function ExampleBox({ example }: { example: Example }) {
  return (
    <div className={styles.example}>
      <p className={styles.exampleNewest}>{example.newest}</p>
      <dl className={styles.exampleRows}>
        {example.rows.map(([when, then]) => (
          <div key={when} className={styles.exampleRow}>
            <dt>{when}</dt>
            <ArrowRightIcon className={styles.exampleArrow} />
            <dd className={styles.exampleThen}>{then}</dd>
          </div>
        ))}
      </dl>
      {example.after && <p className={styles.exampleNewest}>{example.after}</p>}
    </div>
  );
}
