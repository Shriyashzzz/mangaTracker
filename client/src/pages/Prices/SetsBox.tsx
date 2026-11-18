// Beside a series' title: the ways to own the run in fewer buys. Its box
// sets, and its editions' bigger books (Deluxe, Definitive, VIZBIG…), in ONE
// box that shows one of them at a time. It used to be either the box sets
// box or one edition's, whichever the series had, so the spot seemed to
// change its mind from series to series.
//
// Box sets show first whenever one is priced. A menu picks another (your
// shelf's SortMenu: a box of its own on a laptop, beside the title on a
// phone, as "Buy next · as 3-in-1" does), and the editions not showing stay at
// the bottom, each with its cheapest price, a tap away. The pick is
// remembered for that series on this device. setsBoxRules.ts has the rules.
import { useState } from "react";
import { SortMenu } from "../Home/ShelfBar";
import { formatCents } from "../../lib/prices";
import { readLocal, writeLocal } from "../../lib/prefs";
import {
  editionTitle,
  leadBooksOf,
  type EditionLine,
} from "../../lib/editions";
import type { BoxSet, StoreLink } from "../../lib/types";
import BoxSets from "./BoxSets";
import EditionsBox from "./EditionsBox";
import { setsTitle, shownSets } from "./boxSetRules";
import {
  BOX_SETS,
  cheapestOf,
  pickedOf,
  readPicks,
  setsOptions,
  withPick,
} from "./setsBoxRules";
import { pricesStyles as styles } from "./styles";

const PICKS_KEY = "setsPicks";

const rememberedFor = (series: string) =>
  readPicks(readLocal(PICKS_KEY)).find(([name]) => name === series)?.[1] ??
  null;

export default function SetsBox({
  series,
  sets: found,
  links,
  lines,
  headline,
  owned,
}: {
  // the series' slug: its pick is remembered under it
  series: string;
  sets: BoxSet[];
  links: StoreLink[];
  // the series' edition lines ("Other editions"), and the one the page
  // leads with
  lines: EditionLine[];
  headline: EditionLine | null;
  // the volumes they own, when the series is on their shelf
  owned: number[];
}) {
  const sets = shownSets(found, lines.length > 0);
  // an edition whose first book can't be opened has nothing to show here
  const showable = lines.filter((line) => leadBooksOf(line, owned) !== null);
  const options = setsOptions(sets.length ? setsTitle(sets) : null, showable);
  const [chosen, setChosen] = useState(() => rememberedFor(series));
  const picked = pickedOf(options, chosen, headline?.key ?? null);
  if (picked === null) return null;

  const line = showable.find((l) => l.key === picked) ?? null;
  const pick = (value: string) => {
    setChosen(value);
    writeLocal(
      PICKS_KEY,
      JSON.stringify(withPick(readPicks(readLocal(PICKS_KEY)), series, value)),
    );
  };
  // one thing to show: the box as it always was, named for what it holds
  const alone = options.length === 1;
  let title = "Other editions";
  if (alone) title = line ? editionTitle(line) : setsTitle(sets);
  else if (sets.length) title = "Box sets & editions";

  // the cheapest way into each of the others
  const fromOf = (value: string) =>
    cheapestOf(
      showable
        .find((l) => l.key === value)!
        .books.map((b) => b.knownPriceCents),
    );
  // the editions not showing, each a row at the bottom. Box sets have no
  // row there: they're the first thing in the menu, and the box opens on
  // them whenever there is one
  const others = options.filter(
    (o) => o.value !== picked && o.value !== BOX_SETS,
  );
  const menu = (inline: boolean) => (
    <SortMenu
      {...(inline ? { lead: "showing" } : { box: true, compact: true })}
      menuLabel="Show"
      wordy
      sortBy={picked}
      onSort={pick}
      options={options}
    />
  );

  return (
    <aside aria-labelledby="sets-box-title" className={styles.setsBox}>
      <div className={styles.setsHead}>
        <h2 id="sets-box-title" className={styles.setsTitle}>
          {title}
        </h2>
        {/* below a laptop the pick sits beside the title, taking no row of
            its own */}
        {!alone && <span className={styles.setsPickInline}>{menu(true)}</span>}
      </div>
      {!alone && <div className={styles.setsPickBox}>{menu(false)}</div>}

      {line ? (
        <EditionsBox bare line={line} owned={owned} />
      ) : (
        <BoxSets
          bare
          sets={found}
          links={links}
          editionsListed={lines.length > 0}
        />
      )}

      {others.length > 0 && (
        <ul className={styles.setsOthers} aria-label="Also for this series">
          {others.map((o) => {
            const cents = fromOf(o.value);
            return (
              <li key={o.value}>
                <button
                  type="button"
                  className={styles.setsOther}
                  onClick={() => pick(o.value)}
                >
                  <span className={styles.setsOtherName}>{o.label}</span>
                  <span className={styles.setsOtherFrom}>
                    {cents !== null
                      ? `from ${formatCents(cents)}`
                      : "check price"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
