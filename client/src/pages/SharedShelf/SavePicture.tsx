// "Save a picture", for the owner, on their own shared shelf: one label and
// two small stamps, Post (1080 by 1350) and Story (1080 by 1920). Makes the
// picture (shelfPicture.ts) and hands it to a phone's share sheet, or
// downloads it on a computer (lib/picture.ts).
import { useState } from "react";
import { handPicture } from "../../lib/picture";
import {
  drawShelfPicture,
  type PictureSize,
  type ShelfPicture,
} from "./shelfPicture";
import { shareStyles as styles } from "./styles";

const FILE_NAMES: Record<PictureSize, string> = {
  post: "my-manga-shelf.png",
  story: "my-manga-shelf-story.png",
};

export default function SavePicture({ picture }: { picture: ShelfPicture }) {
  const [state, setState] = useState<"" | PictureSize | "failed">("");
  const save = async (size: PictureSize) => {
    setState(size);
    const blob = await drawShelfPicture(picture, size).catch(() => null);
    if (!blob) return setState("failed");
    await handPicture(blob, FILE_NAMES[size]);
    setState("");
  };
  const making = state === "post" || state === "story";
  const stamp = (size: PictureSize, label: string) => (
    <button
      type="button"
      className={styles.pictureStamp}
      disabled={making}
      onClick={() => save(size)}
    >
      {state === size ? "Making…" : label}
    </button>
  );
  return (
    <span
      className={styles.pictureGroup}
      role="group"
      aria-label="Save a picture"
    >
      <span>Save a picture</span>
      {stamp("post", "Post")}
      {stamp("story", "Story")}
      {state === "failed" && (
        <span className="font-medium text-accent" role="alert">
          Couldn't make it. Try again.
        </span>
      )}
    </span>
  );
}
