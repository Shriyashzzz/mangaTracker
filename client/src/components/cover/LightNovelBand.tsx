// "Novel" across the foot of a cover, over the picture, as the iPhone and
// Android apps draw it (MangaTrackerNative components/LightNovelBand.tsx):
// said on the book itself wherever a series or one of its volumes is shown,
// so the prose book is never taken for the comic of the same name. One word
// for every kind (a Japanese light novel, a Chinese or Korean novel). Sits
// inside the cover's own box, which must be `relative`; the word is sized
// from the cover's width, so it fits a 40px thumbnail and a page's big cover.
// Read out where the cover is ("Novel"), as the words it replaces were
export default function LightNovelBand() {
  return (
    <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex justify-center bg-ink px-[2px] [container-type:inline-size]">
      <span className="py-[0.22em] font-mono text-[clamp(7px,13cqw,11px)] leading-[1.3] font-medium tracking-[0.5px] whitespace-nowrap text-paper uppercase">
        Novel
      </span>
    </span>
  );
}
