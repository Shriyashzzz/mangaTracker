// Blocked readers, every one (Settings, Account shows the newest few and
// links here): newest first, each with Unblock, which asks first. A long
// list gets a search box. Laid out like Friends
import { useEffect, useState } from "react";
import Avatar from "../../components/avatar/Avatar";
import {
  blocksMatching,
  getBlocks,
  SEARCH_FROM,
  unblockAsk,
  unblockReader,
  type BlockedReader,
} from "../../lib/blocks";
import { orOffline } from "../../lib/offline";
import { usePrivatePage } from "../../lib/seo";
import { acknowledgementsStyles as styles } from "../Acknowledgements/styles";

export default function Blocked() {
  usePrivatePage("Blocked readers");
  const [blocks, setBlocks] = useState<BlockedReader[] | null>(null);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    getBlocks()
      .then((r) => setBlocks(r.blocks))
      .catch(() => setNote(orOffline("They didn't load. Try again.")));
  }, []);

  const unblock = async (b: BlockedReader) => {
    if (!window.confirm(unblockAsk(b.name))) return;
    setNote("");
    try {
      await unblockReader(b.id);
      setBlocks((now) => now?.filter((x) => x.id !== b.id) ?? null);
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  const shown = blocks ? blocksMatching(blocks, typed) : [];
  return (
    <article className={`${styles.page} fade-in`}>
      <header>
        <h1 className={styles.title}>Blocked readers</h1>
        <p className={styles.lead}>
          You don't see their reviews, and neither of you can open or follow the
          other's shared shelf. They aren't told.
        </p>
      </header>
      {note && (
        <p className="text-accent" role="alert">
          {note}
        </p>
      )}
      {blocks && blocks.length === 0 && (
        <p className={styles.body}>Nobody is blocked.</p>
      )}
      {blocks && blocks.length >= SEARCH_FROM && (
        <input
          type="search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={`Search ${blocks.length.toLocaleString("en-US")} blocked readers`}
          aria-label="Search blocked readers"
          className="min-h-11 w-full border-[2.5px] border-line bg-paper px-3 text-[1rem] text-ink outline-none focus-visible:border-accent"
        />
      )}
      {blocks && blocks.length > 0 && shown.length === 0 && (
        <p className={styles.body}>No blocked reader goes by that name.</p>
      )}
      {shown.length > 0 && (
        <ul role="list" className={styles.items}>
          {shown.map((b) => (
            <li key={b.id} className={`${styles.item} flex items-center gap-3`}>
              <Avatar id={b.avatar} className="w-10 shrink-0" />
              <span className={`${styles.itemName} min-w-0 flex-1 truncate`}>
                {b.name}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm shrink-0"
                onClick={() => void unblock(b)}
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
