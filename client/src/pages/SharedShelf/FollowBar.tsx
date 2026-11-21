// For someone signed in, looking at another reader's shared shelf: Follow,
// and it's then in Friends. (How it sits beside theirs is said further down,
// in the compare box.) Drawn like the owner's note, in the same spot.
import { useState } from "react";
import { setFollowing } from "../../lib/friends";
import { offlineLink, useIsOffline } from "../../lib/offline";
import { shareStyles as styles } from "./styles";

type Props = {
  code: string;
  // the shelf's name, as its owner shares it
  name: string;
  following: boolean;
};

export default function FollowBar({ code, name, following }: Props) {
  const [on, setOn] = useState(following);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState("");
  const offline = useIsOffline();
  const flip = async () => {
    setSaving(true);
    setFailed("");
    try {
      setOn(await setFollowing(code, !on));
    } catch (e) {
      setFailed((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={styles.ownerNote}>
      <p>
        {on ? (
          <>
            <b>{name}</b> is in your Friends.
          </>
        ) : (
          <>
            Follow <b>{name}</b> to keep this shelf in Friends.
          </>
        )}
      </p>
      <p className={styles.ownerLinks}>
        <button
          type="button"
          className={on ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
          disabled={saving}
          aria-pressed={on}
          onClick={flip}
          {...offlineLink(offline)}
        >
          {on ? "Following" : "Follow"}
        </button>
        {failed && (
          <span className="text-accent" role="alert">
            {failed}
          </span>
        )}
      </p>
    </div>
  );
}
