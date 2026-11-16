// The piles a long New tab is sorted into, drawn as the tab draws them
// (Home/NewPiles.tsx): each pile's name and count, its reason in its own
// words (Home/piles.ts PILE_TEXT), and a fan of covers stamped with the
// volume that's next, with how many there are to get under the further-back
// ones. The covers are blank stand-ins: nobody's series in particular
import { PILES, PILE_TEXT, type Pile } from "../Home/piles";
import { pilesStyles } from "../Home/pilesStyles";
import { newReleasesStyles as styles } from "./styles";

// three covers a pile: the stamp, and the count under it
const COVERS: Record<Pile, { stamp: string; toGet?: number }[]> = {
  one: [{ stamp: "Vol. 15" }, { stamp: "Vol. 8" }, { stamp: "Vol. 22" }],
  few: [
    { stamp: "Vol. 13", toGet: 2 },
    { stamp: "Vol. 4", toGet: 5 },
    { stamp: "Vol. 31", toGet: 3 },
  ],
  way: [
    { stamp: "Vol. 1", toGet: 16 },
    { stamp: "Vol. 6", toGet: 38 },
    { stamp: "Vol. 60", toGet: 16 },
  ],
};

export default function PilesPicture() {
  return (
    <div className={styles.pilesPicture}>
      {PILES.map((pile) => {
        const { name, why } = PILE_TEXT.volumes[pile];
        const covers = COVERS[pile];
        return (
          <section
            key={pile}
            className={pilesStyles.pile}
            aria-label={`${name}: ${why}`}
          >
            <h3 className={pilesStyles.pileName}>
              {name}{" "}
              <span className={pilesStyles.pileCount}>{covers.length}</span>
            </h3>
            <p className={pilesStyles.why}>{why}</p>
            <div className={pilesStyles.fan} aria-hidden>
              {covers.map((cover) => (
                <span key={cover.stamp} className={pilesStyles.fanCover}>
                  <span className={`${pilesStyles.fanArt} cover-lines`} />
                  <span className={pilesStyles.stamp}>{cover.stamp}</span>
                  {cover.toGet && (
                    <span className={pilesStyles.behind}>
                      {cover.toGet} to get
                    </span>
                  )}
                </span>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
