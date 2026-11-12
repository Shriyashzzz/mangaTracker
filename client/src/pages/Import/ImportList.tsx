// A book import's list, once there is one: a row per series with its tick,
// what AniList found and Edit, grouped once matching is done (what needs a look
// first: not on AniList, couldn't check, omnibus editions, then found). Each
// group opens and closes; a row moved by Edit opens the group it lands in.
import { useEffect, useMemo, useState } from "react";
import { useShelf } from "../../store/shelf";
import { ChevronDownIcon, InfoIcon } from "../../components/icons/Icons";
import { ownedPhrase } from "../../lib/ownedVolumes";
import { editOf, gapsIn, type BookSeries } from "../../lib/imports/bookImport";
import { useBookImport, type Match } from "../../store/bookImport";
import MatchModal from "./MatchModal";
import { importStyles as styles } from "./styles";
import { shelfKey } from "../../lib/titleKey";

export default function ImportList({
  found,
  rows,
  matchOf,
  keptApartFrom,
  ticked,
  importing,
  lookingUp,
}: {
  // the series as the files grouped them (the groups reset with a new import)
  found: BookSeries[] | null;
  // the rows shown: series AniList says are one, as one
  rows: BookSeries[];
  // what AniList found for a row, with their edits; undefined while matching
  matchOf: (s: BookSeries) => Match | undefined;
  // a spin-off kept apart: the series a shorter name found
  keptApartFrom: (s: BookSeries) => string | null;
  ticked: (s: BookSeries) => boolean;
  // adding to the shelf: nothing can change meanwhile
  importing: boolean;
  lookingUp: boolean;
}) {
  const imported = useBookImport();
  const { edits } = imported;
  // the row whose Edit is open
  const [editing, setEditing] = useState<BookSeries | null>(null);
  // what's on their shelf already: those rows add volumes to it (names
  // compared as the shelf compares them, case and punctuation aside)
  const shelf = useShelf((st) => st.manga);
  useEffect(() => {
    if (!shelf) void useShelf.getState().load();
  }, [shelf]);
  const onShelf = useMemo(
    () =>
      new Set(
        (shelf ?? []).map((m) => shelfKey(m.name, Boolean(m.lightNovel))),
      ),
    [shelf],
  );

  // one row: its tick, its name and what was found, and Edit beside it
  const seriesRow = (s: BookSeries) => {
    const match = matchOf(s);
    const apart = keptApartFrom(s);
    const name = match && match !== "failed" ? match.name : s.title;
    const edited = Boolean(editOf(s, edits));
    return (
      <div key={s.key} className={styles.seriesRow}>
        <label className={styles.seriesLabel}>
          <input
            className={styles.listCheck}
            type="checkbox"
            checked={ticked(s)}
            disabled={importing || match === undefined}
            onChange={() =>
              imported.chooseAll(s.members ?? [s.key], !ticked(s))
            }
          />
          <span className={styles.seriesText}>
            <span className={styles.listName}>{name}</span>
            <span className={styles.seriesMeta}>
              {match === undefined
                ? "Matching…"
                : match === "failed"
                  ? "Couldn't check AniList"
                  : match === null
                    ? editOf(s, edits)?.match === null
                      ? "You said it isn't on AniList"
                      : apart
                        ? `Not on AniList, and not the same as ${apart}`
                        : s.lightNovel
                          ? "Not on AniList"
                          : "Not on AniList, so probably not manga"
                    : (s.lightNovel ? "Light novel · " : "") +
                      (s.planned
                        ? "Only on a to-read list"
                        : s.ownedVolumes
                          ? `Own ${ownedPhrase({
                              volumesOwned: s.ownedVolumes,
                              ownedList: gapsIn(s.ownedList)
                                ? s.ownedList!
                                : [],
                            })}`
                          : `${s.books} book${s.books === 1 ? "" : "s"}`)}
            </span>
            {/* "Vinland Saga Omnibus, Vol. 3" doesn't say which
              volumes it holds, so the count is a guess */}
            {s.omnibus && match && match !== "failed" && (
              <span className={styles.omnibusNote}>
                Omnibus editions: check the volume count with Edit
              </span>
            )}
            {match &&
              match !== "failed" &&
              onShelf.has(shelfKey(name, s.lightNovel)) && (
                <span className={styles.seriesMeta}>
                  Already on your shelf: new volumes are added to it
                </span>
              )}
            {edited && (
              <span className={styles.seriesMeta + " " + styles.edited}>
                Edited by you
              </span>
            )}
          </span>
        </label>
        <button
          type="button"
          className={styles.seriesEdit}
          disabled={importing || match === undefined}
          aria-label={`Edit ${name}`}
          onClick={() => setEditing(s)}
        >
          Edit
        </button>
      </div>
    );
  };
  const isFound = (r: BookSeries) => {
    const m = matchOf(r);
    return m != null && m !== "failed";
  };
  // once matching is done: what needs a look first, then what was found, each
  // group in the file's order. While it's matching, the file's order, so rows
  // don't jump about under them
  const groups = lookingUp
    ? [{ id: "all", title: null, rows }]
    : [
        {
          id: "missing",
          title: "Not on AniList",
          rows: rows.filter((r) => matchOf(r) === null),
        },
        {
          id: "unchecked",
          title: "Couldn't check AniList",
          rows: rows.filter((r) => matchOf(r) === "failed"),
        },
        // found, but an omnibus doesn't say which volumes it holds, so
        // the count wants a look with Edit
        {
          id: "omnibus",
          title: "Omnibus editions",
          rows: rows.filter((r) => isFound(r) && r.omnibus),
        },
        {
          id: "matched",
          title: "Found",
          rows: rows.filter((r) => isFound(r) && !r.omnibus),
        },
      ].filter((g) => g.rows.length);

  // groups they've closed, for this import only: a new one starts all open
  const [closed, setClosed] = useState<{
    for: BookSeries[] | null;
    ids: Set<string>;
  }>({ for: null, ids: new Set() });
  const closedIds = closed.for === found ? closed.ids : new Set<string>();
  // from the latest state, so quick clicks on several headings all count
  const toggleGroup = (id: string) =>
    setClosed((was) => {
      const ids = new Set(was.for === found ? was.ids : []);
      if (!ids.delete(id)) ids.add(id);
      return { for: found, ids };
    });
  // a row just edited or undone: its group opens if it's closed, so they see
  // where it went
  const [followed, setFollowed] = useState<string | null>(null);
  if (followed) {
    const into = groups.find((g) =>
      g.rows.some((r) => (r.members ?? [r.key]).includes(followed)),
    );
    setFollowed(null);
    if (into && closedIds.has(into.id)) {
      const ids = new Set(closedIds);
      ids.delete(into.id);
      setClosed({ for: found, ids });
    }
  }

  // the omnibus group's ⓘ: what an omnibus is
  const [omnibusInfo, setOmnibusInfo] = useState(false);

  return (
    <>
      <div
        className={styles.seriesList}
        role="group"
        aria-label="Series to add"
      >
        {groups.map((g) =>
          g.title ? (
            <div
              key={g.id}
              role="group"
              aria-labelledby={`import-group-${g.id}`}
            >
              <h3 id={`import-group-${g.id}`} className={styles.groupHead}>
                <button
                  type="button"
                  className={styles.groupToggle}
                  aria-expanded={!closedIds.has(g.id)}
                  aria-controls={`import-rows-${g.id}`}
                  onClick={() => toggleGroup(g.id)}
                >
                  {g.title}{" "}
                  <span className={styles.groupCount}>{g.rows.length}</span>
                </button>
                {g.id === "omnibus" && (
                  <button
                    type="button"
                    className={styles.groupInfo}
                    aria-label="What's an omnibus?"
                    aria-expanded={omnibusInfo}
                    aria-controls="omnibus-info"
                    onClick={() => setOmnibusInfo(!omnibusInfo)}
                  >
                    <InfoIcon aria-hidden />
                  </button>
                )}
                {/* the whole row is the toggle's (styles.groupToggle),
                  so the arrow only shows which way it is */}
                <ChevronDownIcon
                  className={styles.groupArrow}
                  data-closed={closedIds.has(g.id) || undefined}
                  aria-hidden
                />
              </h3>
              {g.id === "omnibus" && omnibusInfo && (
                <p id="omnibus-info" className={styles.groupInfoText}>
                  An omnibus is one big book that holds several volumes, like a
                  3-in-1. Its listing doesn't always say which volumes are
                  inside, so check the count with Edit.
                </p>
              )}
              {/* closed only hides them: their ticks still count */}
              <div id={`import-rows-${g.id}`} hidden={closedIds.has(g.id)}>
                {g.rows.map(seriesRow)}
              </div>
            </div>
          ) : (
            g.rows.map(seriesRow)
          ),
        )}
      </div>

      {editing && (
        <MatchModal
          series={editing}
          current={matchOf(editing)}
          edited={Boolean(editOf(editing, edits))}
          onSave={(edit) => {
            imported.edit(editing.members ?? [editing.key], edit);
            setFollowed(editing.key);
          }}
          onUndo={() => {
            imported.unedit(editing.members ?? [editing.key]);
            setFollowed(editing.key);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
