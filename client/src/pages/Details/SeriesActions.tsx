// The buttons under a series: Edit details, Mark as finished (or reading),
// and Delete, which asks first in the shelf's own delete dialog
// (Home/DeleteManyModal.tsx). On a phone Delete sits last, on a line of its
// own. Under them, a line for what just
// happened: a failed save, or "Marked as finished." with an Undo.
import { useState } from "react";
import type { Manga } from "../../lib/types";
import DeleteManyModal from "../Home/DeleteManyModal";
import AppBarMenu from "../../components/appBarMenu/AppBarMenu";
import { detailsStyles as styles } from "./styles";
import { offlineLink, useIsOffline } from "../../lib/offline";

type Props = {
  // the series, for the dialog that asks first
  manga: Manga;
  finished: boolean;
  // a delete is on its way to the server
  deleting: boolean;
  // what just happened, in words; "" for nothing
  note: string;
  // the note is about marking it finished, and can be taken back
  canUndo: boolean;
  onEdit: () => void;
  onToggleFinished: () => void;
  onUndoFinished: () => void;
  // says whether it worked
  onDelete: () => Promise<boolean>;
};

export default function SeriesActions({
  manga,
  finished,
  deleting,
  note,
  canUndo,
  onEdit,
  onToggleFinished,
  onUndoFinished,
  onDelete,
}: Props) {
  const offline = useIsOffline();
  // the dialog asking first is open
  const [asking, setAsking] = useState(false);

  return (
    <div className={`${styles.actions} app-series-actions`}>
      {/* in the app, Edit details and Delete live in the top bar's ⋮ menu,
          and Mark as finished has the row to itself */}
      <AppBarMenu
        label={manga.name}
        items={[
          { label: "Edit details", onSelect: onEdit, disabled: offline },
          {
            label: "Delete series",
            onSelect: () => setAsking(true),
            danger: true,
            disabled: deleting || offline,
          },
        ]}
      />
      <button
        className="btn btn-secondary app-web-only"
        onClick={onEdit}
        {...offlineLink(offline)}
      >
        Edit details
      </button>
      <button className="btn btn-secondary" onClick={onToggleFinished}>
        {finished ? "Mark as reading" : "Mark as finished"}
      </button>

      <button
        className={`btn btn-ghost app-web-only ${styles.deleteBtn}`}
        onClick={() => setAsking(true)}
        disabled={deleting}
        {...offlineLink(offline)}
      >
        Delete
      </button>

      {asking && (
        <DeleteManyModal
          manga={[manga]}
          onDelete={onDelete}
          onClose={() => setAsking(false)}
        />
      )}

      <p className={styles.actionNote} role="status">
        {note}
        {canUndo && (
          <button
            type="button"
            className={styles.undo}
            onClick={onUndoFinished}
          >
            Undo
          </button>
        )}
      </p>
    </div>
  );
}
