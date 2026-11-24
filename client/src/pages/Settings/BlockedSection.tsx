// Settings, Account: the readers you've blocked, each with Unblock (server
// blocks/blocks.ts). Blocking is done on a review or a shared shelf
import { useEffect, useState } from "react";
import Avatar from "../../components/avatar/Avatar";
import { getBlocks, unblockReader, type BlockedReader } from "../../lib/blocks";
import { orOffline } from "../../lib/offline";
import { settingsStyles as styles } from "./styles";

export function BlockedSection() {
  const [blocks, setBlocks] = useState<BlockedReader[] | null>(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    getBlocks()
      .then(setBlocks)
      .catch(() => setFailed(orOffline("Couldn't load them. Try again.")));
  }, []);
  const unblock = async (id: number) => {
    setFailed("");
    try {
      await unblockReader(id);
      setBlocks((now) => now?.filter((b) => b.id !== id) ?? null);
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
      {blocks && blocks.length === 0 ? (
        <p className={styles.body}>Nobody is blocked.</p>
      ) : null}
      {blocks?.length ? (
        <ul className="flex flex-col">
          {blocks.map((b) => (
            <li
              key={b.id}
              className="flex min-h-12 items-center gap-3 border-b border-dashed border-line-soft last:border-b-0"
            >
              <Avatar id={b.avatar} className="size-8" />
              <span className="flex-1 font-medium">{b.name}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void unblock(b.id)}
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {failed && (
        <p className={styles.failed} role="alert">
          {failed}
        </p>
      )}
    </section>
  );
}
