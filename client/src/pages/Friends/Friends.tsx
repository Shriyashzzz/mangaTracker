// Friends: the shared shelves you follow, newest followed first, each with
// its size and the way to it. Follow one from its page (FollowBar).
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import Avatar from "../../components/avatar/Avatar";
import { getFriends, setFollowing, type Friend } from "../../lib/friends";
import { orOffline } from "../../lib/offline";
import { usePrivatePage } from "../../lib/seo";
import { acknowledgementsStyles as styles } from "../Acknowledgements/styles";

const count = (n: number, one: string, more: string) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : more}`;

export default function Friends() {
  usePrivatePage("Friends");
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    getFriends()
      .then(setFriends)
      .catch(() => setNote(orOffline("Your friends didn't load. Try again.")));
  }, []);

  const unfollow = async (friend: Friend) => {
    setNote("");
    try {
      await setFollowing(friend.code, false);
      setFriends((list) => list?.filter((f) => f.code !== friend.code) ?? null);
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  return (
    <article className={`${styles.page} fade-in`}>
      <header>
        <h1 className={styles.title}>Friends</h1>
        <p className={styles.lead}>The shared shelves you follow.</p>
      </header>
      {note && (
        <p className="text-accent" role="alert">
          {note}
        </p>
      )}
      {friends && friends.length === 0 && (
        <section>
          <p className={styles.body}>No one yet. To follow a friend:</p>
          <ul className={`${styles.body} mt-2 list-disc pl-5`}>
            <li>Ask for the link to their shared shelf.</li>
            <li>Open it and press Follow.</li>
          </ul>
        </section>
      )}
      {friends && friends.length > 0 && (
        // role: Safari stops announcing a list once its bullets are styled away
        <ul role="list" className={styles.items}>
          {friends.map((friend) => (
            <li
              key={friend.code}
              className={`${styles.item} flex items-center gap-3`}
            >
              <Avatar id={friend.avatar} className="w-12 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col">
                <NavLink
                  to={`/u/${friend.code}`}
                  className={`${styles.itemName} truncate`}
                  viewTransition
                >
                  {friend.name}
                </NavLink>
                <span className={styles.itemBody}>
                  {count(friend.series, "series", "series")} ·{" "}
                  {count(friend.volumes, "volume", "volumes")}
                </span>
              </span>
              <button
                type="button"
                className="tap text-[0.85rem] font-medium text-ink-soft underline decoration-line-soft underline-offset-3 hover:decoration-current"
                onClick={() => unfollow(friend)}
              >
                Unfollow
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
