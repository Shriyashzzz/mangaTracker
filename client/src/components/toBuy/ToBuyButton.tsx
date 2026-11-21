// "+ To buy" on a volume's price page: puts the volume on the reader's To
// buy list, or takes it off again. Signed-in readers only; the practice
// tour has no list.
import { useEffect, useState } from "react";
import clsx from "clsx";
import { NavLink } from "react-router";
import { isDemo } from "../../lib/demo";
import { useAuth } from "../../store/auth";
import { loadToBuyOnce, useToBuy } from "../../store/toBuy";

// filled with the price stamps' green ("Cheapest new" wears it), so it's
// told apart from the shelf's own buttons at a glance
const OFFERED = "bg-stamp-new text-stamp-ink hover:not-disabled:bg-stamp-new";
// on the list: quieter, the same green as its edge
const ON_LIST = "border-stamp-new bg-card text-ink";

export default function ToBuyButton({
  isbn13,
  full = false,
}: {
  isbn13: string;
  // the page's full button size, beside another full-size button; small
  // otherwise, in a row of small ones
  full?: boolean;
}) {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const list = useToBuy((s) => s.list);
  const add = useToBuy((s) => s.add);
  const remove = useToBuy((s) => s.remove);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isSignedIn && !isDemo()) loadToBuyOnce();
  }, [isSignedIn]);

  if (!isSignedIn || isDemo()) return null;

  const onList = Boolean(list?.items.some((item) => item.isbn13 === isbn13));
  const toggle = async () => {
    setSaving(true);
    setError("");
    try {
      await (onList ? remove(isbn13) : add(isbn13));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={clsx("btn", !full && "btn-sm", onList ? ON_LIST : OFFERED)}
        aria-pressed={onList}
        // until the list is in, it can't say which way the tap goes
        disabled={saving || !list}
        onClick={toggle}
      >
        {onList ? (
          // the short words on a phone, where it shares a row
          <>
            <span className="upto-720:hidden">On your To buy list</span>
            <span className="hidden upto-720:inline">On To buy</span>
          </>
        ) : (
          "+ To buy"
        )}
      </button>
      {onList && (
        // not on a phone: under the button it pushed it out of line with the
        // one beside it, and the top bar's To buy tag is the way there
        <NavLink
          to="/to-buy"
          className="tap text-[0.88rem] font-medium underline decoration-line-soft underline-offset-3 hover:decoration-accent upto-720:hidden"
          viewTransition
        >
          See the list
        </NavLink>
      )}
      {error && (
        <p className="basis-full text-[0.88rem] text-ink-soft" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
