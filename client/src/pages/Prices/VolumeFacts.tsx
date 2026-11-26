import type { VolumeAbout } from "../../lib/types";
import { formatUsd } from "../../lib/prices";
import { inCanada } from "../../lib/country";
import FoldedBlurb from "./FoldedBlurb";
import { pricesStyles as styles } from "./styles";
import { releaseDay } from "./volumePageRules";

// What's known of this one book (a collector's list first, then Google
// Books: server prices/volumeDetails.ts): when it came out in English, its
// length and list price, and the publisher's description, folded as the
// series' is (SeriesFacts). Only what's there: nothing is guessed
export default function VolumeFacts({ about }: { about: VolumeAbout }) {
  const facts = [
    about.published && (
      <li key="out">
        Out in English <strong>{releaseDay(about.published)}</strong>
      </li>
    ),
    about.pages != null && (
      <li key="pages">
        <strong>{about.pages}</strong> pages
      </li>
    ),
    // the publisher's US price: in US dollars, whichever country is picked
    about.listCents != null && (
      <li key="list">
        {inCanada() ? "US list price" : "List price"}{" "}
        <strong>{formatUsd(about.listCents)}</strong>
      </li>
    ),
  ].filter(Boolean);

  return (
    <div className={styles.facts}>
      {facts.length > 0 && <ul className={styles.factRow}>{facts}</ul>}
      {about.description && <FoldedBlurb text={about.description} />}
    </div>
  );
}
