// "Save a picture": for the owner, on their own shared shelf. Makes a
// picture of the shelf to post (shelfPicture.ts) and hands it to a phone's
// share sheet, or downloads it on a computer.
import { useState } from "react";
import { drawShelfPicture, type ShelfPicture } from "./shelfPicture";
import { shareStyles as styles } from "./styles";

const FILE_NAME = "my-manga-shelf.png";

// A phone or tablet (a finger, not a mouse) gets its share sheet, where
// posting or saving to photos is one tap. A computer downloads the file:
// macOS can share a file too, but its share sheet has no "save", and a
// download is what's expected there. Windows and Linux download as well
const onTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;

async function hand(blob: Blob) {
  const file = new File([blob], FILE_NAME, { type: "image/png" });
  if (onTouchDevice() && navigator.canShare?.({ files: [file] })) {
    // closing the share sheet without sharing isn't a failure
    await navigator.share({ files: [file] }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SavePicture({ picture }: { picture: ShelfPicture }) {
  const [state, setState] = useState<"" | "making" | "failed">("");
  const save = async () => {
    setState("making");
    const blob = await drawShelfPicture(picture).catch(() => null);
    if (!blob) return setState("failed");
    await hand(blob);
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
