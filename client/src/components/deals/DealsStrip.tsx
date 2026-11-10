// "Sales right now": store-wide sales (server/src/collector/deals.ts, kept by
// hand), on the price pages. Nothing at all when there's no sale on. Closing
// it hides the sales showing then; a new one brings it back.
import { useEffect, useState } from "react";
import { CloseIcon } from "../icons/Icons";
import { dayName, getDeals, type Deal } from "../../lib/collector";
import { readLocal, writeLocal } from "../../lib/prefs";
import { noteStoreClick } from "../../lib/support";
import { dealsStyles as styles } from "./styles";

const HIDDEN_KEY = "dealsHidden";
const idOf = (d: Deal) => `${d.store}|${d.text}|${d.ends}`;
// the set showing, so closing it means "these", not "sales" for good
const setId = (deals: Deal[]) => deals.map(idOf).sort().join("\n");

// asked once per visit and shared by every price page
let asked: Promise<Deal[]> | null = null;
const loadDeals = () =>
  (asked ??= getDeals().catch(() => {
    asked = null;
    return [];
  }));

const isAffiliate = (url: string) =>
  /[?&](tag|campid)=|bookshop\.org\/a\//.test(url);

export default function DealsStrip() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [hidden, setHidden] = useState(() => readLocal(HIDDEN_KEY) ?? "");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadDeals().then((d) => {
      if (live) setDeals(d);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!deals.length || hidden === setId(deals)) return null;

  const copy = (code: string) => {
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(code);
        setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
      })
      .catch(() => {
        // no clipboard: the code is there to read
      });
  };

  return (
    <aside className={styles.strip} aria-labelledby="deals-title">
      <div className={styles.head}>
        <h2 id="deals-title" className={styles.title}>
          Sales right now
        </h2>
        <button
          type="button"
          className={styles.close}
          aria-label="Hide these sales"
          onClick={() => {
            const id = setId(deals);
            writeLocal(HIDDEN_KEY, id);
            setHidden(id);
          }}
        >
          <CloseIcon className="size-4" />
        </button>
      </div>
      <ul className={styles.list}>
        {deals.map((d) => (
          <li key={idOf(d)} className={styles.deal}>
            <a
              href={d.url}
              target="_blank"
              rel={isAffiliate(d.url) ? "sponsored noreferrer" : "noreferrer"}
              className={styles.link}
              onClick={noteStoreClick}
              onAuxClick={noteStoreClick}
            >
              <span className={styles.store}>{d.store}</span> {d.text}
            </a>
            {d.code && (
              <button
                type="button"
                className={styles.code}
                onClick={() => copy(d.code!)}
                aria-label={`Copy code ${d.code}`}
              >
                {copied === d.code ? "Copied" : d.code}
              </button>
            )}
            <span className={styles.ends}>until {dayName(d.ends)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
