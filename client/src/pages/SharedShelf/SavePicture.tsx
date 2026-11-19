// "Save a picture": for the owner, on their own shared shelf. Makes a
// picture of the shelf to post (shelfPicture.ts) and hands it to a phone's
// share sheet, or downloads it on a computer.
import { useState } from "react";
import { handPicture } from "../../lib/picture";
import { drawShelfPicture, type ShelfPicture } from "./shelfPicture";
import { shareStyles as styles } from "./styles";

const FILE_NAME = "my-manga-shelf.png";

export default function SavePicture({ picture }: { picture: ShelfPicture }) {
  const [state, setState] = useState<"" | "making" | "failed">("");
  const save = async () => {
    setState("making");
    const blob = await drawShelfPicture(picture).catch(() => null);
    if (!blob) return setState("failed");
    await handPicture(blob, FILE_NAME);
    setState("");
  };
  return (
    <>
      <button
        type="button"
        className={styles.ownerAction}
        disabled={state === "making"}
        onClick={save}
      >
        {state === "making" ? "Making it…" : "Save a picture to post"}
      </button>
      {state === "failed" && (
        <span className="font-medium text-accent" role="alert">
          Couldn't make the picture. Try again.
        </span>
      )}
    </>
  );
}
