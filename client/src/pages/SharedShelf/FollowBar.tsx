// For someone signed in, looking at another reader's shared shelf: Follow,
// and it's then in Friends. (How it sits beside theirs is said further down,
// in the compare box.) Drawn like the owner's note, in the same spot. Block
// is beside it: the shelf closes to them both, and they're taken to Friends.
import { useState } from "react";
import { useNavigate } from "react-router";
import { BLOCK_TITLE, BLOCK_WHAT, blockReader } from "../../lib/blocks";
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
  const navigate = useNavigate();
  const block = async () => {
    if (!window.confirm(`${BLOCK_TITLE} ${BLOCK_WHAT}`)) return;
    setFailed("");
    try {
      await blockReader({ shareCode: code });
      navigate("/friends", { replace: true });
    } catch (e) {
      setFailed((e as Error).message);
    }
  };
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
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={block}
          {...offlineLink(offline)}
        >
          Block
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
