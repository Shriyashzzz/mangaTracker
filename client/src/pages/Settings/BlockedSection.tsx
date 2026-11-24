// Settings, Account: the readers you've blocked, the newest few with
// Unblock, and the way to the rest (pages/Blocked). Blocking is done on a
// review or a shared shelf (server blocks/blocks.ts)
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import Avatar from "../../components/avatar/Avatar";
import {
  BLOCKS_SHOWN,
  getBlocks,
  unblockAsk,
  unblockReader,
  type BlockList,
  type BlockedReader,
} from "../../lib/blocks";
import { orOffline } from "../../lib/offline";
import { settingsStyles as styles } from "./styles";

export function BlockedSection() {
  const [list, setList] = useState<BlockList | null>(null);
  const [failed, setFailed] = useState("");
  const load = () =>
    getBlocks(BLOCKS_SHOWN)
      .then(setList)
      .catch(() => setFailed(orOffline("Couldn't load them. Try again.")));
  useEffect(() => {
    void load();
  }, []);
  const unblock = async (b: BlockedReader) => {
    if (!window.confirm(unblockAsk(b.name))) return;
    setFailed("");
    try {
      await unblockReader(b.id);
      // the next one along moves up into the few shown
      await load();
    } catch (e) {
      setFailed((e as Error).message);
    }
  };
  return (
    <section className={styles.section} aria-labelledby="set-blocked">
      <h3 id="set-blocked" className={styles.heading}>
        Blocked readers
      </h3>
      <p className={styles.body}>
        You don't see their reviews, and neither of you can open or follow the
        other's shared shelf. To block someone, use Block on one of their
        reviews or on their shared shelf.
      </p>
      {list && list.total === 0 ? (
        <p className={styles.body}>Nobody is blocked.</p>
      ) : null}
      {list?.blocks.length ? (
        <ul className="flex flex-col">
          {list.blocks.map((b) => (
            <li
              key={b.id}
              className="flex min-h-12 items-center gap-3 border-b border-dashed border-line-soft last:border-b-0"
            >
              <Avatar id={b.avatar} className="size-8 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-medium">
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
      ) : null}
      {list && list.total > list.blocks.length ? (
        <NavLink
          to="/blocked"
          className="font-medium text-ink underline"
          viewTransition
        >
          See all {list.total.toLocaleString("en-US")} blocked readers →
        </NavLink>
      ) : null}
      {failed && (
        <p className={styles.failed} role="alert">
          {failed}
        </p>
      )}
    </section>
  );
}
