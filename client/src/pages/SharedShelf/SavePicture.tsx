// "Save a picture": for the owner, on their own shared shelf. Makes a
// picture of the shelf to post (shelfPicture.ts) and hands it to a phone's
// share sheet, or downloads it on a computer.
import { useState } from "react";
import { handPicture } from "../../lib/picture";
import {
  drawShelfPicture,
  type PictureSize,
  type ShelfPicture,
} from "./shelfPicture";
import { shareStyles as styles } from "./styles";

const FILE_NAME = "my-manga-shelf.png";
const STORY_FILE_NAME = "my-manga-shelf-story.png";

export default function SavePicture({ picture }: { picture: ShelfPicture }) {
  const [state, setState] = useState<"" | PictureSize | "failed">("");
  const save = async (size: PictureSize) => {
    setState(size);
    const blob = await drawShelfPicture(picture, size).catch(() => null);
    if (!blob) return setState("failed");
    await handPicture(blob, size === "story" ? STORY_FILE_NAME : FILE_NAME);
    setState("");
  };
  const making = state === "post" || state === "story";
  return (
    <>
      <button
        type="button"
        className={styles.ownerAction}
        disabled={making}
        onClick={() => save("post")}
      >
        {state === "post" ? "Making it…" : "Save a picture to post"}
      </button>
      {/* the same, taller: a phone's story */}
      <button
        type="button"
        className={styles.ownerAction}
        disabled={making}
        onClick={() => save("story")}
      >
        {state === "story" ? "Making it…" : "Story size"}
      </button>
      {state === "failed" && (
        <span className="font-medium text-accent" role="alert">
          Couldn't make the picture. Try again.
        </span>
      )}
    </>
  );
}
