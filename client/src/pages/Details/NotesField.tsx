// Notes, typed right where they're read. They save on their own when you click
// away or leave the page, like the chapter stepper does. If a save fails the text
// stays put, so nothing's lost.
import { useEffect, useRef, useState } from "react";
import { apiFetch, errorMessages } from "../../lib/api";
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
  const [status, setStatus] = useState<"" | "saving" | "saved" | "failed">("");
  const [failure, setFailure] = useState("");
  const savedText = useRef(initial ?? "");
  const latest = useRef(text);

  const save = async (value: string) => {
    const notes = value.trim();
    if (notes === savedText.current.trim()) return;
    setStatus("saving");
    try {
      const res = await apiFetch(`/api/manga/${id}/notes`, {
        method: "PATCH",
        body: { description: notes || null },
        keepalive: true,
      });
      // a 400 says what's wrong with the notes; anything else is on our side
      if (!res.ok) {
        throw new Error(res.status === 400 ? (await errorMessages(res))[0] : "");
      }
      savedText.current = notes;
      useShelf.setState((state) => ({
        manga:
          state.manga?.map((m) =>
            m.id === id ? { ...m, description: notes || null } : m,
          ) ?? null,
      }));
      setStatus("saved");
    } catch (e) {
      setFailure((e as Error).message || "That didn't save. Try again.");
      setStatus("failed");
    }
  };

  // leaving the page without clicking anywhere else first still saves
  useEffect(
    () => () => {
      const notes = latest.current.trim();
      if (notes !== savedText.current.trim()) {
        apiFetch(`/api/manga/${id}/notes`, {
          method: "PATCH",
          body: { description: notes || null },
          keepalive: true,
        }).catch(() => {});
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
          className={status === "failed" ? styles.notesFailed : styles.notesSaved}
          role="status"
        >
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
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
