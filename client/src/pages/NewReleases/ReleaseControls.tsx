// What the New tab lists, set separately for volumes and chapters. Saved on the
// account; the shelf checks again so the change shows straight away.
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
  volumes: { mode: "next", within: 3 },
  chapters: { mode: "within", within: 3 },
};

// a slider moves through lots of values on its way; only the last is worth saving
const SAVE_AFTER_MS = 400;

const KINDS = {
  volumes: {
    title: "Volumes",
    note: "English and In Japan.",
    one: "volume",
    many: "volumes",
    newest: "newest",
    max: 10,
    // finished vol. 22, vol. 30 is the newest in English
    example: ({ mode, within }: ReleaseRange) => {
      if (mode === "next")
        return "You've finished vol. 22 and vol. 30 is out. You'd see vol. 23.";
      if (mode === "all")
        return "You've finished vol. 22 and vol. 30 is out. You'd see vol. 23–30 as one card.";
      return within >= 8
        ? `You've finished vol. 22 and vol. 30 is out. That's within ${within}, so you'd see vol. 23.`
        : `You've finished vol. 22 and vol. 30 is out. You're 8 behind, so nothing shows until you're within ${within}.`;
    },
  },
  chapters: {
    title: "Chapters",
    note: "English only, since nobody tracks Japanese chapters.",
    one: "chapter",
    many: "chapters",
    newest: "latest",
    max: 50,
    // on ch. 247, ch. 250 is the latest
    example: ({ mode, within }: ReleaseRange) => {
      if (mode === "next")
        return "You're on ch. 247 and ch. 250 is out. You'd see ch. 248.";
      if (mode === "all")
        return "You're on ch. 247 and ch. 250 is out. You'd see ch. 248–250 as one card.";
      return within >= 3
        ? `You're on ch. 247 and ch. 250 is out. That's within ${within}, so you'd see ch. 248.`
        : `You're on ch. 247 and ch. 250 is out. You're 3 behind, so nothing shows until you're within ${within}.`;
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
        setSettings(releases ?? DEFAULTS);
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
              onChange={() => change({ mode })}
            />
            {label}
          </label>
        );
        const unit = range.within === 1 ? copy.one : copy.many;
        return (
          <fieldset key={kind} className={styles.group}>
            <legend className={styles.legend}>{copy.title}</legend>
            <p className={styles.groupNote}>{copy.note}</p>
            {option("next", "Just the next one for me")}
            {option(
              "within",
              `Only when I'm within ${range.within} ${unit} of the ${copy.newest}`,
            )}
            <div className={styles.sliderRow}>
              <input
                type="range"
                className={styles.slider}
                min={1}
                max={copy.max}
                value={range.within}
                disabled={range.mode !== "within"}
                aria-label={`How many ${copy.many} behind the ${copy.newest}`}
                onChange={(e) => change({ within: Number(e.target.value) })}
              />
              <span className={styles.sliderValue} aria-hidden>
                {range.within}
              </span>
            </div>
            {option("all", "Everything that's out")}
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
