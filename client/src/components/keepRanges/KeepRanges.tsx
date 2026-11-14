// Text with volume ranges in it ("You own vols. 1–6, 8, 12–13"), set so a
// line never breaks inside a range: a browser is happy to break after the
// dash, which left "12–" at the end of one line and "13" on the next.
export default function KeepRanges({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        // (keyed by place: the words of one line of text never reorder)
        <span key={i}>
          {word.includes("–") ? (
            <span className="whitespace-nowrap">{word}</span>
          ) : (
            word
          )}
          {i < words.length - 1 && " "}
        </span>
      ))}
    </>
  );
}
