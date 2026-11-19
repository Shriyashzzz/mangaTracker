// Pictures made in the browser for readers to post: the shelf picture
// (pages/SharedShelf/shelfPicture.ts) and the year in manga
// (pages/Year/yearPicture.ts). Their shared pieces: the dotted paper,
// lettering made to fit, and handing the picture over.

export const INK = "#1d1a16";
export const ACCENT = "#b14a3c";
export const CARD = "#fbf8f0";

// the paper and its print dots, over the whole canvas
export function drawPaper(ctx: CanvasRenderingContext2D, paper: string) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(29, 26, 22, 0.28)";
  for (let y = 8; y < height; y += 16)
    for (let x = 8; x < width; x += 16) {
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
}

// text that's made smaller until it fits the width
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  face: string,
  size: number,
  room: number,
) {
  let px = size;
  do {
    ctx.font = `${px}px ${face}`;
    px -= 4;
  } while (ctx.measureText(text).width > room && px > 40);
}

// A phone or tablet (a finger, not a mouse) gets its share sheet, where
// posting or saving to photos is one tap. A computer downloads the file:
// macOS can share a file too, but its share sheet has no "save", and a
// download is what's expected there. Windows and Linux download as well
const onTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;

export async function handPicture(blob: Blob, fileName: string) {
  const file = new File([blob], fileName, { type: "image/png" });
  if (onTouchDevice() && navigator.canShare?.({ files: [file] })) {
    // closing the share sheet without sharing isn't a failure
    await navigator.share({ files: [file] }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// the canvas as a PNG; null when it can't be read back
export const pictureOf = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, "image/png");
    } catch {
      resolve(null);
    }
  });
