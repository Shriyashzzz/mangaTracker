// A line of the answer with what they came for in the accent colour: the
// chapter and the volume ("Start the manga at chapter 150. Buy volume 17."),
// or, when the anime told it all, "the whole story", seen before the
// sentence is read. Everything else stays as it was written.
import { Fragment } from "react";
import { afterAnimeStyles as styles } from "./styles";

// "chapter 150", "volume 17", "chapter 12.5" (the space may be a
// non-breaking one: lib/afterAnimeText.ts keepNumbers), "the whole story"
const ANSWER = /((?:chapter|volume)\s\d+(?:\.\d+)?|the\swhole\sstory)/i;

export default function AnswerWords({ text }: { text: string }) {
  // split keeps the matches: they're the odd pieces
  return text.split(ANSWER).map((piece, i) =>
    i % 2 ? (
      <span key={i} className={styles.startAnswer}>
        {piece}
      </span>
    ) : (
      <Fragment key={i}>{piece}</Fragment>
    ),
  );
}
