// Notes, typed right where they're read. They save on their own when you click
// away or leave the page, like the chapter stepper does; with no connection
// they're kept on this device and go when it's back (lib/offlineChanges.ts).
// If a save fails the text stays put, so nothing's lost.
import { useEffect, useRef, useState } from "react";
import { apiFetch, errorMessages } from "../../lib/api";
import { saveOrKeep } from "../../lib/offlineChanges";
import { useShelf } from "../../store/shelf";
import { detailsStyles as styles } from "./styles";

const MAX_LENGTH = 450;

export default function NotesField({
  id,
  initial,
}: {
  id: number;
  initial: string | null;
}) {
  const [text, setText] = useState(initial ?? "");
  const [status, setStatus] = useState<
    "" | "saving" | "saved" | "kept" | "failed"
  >("");
  const [failure, setFailure] = useState("");
  const savedText = useRef(initial ?? "");
  const latest = useRef(text);

  const save = async (value: string) => {
    const notes = value.trim();
    if (notes === savedText.current.trim()) return;
    setStatus("saving");
    try {
      let refused = "";
      const how = await saveOrKeep(
        id,
        "notes",
        savedText.current.trim() || null,
        notes || null,
        async () => {
          const res = await apiFetch(`/api/manga/${id}/notes`, {
            method: "PATCH",
            body: { description: notes || null },
            keepalive: true,
          });
          // a 400 says what's wrong with the notes
          if (res.status === 400) refused = (await errorMessages(res))[0] ?? "";
          return res;
        },
      ).catch((e: Error) => {
        throw new Error(refused || e.message);
      });
      savedText.current = notes;
      useShelf.setState((state) => ({
        manga:
          state.manga?.map((m) =>
            m.id === id ? { ...m, description: notes || null } : m,
          ) ?? null,
      }));
      setStatus(how);
    } catch (e) {
      const said = (e as Error).message;
      setFailure(
        said && !said.startsWith("answered")
          ? said
          : "That didn't save. Try again.",
      );
      setStatus("failed");
    }
  };

  // leaving the page without clicking anywhere else first still saves
  useEffect(
    () => () => {
      const notes = latest.current.trim();
      if (notes !== savedText.current.trim()) {
        saveOrKeep(
          id,
          "notes",
          savedText.current.trim() || null,
          notes || null,
          () =>
            apiFetch(`/api/manga/${id}/notes`, {
              method: "PATCH",
              body: { description: notes || null },
              keepalive: true,
            }),
        ).catch(() => {});
      }
    },
    [id],
  );

  return (
    <div className={styles.notes}>
      <div className={styles.notesHead}>
        <label htmlFor="manga-notes" className={styles.label}>
          Your notes
        </label>
        <span
          className={
            status === "failed" ? styles.notesFailed : styles.notesSaved
          }
          role="status"
        >
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
          {/* short: it shares a line with "Your notes" */}
          {status === "kept" && "Saves when you're back"}
          {status === "failed" && failure}
        </span>
      </div>
      <textarea
        id="manga-notes"
        className={styles.notesInput}
        value={text}
        rows={2}
        maxLength={MAX_LENGTH}
        placeholder="Add a note…"
        onChange={(e) => {
          setText(e.target.value);
          latest.current = e.target.value;
          if (status) setStatus("");
        }}
        onBlur={() => save(text)}
      />
    </div>
  );
}
