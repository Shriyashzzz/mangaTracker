// The site's own numbers, at the top of the owner's page: readers, shelves,
// prices and reviews, and how many came in this week where we know. Only
// the owner's account is answered; for anyone else it shows nothing
import { useEffect, useState } from "react";
import { getSiteStats, type SiteStats } from "../../../lib/reviews";
import { reportedStyles as styles } from "./reportedStyles";
import { volumesStyles } from "../../Home/volumesStyles";

const count = (n: number) => n.toLocaleString("en-US");

export default function SiteNumbers() {
  const [stats, setStats] = useState<SiteStats | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getSiteStats(controller.signal)
      .then(setStats)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!stats) return null;
  const week = (n: number) => `+${count(n)} this week`;
  const numbers = [
    { name: "Readers", value: stats.readers, note: null },
    {
      name: "On shelves",
      value: stats.shelved,
      note: `${count(stats.shelvedSeries)} different series`,
    },
    { name: "Series known", value: stats.seriesKnown, note: null },
    {
      name: "Prices saved",
      value: stats.prices.total,
      note: week(stats.prices.week),
    },
    {
      name: "Volumes priced",
      value: stats.volumesPriced.total,
      note: week(stats.volumesPriced.week),
    },
    {
      name: "Reviews",
      value: stats.reviews.total,
      note: week(stats.reviews.week),
    },
  ];

  return (
    <section aria-label="Site numbers" className={styles.numbers}>
      {numbers.map(({ name, value, note }) => (
        <div key={name} className={styles.number}>
          <span className={volumesStyles.totalLabel}>{name}</span>
          <span className={volumesStyles.totalValue}>{count(value)}</span>
          {note && <span className={volumesStyles.totalNote}>{note}</span>}
        </div>
      ))}
    </section>
  );
}
